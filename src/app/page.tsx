"use client";

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BarChart3, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFeatures } from '@/components/LandingFeatures';
import { LandingFooter } from '@/components/LandingFooter';
import { motion } from 'framer-motion';

const fadeInUp: any = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" }
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.15 } },
  viewport: { once: true }
};

export default function LandingPage() {
  return (
    <div id="beranda" className="min-h-screen bg-background text-foreground selection:bg-indigo-500/10 scroll-mt-20">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          {/* Left Content */}
          <motion.div 
            className="flex-1 text-left"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
              Layanan Keuangan Terintegrasi
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-black tracking-tight mb-6 sm:mb-8 text-slate-900 leading-[1.1] sm:leading-[1.1]">
              Member Site <br /> Premium <span className="text-slate-400 font-light">|</span> SPT <br /> Tahunan Otomatis
            </h1>
            <p className="max-w-xl text-slate-500 text-base sm:text-lg mb-8 sm:mb-12 font-medium leading-relaxed">
              Manajemen finansial personal dengan fitur terlengkap mulai dari rekap bulanan, kalkulasi pajak, hingga portfolio investasi dalam satu dashboard bersih.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <Link href="/auth/register" className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-navy text-white font-black text-base hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-2xl shadow-navy/20 active:scale-95">
                Mulai Sekarang <ArrowRight size={20} />
              </Link>
              <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black text-base hover:bg-slate-50 transition-all active:scale-95">
                Hubungi Kami
              </button>
            </div>
            
            {/* Quick Stats Point */}
            <div className="mt-16 flex flex-wrap gap-4">
              {['Akurat', 'Cepat', 'Efisien', 'Terpantau'].map((tag) => (
                <div key={tag} className="px-5 py-2.5 rounded-full bg-slate-100/50 border border-slate-200/50 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-colors cursor-default">
                  {tag}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Content - Dashboard Mockup */}
          <motion.div 
            className="flex-1 w-full relative mt-12 lg:mt-0"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative rounded-[32px] sm:rounded-[48px] bg-slate-100 p-2 sm:p-3 shadow-2xl shadow-slate-200 border border-white">
              <div className="bg-white rounded-[28px] sm:rounded-[40px] overflow-hidden shadow-inner border border-slate-100 p-4 sm:p-8 space-y-6 sm:space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Balance</p>
                    <h3 className="text-3xl font-black text-slate-900 leading-none">Rp 84,2jt</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <BarChart3 size={24} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Income</p>
                    <p className="text-lg font-black text-slate-900">Rp 12,4jt</p>
                  </div>
                  <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Savings</p>
                    <p className="text-lg font-black text-slate-900">82%</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="h-40 bg-indigo-600 rounded-3xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-700 to-indigo-500" />
                    <div className="absolute inset-0 flex items-end p-6 gap-2">
                      {[40, 70, 45, 90, 65, 80].map((h, i) => (
                        <div key={i} className="flex-1 bg-white/20 rounded-t-lg transition-all group-hover:bg-white/40" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="p-5 rounded-3xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-8">
                      <Image 
                        src="/images/Logo-new.png" 
                        alt="Leosiqra Logo" 
                        width={40} 
                        height={40} 
                      />
                      <span className="font-bold text-slate-800 tracking-tight">Leosiqra</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Anda berhasil menabung 12% lebih banyak.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating Accents */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-600/5 blur-[80px] rounded-full" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-orange-600/5 blur-[80px] rounded-full" />
          </motion.div>
        </div>
      </section>

      <LandingFeatures />

      {/* Steps Section */}
      <section id="cara-kerja" className="py-32 px-6 scroll-mt-20 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-20">
          <motion.div 
            className="text-center space-y-6"
            {...fadeInUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest">
              Cara Mulai
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-black text-slate-900 mx-auto max-w-2xl leading-tight">
              Mulai dalam tiga langkah yang terasa natural.
            </h2>
          </motion.div>
          <motion.div 
            className="grid md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { step: '01', title: 'Set akun gratis', desc: 'Daftar dalam 1 menit tanpa perlu kartu kredit atau biaya apapun.' },
              { step: '02', title: 'Transaksi seperlunya', desc: 'Input data pengeluaran harian atau mingguan Anda secara cepat.' },
              { step: '03', title: 'Pantau rekap', desc: 'Biarkan sistem menyimpulkan kondisi finansial tahunan Anda.' },
            ].map((s, i) => (
              <motion.div 
                key={i} 
                className="p-10 rounded-[48px] bg-white border border-slate-100 space-y-6 shadow-sm hover:shadow-xl transition-shadow duration-500"
                variants={fadeInUp}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg">
                  {s.step}
                </div>
                <h4 className="text-xl font-black text-slate-900">{s.title}</h4>
                <p className="text-slate-500 font-medium leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 px-6 bg-slate-50/50 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-20">
          <motion.div 
            className="text-center space-y-6"
            {...fadeInUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
              Testimoni
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-black text-slate-900 mx-auto max-w-3xl leading-tight">
              Rasa profesional yang membuat pengguna percaya untuk mulai.
            </h2>
          </motion.div>
          <motion.div 
            className="grid md:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { name: 'Bambang Sudjatmiko', role: 'Business Owner', quote: 'Dulu saya rekap di Excel dan sangat berantakan. Sekarang semua di dashboard.' },
              { name: 'Siti Aminah', role: 'Freelancer', quote: 'Tampilan bersih dan fitur SPT benar-benar membantu saat lapor pajak tahunan.' },
              { name: 'Andi Pratama', role: 'Karyawan Swasta', quote: 'Saya bisa pantau tabungan pensiun saya tumbuh perlahan namun pasti.' },
            ].map((t, i) => (
              <motion.div 
                key={i} 
                className="p-10 rounded-[40px] bg-white border border-slate-100 flex flex-col justify-between shadow-sm hover:border-indigo-100 transition-colors duration-500"
                variants={fadeInUp}
              >
                <p className="text-lg font-medium text-slate-600 mb-8 italic">"{t.quote}"</p>
                <div>
                  <h4 className="font-black text-slate-900">{t.name}</h4>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing CTA Section */}
      <section id="harga" className="py-32 px-6 scroll-mt-20 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 items-center">
          <motion.div 
            className="flex-1 space-y-8"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest">
              Harga
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-black text-slate-900 leading-tight">
              Mulai gratis. Upgrade <br /> saat produk sudah <br /> menjadi kebiasaan.
            </h2>
            <p className="text-slate-500 font-medium leading-relaxed max-w-md">
              Akses fitur dasar secara gratis selamanya. Butuh analisis mendalam dan fitur SPT otomatis? Bergabunglah dengan Pro Plan kami.
            </p>
          </motion.div>
          <motion.div 
            className="flex-1 w-full p-12 rounded-[56px] bg-white border border-slate-100 shadow-2xl shadow-slate-200 space-y-10"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-between pb-8 border-b border-slate-100">
              <div>
                <p className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-1">Trial Version</p>
                <h4 className="text-4xl font-black text-slate-900">Rp 0 <span className="text-sm text-slate-400">/ selamanya</span></h4>
              </div>
              <div className="px-5 py-2 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">EFEKTIF</div>
            </div>
            <ul className="space-y-4">
              {['Rekap Bulanan', 'Limited Categories', 'Dashboard Ringkasan', 'Mobile Friendly'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-500 font-medium">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/auth/register" className="block w-full py-5 rounded-2xl bg-navy text-white text-center font-black hover:bg-slate-800 transition-all shadow-xl shadow-navy/20">
              Mulai Sekarang
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="keamanan" className="py-32 px-6 bg-navy text-white overflow-hidden relative scroll-mt-20">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-20 items-center">
          <motion.div 
            className="flex-1 space-y-8 relative z-10"
            {...fadeInUp}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest">
              Visi Kami
            </div>
            <h2 className="text-4xl md:text-6xl font-serif font-black leading-tight">
              Transparan sejak awal, <br /> supaya trust terasa <br /> dewasa.
            </h2>
          </motion.div>
          <motion.div 
            className="flex-1 grid gap-6 relative z-10"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { title: 'Data Keamanan', desc: 'Kami menggunakan enkripsi standar bank untuk memastikan data personal Anda tidak tersentuh pihak ketiga.' },
              { title: 'Infrastruktur Modern', desc: 'Berjalan di Google Cloud untuk memastikan reliabilitas dan kecepatan akses kapanpun.' },
            ].map((item, i) => (
              <motion.div 
                key={i} 
                className="p-10 rounded-[48px] bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all"
                variants={fadeInUp}
              >
                <h4 className="text-xl font-black mb-3">{item.title}</h4>
                <p className="text-indigo-200/70 font-medium leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
        {/* Subtle background graphics */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
      </section>

      {/* Final CTA Full */}
      <section className="py-20 sm:py-40 px-6 relative overflow-hidden">
        <motion.div 
          className="max-w-4xl mx-auto rounded-[48px] sm:rounded-[80px] bg-gradient-to-b from-white to-slate-50 border border-slate-100 p-8 sm:p-16 md:p-24 text-center space-y-6 sm:space-y-8 relative z-10 shadow-2xl shadow-slate-200/50"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-[#FCF8F1] text-[#B8926A] text-[10px] font-black uppercase tracking-[0.2em] border border-[#F5E6CF]/50 mx-auto">
            START TODAY
          </div>
          <h2 className="text-4xl md:text-6xl font-serif font-black text-slate-900 leading-[1.1] tracking-tight">
            Mulai lebih rapi mengelola <br /> keuangan pribadi hari ini.
          </h2>
          <p className="text-slate-500 font-medium max-w-[540px] mx-auto leading-relaxed text-[15px]">
            Buat akun gratis dan lihat kondisi finansial Anda dalam tampilan yang lebih jelas, modern, dan tenang.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/auth/register" className="w-full sm:w-auto px-10 py-5 rounded-[20px] bg-navy text-white font-black hover:bg-slate-800 transition-all shadow-xl shadow-navy/20 active:scale-95">
              Daftar Gratis
            </Link>
            <Link href="/auth/login" className="w-full sm:w-auto px-10 py-5 rounded-[20px] bg-white border border-slate-100 text-slate-900 font-black hover:bg-slate-50 transition-all shadow-sm active:scale-95">
              Masuk
            </Link>
          </div>
        </motion.div>
        
        {/* Decorative background blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] pointer-events-none opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100/30 blur-[120px] rounded-full" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-100/30 blur-[120px] rounded-full" />
          <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-emerald-50/20 blur-[120px] rounded-full" />
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}
