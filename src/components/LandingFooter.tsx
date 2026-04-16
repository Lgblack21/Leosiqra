import Image from 'next/image';

export const LandingFooter = () => (
  <footer className="py-16 px-6 border-t border-slate-100 bg-white">
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
            <h3 className="font-serif font-black text-xl tracking-tight text-slate-900">Leosiqra</h3>
          </div>
          <p className="text-slate-500 font-medium leading-relaxed text-xs max-w-[240px]">
            Platform finansial pribadi untuk melihat arus kas, target, dan investasi dengan lebih rapi dan tenang.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-serif font-black text-slate-900 tracking-tight text-sm">Produk</h4>
          <ul className="space-y-3 text-xs text-slate-500 font-medium">
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Produk</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Fitur</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Cara Kerja</a></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-serif font-black text-slate-900 tracking-tight text-sm">Keamanan</h4>
          <ul className="space-y-3 text-xs text-slate-500 font-medium">
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Transparansi</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Kebijakan Privasi</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Syarat Layanan</a></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-serif font-black text-slate-900 tracking-tight text-sm">Akses</h4>
          <ul className="space-y-3 text-xs text-slate-500 font-medium">
            <li><a href="/auth/login" className="hover:text-indigo-600 transition-colors">Masuk</a></li>
            <li><a href="/auth/register" className="hover:text-indigo-600 transition-colors">Daftar Gratis</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Hubungi Kami</a></li>
          </ul>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <p className="text-slate-400 text-[11px] font-medium leading-relaxed text-center md:text-left">
          Leosigra membantu keteraturan finansial pribadi. Bukan saran investasi personal dan bukan janji keuntungan.
        </p>
      </div>
    </div>
  </footer>
);
