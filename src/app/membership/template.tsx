// Template (bukan layout) di-mount ulang tiap pindah halaman, jadi animasi
// masuk halaman diputar setiap navigasi. Animasinya CSS murni yang berakhir
// di transform/filter "none" supaya modal (position: fixed) di dalam halaman
// tetap menempel ke layar.
export default function MembershipTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter print:animate-none">{children}</div>;
}
