/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  X, 
  Copy, 
  Check, 
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { twoFactorService } from '@/lib/services/twoFactorService';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'setup' | 'verify';
  email: string;
  onVerify: (value: string) => void | boolean | Promise<void | boolean>;
  secret?: string; // Only required for verify mode
}

export function TwoFactorModal({ isOpen, onClose, mode, email, onVerify, secret: providedSecret }: TwoFactorModalProps) {
  const [token, setToken] = useState(['', '', '', '', '', '']);
  const [internalSecret, setInternalSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'setup') {
        const newSecret = twoFactorService.generateSecret();
        const newUri = twoFactorService.generateURI(email, newSecret);
        setInternalSecret(newSecret);
        setUri(newUri);
        twoFactorService.generateQRCode(newUri).then(setQrCodeUrl);
      } else if (mode === 'verify' && providedSecret) {
        setInternalSecret(providedSecret);
      }
      
      setToken(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen, mode, email, providedSecret]);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newToken = [...token];
    newToken[index] = value.slice(-1);
    setToken(newToken);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newToken.every(t => t !== '')) {
      handleVerify(newToken.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !token[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
    const newToken = [...token];
    pastedData.forEach((char, i) => {
      if (/^\d$/.test(char)) newToken[i] = char;
    });
    setToken(newToken);
    if (newToken.every(t => t !== '')) {
      handleVerify(newToken.join(''));
    }
  };

  const handleVerify = async (fullToken: string) => {
    setError('');
    
    try {
      const isLocalVerification = mode === 'setup' || Boolean(providedSecret);
      const isValid = isLocalVerification
        ? twoFactorService.verifyToken(fullToken, internalSecret)
        : true;
      
      if (isValid) {
        const result = await onVerify(mode === 'setup' ? internalSecret : fullToken);
        if (result === false) {
          setError('Kode OTP salah atau sudah kedaluwarsa.');
          setToken(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      } else {
        setError('Kode OTP salah atau sudah kedaluwarsa.');
        setToken(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Terjadi kesalahan saat verifikasi.');
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'uri') => {
    await navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-[500px] bg-white rounded-[40px] shadow-2xl overflow-hidden overflow-y-auto max-h-[95vh] custom-scrollbar"
        >
          {/* Header */}
          <div className="p-8 pb-0 flex flex-col items-center text-center space-y-6 relative">
            <button 
              onClick={onClose}
              className="absolute top-6 right-8 text-slate-300 hover:text-rose-500 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="w-16 h-16 rounded-[24px] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <ShieldCheck size={32} />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
                {mode === 'setup' ? 'Setup Google 2FA' : 'Verifikasi 2FA'}
              </h2>
              <p className="text-slate-400 font-medium text-[13px]">
                {mode === 'setup' ? 'Scan QR lalu masukkan 6 digit kode aktif.' : 'Masukkan 6 digit kode dari aplikasi Authenticator Anda.'}
              </p>
            </div>

            {/* OTP Input Boxes */}
            <div className="flex gap-2.5 pt-4">
              {token.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleInputChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  className={cn(
                    "w-12 h-16 sm:w-14 sm:h-20 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white focus:shadow-xl focus:shadow-indigo-500/10 transition-all",
                    digit && "border-indigo-500 bg-white shadow-lg shadow-indigo-500/5",
                    error && "border-red-500 bg-red-50"
                  )}
                />
              ))}
            </div>

            {error && (
              <p className="text-red-500 text-[11px] font-bold uppercase tracking-wider">{error}</p>
            )}
          </div>

          <div className="p-8 space-y-6">
            {mode === 'setup' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* QR Section */}
                <div className="p-6 rounded-[32px] bg-indigo-50/30 border border-indigo-50/50 flex flex-col items-center space-y-6">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] self-start">Barcode Authenticator</p>
                  
                  <div className="w-48 h-48 bg-white p-4 rounded-3xl shadow-sm flex items-center justify-center border border-indigo-100/50">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-slate-50 animate-pulse rounded-2xl" />
                    )}
                  </div>

                  <p className="text-[11px] font-bold text-slate-400 text-center max-w-[200px]">
                    Scan barcode ini di Google Authenticator/Authy.
                  </p>
                </div>

                {/* Manual Details */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Secret Manual</label>
                    <div className="flex items-center gap-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl group focus-within:bg-white focus-within:border-indigo-500 transition-all">
                      <span className="flex-1 text-[13px] font-black text-slate-900 tracking-wider truncate">{internalSecret}</span>
                      <button 
                        onClick={() => copyToClipboard(internalSecret, 'secret')}
                        className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm"
                      >
                        {copiedSecret ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">URI Authenticator</label>
                    <div className="flex items-center gap-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl group focus-within:bg-white focus-within:border-indigo-500 transition-all">
                      <span className="flex-1 text-[13px] font-black text-slate-900 tracking-wider truncate">{uri}</span>
                      <button 
                        onClick={() => copyToClipboard(uri, 'uri')}
                        className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm"
                      >
                        {copiedUri ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Open App Button */}
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => copyToClipboard(internalSecret, 'secret')}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] font-black text-slate-900 hover:bg-white hover:border-indigo-200 transition-all"
                    >
                      Salin Secret
                    </button>
                    <button 
                      onClick={() => copyToClipboard(uri, 'uri')}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] font-black text-slate-900 hover:bg-white hover:border-indigo-200 transition-all"
                    >
                      Salin URI
                    </button>
                    <a 
                      href={uri}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 text-white text-[11px] font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-center"
                    >
                      Buka Authenticator
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Note */}
            <div className="pt-6 border-t border-slate-50 flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <Info size={12} />
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                {mode === 'setup' 
                  ? 'Pastikan Anda telah menyimpan secret di atas secara aman sebelum melanjutkan. Kode 2FA akan dibutuhkan setiap kali Anda login.'
                  : 'Jika Anda kehilangan akses ke aplikasi Authenticator, hubungi admin untuk melakukan reset 2FA manual.'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
