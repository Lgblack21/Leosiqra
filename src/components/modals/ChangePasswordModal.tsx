"use client";

import { useState } from 'react';
import { Lock, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cloudflareApi } from '@/lib/cloudflare-api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
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
        json: { currentPassword, newPassword },
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Ganti Password" maxWidth="max-w-md">
      <div className="space-y-5">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm font-medium text-emerald-600">
            Password berhasil diubah.
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password Saat Ini</label>
          <div className="relative group">
            <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-5 text-sm font-bold text-slate-700 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password Baru</label>
          <div className="relative group">
            <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-5 text-sm font-bold text-slate-700 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Konfirmasi Password Baru</label>
          <div className="relative group">
            <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-5 text-sm font-bold text-slate-700 transition-all"
            />
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
