package com.leosiqra.app;

import android.app.Activity;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.IsoDep;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;

// Plugin "Emoney": baca SALDO kartu uang elektronik (Mandiri e-money, BNI
// TapCash) lewat NFC reader mode. Hanya perintah baca (SELECT / READ) — tidak
// pernah menulis ke kartu. Logika & perintah APDU sama dengan
// ios/App/App/EmoneyPlugin.swift; belum diuji dengan kartu asli.
@CapacitorPlugin(name = "Emoney")
public class EmoneyPlugin extends Plugin {

    private static final String[] MANDIRI_AIDS = { "A000000018300001", "0000000000000001" };
    private static final String[] TAPCASH_AIDS = { "A000424E49100001", "A000424E49999999", "112233445566" };
    private static final int MAX_BALANCE = 20_000_000;

    private PluginCall pendingCall;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        JSObject ret = new JSObject();
        ret.put("available", adapter != null);
        ret.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void scan(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (adapter == null) {
            call.reject("NFC tidak tersedia di perangkat ini.", "UNAVAILABLE");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("NFC mati — nyalakan NFC di Pengaturan HP dulu.", "DISABLED");
            return;
        }
        synchronized (this) {
            if (pendingCall != null) {
                call.reject("Pemindaian lain masih berjalan.", "BUSY");
                return;
            }
            pendingCall = call;
        }
        Activity activity = getActivity();
        int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK;
        activity.runOnUiThread(() -> adapter.enableReaderMode(activity, this::onTag, flags, null));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        stopReader();
        finish(null, "Dibatalkan.", "CANCELLED");
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        // Reader mode hanya berlaku saat activity di depan.
        stopReader();
        finish(null, "Dibatalkan.", "CANCELLED");
    }

    private void stopReader() {
        Activity activity = getActivity();
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (activity != null && adapter != null) {
            activity.runOnUiThread(() -> adapter.disableReaderMode(activity));
        }
    }

    private void finish(JSObject result, String error, String code) {
        PluginCall call;
        synchronized (this) {
            call = pendingCall;
            pendingCall = null;
        }
        if (call == null) return;
        if (result != null) call.resolve(result);
        else call.reject(error, code);
    }

    private void onTag(Tag tag) {
        IsoDep iso = IsoDep.get(tag);
        if (iso == null) {
            // Kartu lain (mis. MIFARE Classic) — tetap menunggu kartu yang benar.
            return;
        }
        JSObject result = null;
        try {
            iso.connect();
            iso.setTimeout(3000);
            result = readMandiri(iso);
            if (result == null) result = readTapcash(iso);
        } catch (IOException e) {
            stopReader();
            finish(null, "Kartu bergeser — coba tempelkan lagi.", "TAG_LOST");
            return;
        } finally {
            try { iso.close(); } catch (IOException ignored) { }
        }
        stopReader();
        if (result != null) finish(result, null, null);
        else finish(null, "Kartu tidak dikenali. Saat ini bisa Mandiri e-money & BNI TapCash.", "UNSUPPORTED");
    }

    private JSObject readMandiri(IsoDep iso) throws IOException {
        for (String aid : MANDIRI_AIDS) {
            if (!select(iso, aid)) continue;
            byte[] num = iso.transceive(hex("00B300003F"));
            String number = ok(num) && num.length - 2 >= 8 ? toHex(num, 0, 8) : "";
            // Rekaman saldo (kartu baru): 4 byte big-endian di offset 12..15.
            byte[] rec = iso.transceive(hex("00B2010400"));
            if (ok(rec) && rec.length - 2 >= 16) {
                long v = beInt(rec, 12, 4);
                if (v >= 0 && v <= MAX_BALANCE) return result("mandiri", "Mandiri e-money", number, v);
            }
            // Perintah saldo langsung: 4 byte little-endian di awal.
            byte[] bal = iso.transceive(hex("00B500000A"));
            if (ok(bal) && bal.length - 2 >= 4) {
                long v = (bal[0] & 0xFFL) | (bal[1] & 0xFFL) << 8 | (bal[2] & 0xFFL) << 16 | (bal[3] & 0xFFL) << 24;
                if (v <= MAX_BALANCE) return result("mandiri", "Mandiri e-money", number, v);
            }
            return null;
        }
        return null;
    }

    private JSObject readTapcash(IsoDep iso) throws IOException {
        for (String aid : TAPCASH_AIDS) {
            if (!select(iso, aid)) continue;
            // 90 32 03 00 00: saldo 3 byte big-endian di offset 2..4, nomor kartu di 8..15.
            byte[] r = iso.transceive(hex("9032030000"));
            if (!ok(r) || r.length - 2 < 5) return null;
            long v = beInt(r, 2, 3);
            if (v > MAX_BALANCE) return null;
            String number = r.length - 2 >= 16 ? toHex(r, 8, 8) : "";
            return result("tapcash", "BNI TapCash", number, v);
        }
        return null;
    }

    private boolean select(IsoDep iso, String aid) throws IOException {
        String len = String.format("%02X", aid.length() / 2);
        return ok(iso.transceive(hex("00A40400" + len + aid + "00")));
    }

    private static boolean ok(byte[] r) {
        if (r == null || r.length < 2) return false;
        int sw1 = r[r.length - 2] & 0xFF, sw2 = r[r.length - 1] & 0xFF;
        return (sw1 == 0x90 || sw1 == 0x91) && sw2 == 0x00;
    }

    private static long beInt(byte[] b, int off, int len) {
        long v = 0;
        for (int i = 0; i < len; i++) v = (v << 8) | (b[off + i] & 0xFF);
        return v;
    }

    private static JSObject result(String card, String name, String number, long balance) {
        JSObject o = new JSObject();
        o.put("card", card);
        o.put("cardName", name);
        o.put("cardNumber", number);
        o.put("balance", balance);
        return o;
    }

    private static byte[] hex(String s) {
        byte[] out = new byte[s.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return out;
    }

    private static String toHex(byte[] b, int off, int len) {
        StringBuilder sb = new StringBuilder();
        for (int i = off; i < off + len; i++) sb.append(String.format("%02X", b[i] & 0xFF));
        return sb.toString();
    }
}
