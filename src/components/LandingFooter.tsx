import Image from 'next/image';
import Link from 'next/link';

// variant "dark" untuk landing (Dark Luxury); halaman lain tetap terang.
export const LandingFooter = ({ variant = 'light' }: { variant?: 'light' | 'dark' }) => {
  const dark = variant === 'dark';
  const title = dark ? 'text-[#f4efe6]' : 'text-slate-900';
  const text = dark ? 'text-[#9a958c]' : 'text-slate-500';
  const link = dark ? 'hover:text-[#d6b67e] transition-colors' : 'hover:text-indigo-600 transition-colors';
  return (
  <footer className={dark ? "py-16 px-6 border-t border-white/[0.06] bg-[#07080b]" : "py-16 px-6 border-t border-slate-100 bg-white"}>
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Image 
              src="/images/Logo-new.png" 
              alt="Leosiqra Logo" 
              width={32} 
              height={32} 
              className="object-contain"
            />
            <h3 className={`font-serif font-black text-xl tracking-tight ${title}`}>Leosiqra</h3>
          </div>
          <p className={`${text} font-medium leading-relaxed text-xs max-w-[240px]`}>
            Platform finansial pribadi untuk melihat arus kas, target, dan investasi dengan lebih rapi dan tenang.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className={`font-serif font-black tracking-tight text-sm ${title}`}>Produk</h4>
          <ul className={`space-y-3 text-xs font-medium ${text}`}>
            <li><Link href="/#produk" className={link}>Produk</Link></li>
            <li><Link href="/#fitur" className={link}>Fitur</Link></li>
            <li><Link href="/#cara-kerja" className={link}>Cara Kerja</Link></li>
            <li><Link href="/input-cepat" className={link}>Input Cepat</Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className={`font-serif font-black tracking-tight text-sm ${title}`}>Keamanan</h4>
          <ul className={`space-y-3 text-xs font-medium ${text}`}>
            <li><Link href="/privacy" className={link}>Kebijakan Privasi</Link></li>
            <li><Link href="/terms" className={link}>Syarat Layanan</Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className={`font-serif font-black tracking-tight text-sm ${title}`}>Akses</h4>
          <ul className={`space-y-3 text-xs font-medium ${text}`}>
            <li><Link href="/auth/login" className={link}>Masuk</Link></li>
            <li><Link href="/auth/register" className={link}>Daftar Gratis</Link></li>
            <li><Link href="/hubungi-kami" className={link}>Hubungi Kami</Link></li>
          </ul>
        </div>
      </div>

      <div className={dark ? "pt-8 border-t border-white/[0.06]" : "pt-8 border-t border-slate-100"}>
        <p className={`${dark ? "text-[#6f6b64]" : "text-slate-400"} text-[11px] font-medium leading-relaxed text-center md:text-left`}>
          Leosiqra membantu keteraturan finansial pribadi. Bukan saran investasi personal dan bukan janji keuntungan.
        </p>
      </div>
    </div>
  </footer>
);
};
