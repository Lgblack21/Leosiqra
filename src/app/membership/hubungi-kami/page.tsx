"use client";

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Mail, Headphones, Copy, Check, ArrowRight } from 'lucide-react';
import { getPublicContact, PublicContact } from '@/lib/services/publicContactService';

export default function HubungiKamiPage() {
  // getPublicContact (bukan subscribeAppSettings) — /api/admin/settings
  // butuh role admin, jadi member biasa (non-admin) sebelumnya selalu gagal
  // fetch dan lihat "Belum diatur" walau WA/email sudah diisi admin.
  const [settings, setSettings] = useState<PublicContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    getPublicContact()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  // Normalisasi nomor WhatsApp jadi format internasional tanpa "+"/spasi/strip
  // (dibutuhkan wa.me) — anggap nomor lokal Indonesia kalau diawali "0".
  const normalizedWhatsApp = useMemo(() => {
    const raw = settings?.whatsapp;
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    else if (!digits.startsWith('62')) digits = '62' + digits;
    return digits;
  }, [settings?.whatsapp]);

  const copyEmail = async () => {
    if (!settings?.billingEmail) return;
    try {
      await navigator.clipboard.writeText(settings.billingEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Diam-diam gagal (mis. browser tanpa izin clipboard) — tombol email
      // masih tetap bisa diklik langsung sebagai mailto:.
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-[900px] mb-12">
      <div className="max-w-2xl">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 mb-5">
          <Headphones size={24} />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Hubungi Kami</h1>
        <p className="text-sm font-medium text-slate-500 mt-2 leading-relaxed">
          Ada pertanyaan, kendala, atau masukan soal Leosiqra? Langsung hubungi kami lewat WhatsApp atau email di bawah ini.
        </p>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat kontak...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WhatsApp */}
          <div className="bg-white p-6 md:p-8 rounded-[28px] border border-slate-50 shadow-sm space-y-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">WhatsApp</h2>
              <p className="text-[13px] font-bold text-slate-400 mt-1">
                {normalizedWhatsApp ? `+${normalizedWhatsApp}` : 'Belum diatur'}
              </p>
            </div>
            {normalizedWhatsApp ? (
              <a
                href={`https://wa.me/${normalizedWhatsApp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 group"
              >
                Chat Sekarang
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
            ) : (
              <p className="text-[11px] font-bold text-slate-300">Nomor WhatsApp belum diatur admin.</p>
            )}
          </div>

          {/* Email */}
          <div className="bg-white p-6 md:p-8 rounded-[28px] border border-slate-50 shadow-sm space-y-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Mail size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Email</h2>
              <p className="text-[13px] font-bold text-slate-400 mt-1 break-all">
                {settings?.billingEmail || 'Belum diatur'}
              </p>
            </div>
            {settings?.billingEmail ? (
              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${settings.billingEmail}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Kirim Email
                </a>
                <button
                  onClick={copyEmail}
                  title="Salin alamat email"
                  className="p-3.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all shrink-0"
                >
                  {copiedEmail ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
            ) : (
              <p className="text-[11px] font-bold text-slate-300">Email belum diatur admin.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
