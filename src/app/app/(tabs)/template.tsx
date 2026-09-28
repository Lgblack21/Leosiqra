// Diputar ulang tiap pindah tab/halaman di aplikasi mobile — transisi halus
// tanpa blur supaya tetap ringan di HP.
export default function TabsTemplate({ children }: { children: React.ReactNode }) {
  return <div className="tab-enter">{children}</div>;
}
