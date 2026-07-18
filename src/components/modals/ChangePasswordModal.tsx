"use client";

import { useState } from 'react';
import { Lock, Save, Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cloudflareApi } from '@/lib/cloudflare-api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // false untuk akun Google — tidak ada password lokal untuk diverifikasi,
  // jadi modal ini jadi "Set Password" (bikin password baru dari nol) alih-
  // alih "Ganti Password".
  hasPassword?: boolean;
}

export const ChangePasswordModal = ({ isOpen, onClose, hasPassword = true }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    if ((hasPassword && !currentPassword) || !newPassword || !confirmPassword) {
      setError('Semua kolom wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      await cloudflareApi('/api/member/password', {
        method: 'PATCH',
        json: hasPassword ? { currentPassword, newPassword } : { newPassword },
      });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah password. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={hasPassword ? 'Ganti Password' : 'Set Password'} maxWidth="max-w-md">
      <div className="space-y-5">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm font-medium text-emerald-600">
            {hasPassword ? 'Password berhasil diubah.' : 'Password berhasil dibuat.'}
          </div>
        )}

        {!hasPassword && (
          <p className="text-[12px] text-slate-500 leading-relaxed bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            Akun ini masuk pakai Google dan belum punya password. Buat password di bawah supaya Anda juga bisa login pakai email &amp; password sewaktu-waktu.
          </p>
        )}

        {hasPassword && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password Saat Ini</label>
            <div className="relative group">
              <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Masukkan password saat ini"
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-12 text-sm font-bold text-slate-700 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                aria-label={showCurrentPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showCurrentPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password Baru</label>
          <div className="relative group">
            <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-12 text-sm font-bold text-slate-700 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
              aria-label={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Konfirmasi Password Baru</label>
          <div className="relative group">
            <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-12 text-sm font-bold text-slate-700 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
              aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-indigo-600 disabled:bg-slate-300 text-white flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black transition-all mt-2 shadow-xl shadow-indigo-100"
        >
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} />
              Simpan Password Baru
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
