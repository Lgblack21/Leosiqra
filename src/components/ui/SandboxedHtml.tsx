// Menampilkan HTML buatan admin (halaman maintenance) di iframe ber-sandbox.
// Tanpa `allow-scripts` browser tidak menjalankan JavaScript apa pun di dalamnya,
// dan tanpa `allow-same-origin` iframe punya origin unik — tidak bisa membaca
// cookie/sesi atau memanggil API Leosiqra. Ini lapisan utama; sanitasi di Worker
// (sanitizeMaintenanceHtml) cuma lapisan cadangan, karena sanitasi berbasis
// regex selalu bisa ditembus (mis. atribut on* tanpa tanda kutip).
// allow-popups(-to-escape-sandbox): link di halaman maintenance (mis. WhatsApp)
// tetap bisa dibuka di tab baru.
export function SandboxedHtml({ html, title, className }: { html: string; title: string; className?: string }) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}
