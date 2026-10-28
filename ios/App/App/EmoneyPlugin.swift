import Foundation
import UIKit
import CoreNFC
import Capacitor

// Bridge view controller aplikasi: mendaftarkan plugin lokal (tidak lewat npm)
// ke Capacitor. SceneDelegate memakai kelas ini, bukan CAPBridgeViewController.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(EmoneyPlugin())
    }
}

// Plugin "Emoney": baca SALDO kartu uang elektronik (Mandiri e-money, BNI
// TapCash) lewat Core NFC. Hanya perintah baca (SELECT / READ) — tidak pernah
// menulis ke kartu. Perintah APDU dari proyek pembaca open-source (lihat
// docs/HANDOFF.md); belum diuji dengan kartu asli.
@objc(EmoneyPlugin)
public class EmoneyPlugin: CAPPlugin, CAPBridgedPlugin, NFCTagReaderSessionDelegate {
    public let identifier = "EmoneyPlugin"
    public let jsName = "Emoney"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    ]

    private var session: NFCTagReaderSession?
    private var pendingCall: CAPPluginCall?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": NFCTagReaderSession.readingAvailable])
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard NFCTagReaderSession.readingAvailable else {
            call.reject("NFC tidak tersedia di perangkat ini.", "UNAVAILABLE")
            return
        }
        if pendingCall != nil {
            call.reject("Pemindaian lain masih berjalan.", "BUSY")
            return
        }
        pendingCall = call
        DispatchQueue.main.async {
            self.session = NFCTagReaderSession(pollingOption: [.iso14443], delegate: self, queue: nil)
            self.session?.alertMessage = "Tempelkan kartu e-money di bagian atas belakang iPhone."
            self.session?.begin()
        }
    }

    // MARK: NFCTagReaderSessionDelegate

    public func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

    public func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
        self.session = nil
        guard let call = pendingCall else { return }
        pendingCall = nil
        let code = (error as? NFCReaderError)?.code
        if code == .readerSessionInvalidationErrorUserCanceled {
            call.reject("Dibatalkan.", "CANCELLED")
        } else if code == .readerSessionInvalidationErrorSessionTimeout {
            call.reject("Waktu habis — kartu tidak terdeteksi.", "TIMEOUT")
        } else {
            call.reject(error.localizedDescription, "NFC_ERROR")
        }
    }

    public func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
        guard let tag = tags.first else { return }
        let transceive: Transceive
        switch tag {
        case .iso7816(let t):
            transceive = { apdu, done in
                guard let cmd = NFCISO7816APDU(data: apdu) else { return done(nil) }
                t.sendCommand(apdu: cmd) { data, sw1, sw2, err in
                    done(err == nil ? data + Data([sw1, sw2]) : nil)
                }
            }
        case .miFare(let t):
            transceive = { apdu, done in
                guard let cmd = NFCISO7816APDU(data: apdu) else { return done(nil) }
                t.sendMiFareISO7816Command(cmd) { data, sw1, sw2, err in
                    done(err == nil ? data + Data([sw1, sw2]) : nil)
                }
            }
        default:
            fail(session, "Kartu ini belum didukung.", "UNSUPPORTED")
            return
        }
        session.connect(to: tag) { err in
            if err != nil {
                self.fail(session, "Kartu bergeser — coba tempelkan lagi.", "TAG_LOST")
                return
            }
            EmoneyReader(transceive: transceive).read { result in
                guard let call = self.pendingCall else { return }
                if let r = result {
                    self.pendingCall = nil
                    session.alertMessage = "Saldo terbaca."
                    session.invalidate()
                    call.resolve(r)
                } else {
                    self.fail(session, "Kartu tidak dikenali. Saat ini bisa Mandiri e-money & BNI TapCash.", "UNSUPPORTED")
                }
            }
        }
    }

    // Tolak pemanggil dulu (pesan spesifik), baru tutup sesi — callback
    // didInvalidateWithError sesudahnya tidak menemukan pendingCall lagi.
    private func fail(_ session: NFCTagReaderSession, _ message: String, _ code: String) {
        if let call = pendingCall {
            pendingCall = nil
            call.reject(message, code)
        }
        session.invalidate(errorMessage: message)
    }
}

typealias Transceive = (Data, @escaping (Data?) -> Void) -> Void

// Urutan perintah per jenis kartu. Respons = data + SW1 SW2.
struct EmoneyReader {
    let transceive: Transceive

    static let mandiriAids = ["A000000018300001", "0000000000000001"]
    static let tapcashAids = ["A000424E49100001", "A000424E49999999", "112233445566"]
    static let maxBalance = 20_000_000

    func read(_ done: @escaping ([String: Any]?) -> Void) {
        tryMandiri(Self.mandiriAids) { r in
            if let r = r { return done(r) }
            self.tryTapcash(Self.tapcashAids, done)
        }
    }

    private func send(_ hex: String, _ done: @escaping (Data?) -> Void) {
        transceive(Data(hexString: hex), done)
    }

    private func ok(_ r: Data?) -> Bool {
        guard let r = r, r.count >= 2 else { return false }
        let sw1 = r[r.count - 2], sw2 = r[r.count - 1]
        return (sw1 == 0x90 || sw1 == 0x91) && sw2 == 0x00
    }

    private func select(_ aid: String, _ done: @escaping (Bool) -> Void) {
        let len = String(format: "%02X", aid.count / 2)
        send("00A40400\(len)\(aid)00") { done(self.ok($0)) }
    }

    private func tryMandiri(_ aids: [String], _ done: @escaping ([String: Any]?) -> Void) {
        guard let aid = aids.first else { return done(nil) }
        select(aid) { selected in
            guard selected else { return self.tryMandiri(Array(aids.dropFirst()), done) }
            self.send("00B300003F") { num in
                let number = self.ok(num) ? num!.prefix(8).hexString : ""
                // Rekaman saldo (kartu baru): 4 byte big-endian di offset 12..15.
                self.send("00B2010400") { rec in
                    if self.ok(rec), let rec = rec, rec.count - 2 >= 16 {
                        let v = rec.subdata(in: 12..<16).reduce(0) { ($0 << 8) | Int($1) }
                        if v >= 0 && v <= Self.maxBalance { return done(self.result("mandiri", "Mandiri e-money", number, v)) }
                    }
                    // Perintah saldo langsung: 4 byte little-endian di awal.
                    self.send("00B500000A") { bal in
                        guard self.ok(bal), let bal = bal, bal.count - 2 >= 4 else { return done(nil) }
                        let v = bal.prefix(4).reversed().reduce(0) { ($0 << 8) | Int($1) }
                        guard v >= 0 && v <= Self.maxBalance else { return done(nil) }
                        done(self.result("mandiri", "Mandiri e-money", number, v))
                    }
                }
            }
        }
    }

    private func tryTapcash(_ aids: [String], _ done: @escaping ([String: Any]?) -> Void) {
        guard let aid = aids.first else { return done(nil) }
        select(aid) { selected in
            guard selected else { return self.tryTapcash(Array(aids.dropFirst()), done) }
            // 90 32 03 00 00: saldo 3 byte big-endian di offset 2..4, nomor kartu di 8..15.
            self.send("9032030000") { r in
                guard self.ok(r), let r = r, r.count - 2 >= 5 else { return done(nil) }
                let v = (Int(r[2]) << 16) | (Int(r[3]) << 8) | Int(r[4])
                guard v <= Self.maxBalance else { return done(nil) }
                let number = r.count - 2 >= 16 ? r.subdata(in: 8..<16).hexString : ""
                done(self.result("tapcash", "BNI TapCash", number, v))
            }
        }
    }

    private func result(_ card: String, _ name: String, _ number: String, _ balance: Int) -> [String: Any] {
        ["card": card, "cardName": name, "cardNumber": number, "balance": balance]
    }
}

extension Data {
    init(hexString: String) {
        var data = Data()
        var idx = hexString.startIndex
        while idx < hexString.endIndex {
            let next = hexString.index(idx, offsetBy: 2)
            if let b = UInt8(hexString[idx..<next], radix: 16) { data.append(b) }
            idx = next
        }
        self = data
    }

    var hexString: String { map { String(format: "%02X", $0) }.joined() }
}
