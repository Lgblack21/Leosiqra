// Olahragaku — isi statis 20 metode diet (bahasa awam). Lihat docs/rancangan/olahragaku.md bagian 4.
// Teks ini bukan nasihat medis; kunci kondisi kesehatan ada di rules.ts.

import type { Metode, MetodeKey } from './types';

export const METODE: Metode[] = [
  // 1
  {
    key: 'isi-piringku',
    nama: 'Isi Piringku',
    kelompok: 'tanpa-hitung',
    tingkat: 'pemula',
    hitungKalori: false,
    emoji: '🍽️',
    ringkas: 'Atur isi piring ala Kemenkes: separuh sayur dan buah, separuh nasi dan lauk.',
    caraKerja: [
      'Isi Piringku adalah panduan makan dari Kementerian Kesehatan. Bayangkan piringmu dibagi dua: setengahnya sayur dan buah (sayur lebih banyak dari buah), setengahnya lagi makanan pokok dan lauk pauk (makanan pokok sedikit lebih banyak dari lauk).',
      'Kamu tidak perlu menghitung kalori. Cukup lihat piringmu setiap kali makan. Karena sayur mengambil banyak tempat, porsi nasi otomatis jadi lebih kecil dari biasanya, tapi perut tetap terasa penuh.',
      'Panduan ini juga mengajak kamu banyak minum air putih, membatasi gula, garam, dan minyak, serta tetap bergerak setiap hari.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Nasi putih 1/2 centong, telur dadar, tumis kangkung, pisang 1 buah' },
      { jam: '10.00', isi: 'Pepaya potong 1 mangkuk kecil' },
      { jam: '12.30', isi: 'Nasi merah 1/2 centong, ikan kembung bakar, sayur bening bayam, tempe bacem 1 potong' },
      { jam: '16.00', isi: 'Jeruk 1 buah atau segenggam kacang rebus' },
      { jam: '19.00', isi: 'Nasi 1/2 centong, ayam suwir, tahu kukus, sayur sop banyak sayurnya' },
    ],
    kelebihan: [
      'Mudah dipahami, tidak perlu timbangan atau aplikasi kalori',
      'Pakai makanan rumahan sehari-hari, tidak perlu beli bahan khusus',
      'Aman untuk hampir semua orang, cocok sebagai langkah pertama',
      'Membentuk kebiasaan makan sayur yang bertahan lama',
    ],
    tantangan: [
      'Hasil turun berat biasanya lebih pelan daripada metode yang lebih ketat',
      'Makan di warung atau acara keluarga sering susah mengatur isi piring',
      'Kalau gorengan dan santan tetap banyak, hasilnya bisa kurang terasa',
    ],
    hasilRealistis:
      'Kalau porsi nasi dan gorengan berkurang secara konsisten, penurunan sekitar 0,25–0,5 kg per minggu itu wajar. Hasil tiap orang beda, tergantung porsi awal, aktivitas, dan kebiasaan ngemil.',
    bilaMungkin:
      'Mulai dari satu kali makan per hari dulu (misalnya makan siang) dengan piring setengah sayur. Setelah dua minggu terasa biasa, terapkan ke makan malam, lalu ke semua waktu makan.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup makan sayur setiap kali makan besar, minimal setengah piring?',
        inti: true,
        bilaTidak: 'Inti metode ini adalah setengah piring sayur dan buah. Tanpa itu, isi piring tidak berubah banyak.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu bisa mengurangi porsi nasi jadi lebih kecil dari biasanya?',
        inti: true,
        bilaTidak: 'Porsi makanan pokok yang lebih kecil adalah sumber utama berkurangnya asupan di metode ini.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa mengatur sendiri isi piringmu sebagian besar hari (masak sendiri atau pilih lauk sendiri)?',
        inti: false,
        bilaTidak:
          'Tetap bisa dicoba, tapi kamu perlu pintar memilih menu di warung, misalnya minta sayur lebih banyak dan nasi setengah.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Menurut Isi Piringku, setengah piring sebaiknya diisi apa?',
        pilihan: ['Nasi dan lauk goreng', 'Sayur dan buah', 'Lauk pauk saja'],
        benar: 1,
        penjelasan:
          'Setengah piring diisi sayur dan buah, dengan sayur lebih banyak dari buah. Setengah lainnya untuk makanan pokok dan lauk.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Mana yang lebih sesuai dengan Isi Piringku?',
        pilihan: [
          'Minum air putih dan batasi gula, garam, minyak',
          'Ganti semua makan malam dengan jus buah',
          'Tidak makan nasi sama sekali',
        ],
        benar: 0,
        penjelasan:
          'Isi Piringku tidak melarang nasi. Panduannya mengajak minum air putih dan membatasi gula, garam, dan minyak.',
      },
    ],
    alternatif: ['porsi-tangan', 'makan-sadar'],
  },
  // 2
  {
    key: 'porsi-tangan',
    nama: 'Porsi Tangan',
    kelompok: 'tanpa-hitung',
    tingkat: 'pemula',
    hitungKalori: false,
    emoji: '✋',
    ringkas: 'Ukur porsi pakai tanganmu sendiri, tanpa timbangan dan tanpa hitung kalori.',
    caraKerja: [
      'Tanganmu dipakai sebagai alat ukur porsi. Untuk sekali makan: lauk protein (ayam, ikan, tempe, telur) seukuran telapak tangan, sayur sebesar satu sampai dua kepalan, nasi atau karbo sebanyak satu genggam tangan yang ditangkupkan, dan minyak atau lemak kira-kira seukuran ibu jari.',
      'Ukuran tangan biasanya ikut ukuran badan, jadi porsinya otomatis menyesuaikan. Laki-laki umumnya boleh dua kali lipat porsi perempuan untuk tiap bagian.',
      'Kalau berat tidak turun setelah dua sampai tiga minggu, kurangi sedikit, misalnya setengah genggam nasi di makan malam.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Segenggam nasi uduk porsi kecil, telur rebus 1, timun dan kemangi' },
      { jam: '12.00', isi: 'Segenggam nasi, ayam bakar seukuran telapak, dua kepalan capcay' },
      { jam: '15.30', isi: 'Satu kepalan buah, misalnya jambu biji atau semangka' },
      { jam: '19.00', isi: 'Segenggam nasi merah, tempe dan tahu seukuran telapak, tumis buncis' },
    ],
    kelebihan: [
      'Alat ukurnya selalu dibawa ke mana-mana',
      'Tidak perlu aplikasi, timbangan, atau label gizi',
      'Gampang dipakai saat makan di luar atau kondangan',
      'Mengajarkan susunan makan yang seimbang',
    ],
    tantangan: [
      'Tidak setepat menimbang, jadi hasil bisa lebih lambat',
      'Makanan bersantan atau gorengan sulit diukur minyaknya',
      'Perlu beberapa hari untuk terbiasa mengira-ngira',
    ],
    hasilRealistis:
      'Kalau porsi sebelumnya cukup besar, penurunan sekitar 0,25–0,5 kg per minggu itu wajar di bulan-bulan awal. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan mengukur nasi dan lauk saja selama dua minggu. Setelah terbiasa, tambahkan aturan sayur dua kepalan dan batasi minyak.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu mau memperhatikan porsi tiap kali makan, walaupun cuma kira-kira pakai tangan?',
        inti: true,
        bilaTidak: 'Metode ini sepenuhnya bergantung pada kebiasaan melihat dan mengira porsi.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu sanggup berhenti di satu genggam nasi, walaupun masih ada nasi di meja?',
        inti: true,
        bilaTidak: 'Kalau nasi tetap tambah terus, porsi tangan tidak akan mengubah asupan harianmu.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu suka atau mau belajar makan sayur di hampir setiap makan?',
        inti: false,
        bilaTidak:
          'Masih bisa jalan, tapi tanpa sayur kamu lebih cepat lapar. Coba mulai dari sayur yang kamu suka, misalnya sayur sop atau lalapan.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Porsi lauk protein seperti ayam atau tempe kira-kira seukuran apa?',
        pilihan: ['Ujung jari', 'Seluruh piring', 'Telapak tangan'],
        benar: 2,
        penjelasan: 'Satu porsi lauk protein kira-kira seukuran dan setebal telapak tanganmu.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kalau setelah tiga minggu berat tidak berubah, apa langkah yang masuk akal?',
        pilihan: [
          'Kurangi sedikit porsi karbo, misalnya setengah genggam',
          'Berhenti makan malam sama sekali',
          'Tambah porsi lauk goreng',
        ],
        benar: 0,
        penjelasan: 'Penyesuaian kecil lebih aman dan lebih mudah dijalani daripada perubahan drastis.',
      },
    ],
    alternatif: ['isi-piringku', 'makan-sadar'],
  },
  // 3
  {
    key: 'makan-sadar',
    nama: 'Makan Sadar',
    kelompok: 'tanpa-hitung',
    tingkat: 'pemula',
    hitungKalori: false,
    emoji: '🧘',
    ringkas: 'Makan pelan, tanpa layar, dan berhenti saat kenyang, bukan saat piring habis.',
    caraKerja: [
      'Makan sadar (mindful eating) berarti benar-benar memperhatikan saat makan: rasa, tekstur, dan sinyal lapar atau kenyang dari tubuhmu.',
      'Caranya sederhana: makan tanpa sambil main HP atau nonton, kunyah lebih lama, letakkan sendok di sela suapan, dan beri waktu sekitar 15–20 menit untuk satu kali makan. Sinyal kenyang dari tubuh butuh waktu untuk terasa.',
      'Sebelum makan atau ngemil, tanya diri sendiri: aku lapar beneran, atau cuma bosan, capek, atau stres? Kalau bukan lapar, coba minum air atau jalan sebentar dulu.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Bubur ayam porsi biasa tanpa kerupuk, dimakan pelan tanpa HP' },
      { jam: '12.00', isi: 'Nasi, pecel sayur, tempe goreng 1, dimakan duduk minimal 15 menit' },
      { jam: '15.30', isi: 'Pisang 1 buah, cek dulu apakah benar lapar' },
      { jam: '19.00', isi: 'Nasi porsi kecil, ikan pindang, sayur asem, berhenti saat terasa cukup' },
    ],
    kelebihan: [
      'Tidak ada makanan yang dilarang',
      'Membantu mengurangi makan karena emosi atau kebiasaan',
      'Cocok digabung dengan metode lain',
      'Membangun hubungan yang lebih tenang dengan makanan',
    ],
    tantangan: [
      'Penurunan berat biasanya pelan dan tidak selalu terlihat cepat',
      'Butuh latihan mengenali rasa kenyang, terutama kalau terbiasa makan cepat',
      'Sulit dijalankan kalau jam makan sangat terburu-buru',
    ],
    hasilRealistis:
      'Fokus metode ini kebiasaan, bukan angka cepat. Banyak orang turun pelan, sekitar 0,25–0,5 kg per minggu atau kadang lebih lambat. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dari satu kali makan per hari tanpa layar selama dua minggu. Setelah itu tambahkan kebiasaan menaruh sendok di sela suapan.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu bisa meluangkan sekitar 15–20 menit untuk makan, minimal sekali sehari?',
        inti: true,
        bilaTidak: 'Makan sadar butuh waktu supaya sinyal kenyang sempat terasa sebelum porsi habis.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu mau makan tanpa HP atau TV setidaknya di satu waktu makan?',
        inti: false,
        bilaTidak: 'Masih bisa dicoba, tapi layar membuat kita mudah tidak sadar sudah makan seberapa banyak.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu siap berhenti makan saat sudah cukup kenyang, walau masih ada sisa di piring?',
        inti: true,
        bilaTidak: 'Ini inti metodenya. Coba ambil porsi lebih kecil dari awal supaya tidak merasa sayang membuang.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Kenapa makan pelan dianjurkan?',
        pilihan: [
          'Supaya makanan lebih cepat dicerna',
          'Karena sinyal kenyang butuh waktu untuk terasa',
          'Supaya bisa makan lebih banyak',
        ],
        benar: 1,
        penjelasan:
          'Rasa kenyang butuh waktu sampai terasa. Makan pelan memberi kesempatan tubuh memberi tahu kalau sudah cukup.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kamu tiba-tiba ingin ngemil saat sedang stres kerja. Apa langkah makan sadar?',
        pilihan: [
          'Langsung makan supaya tenang',
          'Tidak boleh makan apa pun sampai besok',
          'Berhenti sebentar dan cek apakah ini lapar beneran atau karena stres',
        ],
        benar: 2,
        penjelasan:
          'Makan sadar tidak melarang ngemil, tapi mengajak mengenali dulu apakah dorongannya dari lapar atau dari emosi.',
      },
    ],
    alternatif: ['isi-piringku', 'porsi-tangan'],
  },
  // 4
  {
    key: 'kurangi-gula',
    nama: 'Kurangi Gula',
    kelompok: 'tanpa-hitung',
    tingkat: 'pemula',
    hitungKalori: false,
    emoji: '🍬',
    ringkas: 'Pangkas gula tambahan dari minuman dan jajanan manis, tanpa mengubah semua menu.',
    caraKerja: [
      'Banyak kalori tersembunyi datang dari gula tambahan: teh manis, kopi susu kekinian, minuman kemasan, sirup, kue, dan martabak manis. Metode ini fokus memangkas sumber-sumber itu.',
      'Kemenkes menganjurkan gula tidak lebih dari sekitar 50 gram (kira-kira 4 sendok makan) per hari, termasuk yang ada di minuman dan makanan kemasan. Satu gelas minuman manis bisa sudah mendekati batas itu.',
      'Turunkan bertahap: kurangi gula di teh atau kopi sedikit demi sedikit, ganti minuman manis dengan air putih atau teh tawar, dan biasakan membaca label gula di kemasan.',
    ],
    contohHari: [
      { jam: '06.30', isi: 'Teh tawar hangat, roti gandum isi telur' },
      { jam: '10.00', isi: 'Air putih dan salak atau jeruk 1 buah' },
      { jam: '12.30', isi: 'Nasi, ayam goreng tanpa kulit, sayur lodeh, es teh tawar' },
      { jam: '16.00', isi: 'Kopi tanpa gula atau gula 1/2 sendok teh, kacang rebus' },
      { jam: '19.00', isi: 'Nasi, ikan bumbu kuning, tumis sawi, buah pepaya sebagai pencuci mulut' },
    ],
    kelebihan: [
      'Satu perubahan yang dampaknya terasa ke total asupan harian',
      'Tidak perlu mengubah lauk dan nasi',
      'Lidah biasanya terbiasa dengan rasa kurang manis dalam beberapa minggu',
      'Hemat, karena minuman manis kekinian cukup mahal',
    ],
    tantangan: [
      'Gula tersembunyi ada di banyak produk, perlu rajin baca label',
      'Beberapa hari awal sering terasa ingin yang manis',
      'Kalau gula diganti gorengan, hasilnya bisa tidak terasa',
    ],
    hasilRealistis:
      'Kalau sebelumnya sering minum minuman manis, mengurangi itu saja bisa membantu turun sekitar 0,25–0,5 kg per minggu di awal. Kalau asupan gulamu memang sudah rendah, efeknya lebih kecil. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan satu hal: ganti satu minuman manis per hari dengan air putih atau teh tawar selama dua minggu, lalu kurangi gula di kopi atau teh setengahnya.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup mengganti sebagian besar minuman manis dengan air putih atau teh/kopi tawar?',
        inti: true,
        bilaTidak: 'Minuman manis biasanya sumber gula tambahan terbesar, jadi ini langkah paling penting.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu mau membaca label gizi di kemasan sebelum membeli jajanan atau minuman?',
        inti: false,
        bilaTidak: 'Masih bisa jalan, tapi gula tersembunyi di produk kemasan bisa lolos tanpa disadari.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu siap menahan keinginan makan manis di minggu-minggu awal?',
        inti: false,
        bilaTidak:
          'Keinginan manis biasanya mereda setelah beberapa minggu. Turunkan pelan-pelan supaya tidak terlalu berat.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Anjuran Kemenkes untuk batas gula per hari kira-kira berapa?',
        pilihan: ['Sekitar 4 sendok makan', 'Sekitar 15 sendok makan', 'Tidak ada batas'],
        benar: 0,
        penjelasan:
          'Anjurannya sekitar 50 gram atau kira-kira 4 sendok makan per hari, termasuk gula di minuman dan makanan kemasan.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Mana pengganti yang paling tepat untuk es teh manis?',
        pilihan: ['Jus buah kemasan', 'Es teh tawar atau air putih', 'Minuman soda'],
        benar: 1,
        penjelasan: 'Jus kemasan dan soda umumnya tetap tinggi gula. Teh tawar atau air putih tidak menambah gula.',
      },
    ],
    alternatif: ['minim-olahan', 'isi-piringku'],
  },
  // 5
  {
    key: 'minim-olahan',
    nama: 'Minim Makanan Olahan',
    kelompok: 'tanpa-hitung',
    tingkat: 'pemula',
    hitungKalori: false,
    emoji: '🥬',
    ringkas: 'Pilih makanan segar dan masakan rumah, kurangi mi instan, sosis, dan camilan kemasan.',
    caraKerja: [
      'Makanan olahan pabrik seperti mi instan, sosis, nugget, kerupuk kemasan, dan camilan ringan biasanya dibuat supaya enak dan bikin nagih, tapi sering tinggi garam, gula, dan minyak serta kurang mengenyangkan.',
      'Di metode ini kamu tidak menghitung apa pun. Kamu cukup memilih bahan yang masih mirip bentuk aslinya: beras, telur, tempe, tahu, ikan, ayam, sayur, buah, umbi-umbian, dan kacang.',
      'Tidak harus nol. Targetnya sebagian besar makanan harianmu berasal dari bahan segar, dan makanan olahan jadi sesekali saja.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Ubi rebus 1 potong sedang, telur rebus 2, teh tawar' },
      { jam: '12.00', isi: 'Nasi, pepes ikan, tumis kacang panjang, tempe goreng 1' },
      { jam: '15.30', isi: 'Pisang atau segenggam kacang tanah rebus' },
      { jam: '19.00', isi: 'Nasi merah porsi kecil, sup ayam sayuran, sambal tomat' },
    ],
    kelebihan: [
      'Lebih mengenyangkan karena makanan segar umumnya lebih berserat',
      'Asupan garam dan gula ikut turun',
      'Mendorong kebiasaan masak sendiri yang lebih hemat',
      'Tidak perlu hitung-hitungan',
    ],
    tantangan: [
      'Butuh waktu untuk masak atau mencari warung yang menyediakan masakan rumahan',
      'Makanan olahan lebih praktis saat sibuk',
      'Masakan rumah tetap bisa tinggi minyak kalau banyak digoreng',
    ],
    hasilRealistis:
      'Kalau sebelumnya banyak makan makanan instan dan camilan kemasan, penurunan sekitar 0,25–0,5 kg per minggu itu wajar. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan mengganti satu kebiasaan, misalnya mi instan malam hari diganti telur dan sayur, selama dua minggu. Setelah itu kurangi camilan kemasan.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu punya akses ke masakan rumah atau warung masakan sederhana di sebagian besar hari?',
        inti: true,
        bilaTidak:
          'Tanpa akses makanan segar, metode ini akan sulit karena pilihan yang tersisa kebanyakan makanan olahan.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu sanggup mengurangi mi instan dan camilan kemasan jadi sesekali saja?',
        inti: true,
        bilaTidak: 'Mengurangi makanan olahan adalah inti dari metode ini.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu mau meluangkan waktu menyiapkan bekal atau masak sederhana beberapa kali seminggu?',
        inti: false,
        bilaTidak: 'Masih bisa, asalkan kamu memilih warung atau katering yang menyediakan lauk dan sayur segar.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Mana yang termasuk makanan minim olahan?',
        pilihan: ['Nugget ayam beku', 'Mi instan', 'Tempe dan telur rebus'],
        benar: 2,
        penjelasan:
          'Tempe dan telur masih dekat dengan bentuk aslinya. Nugget dan mi instan sudah melewati banyak proses pabrik.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Apakah metode ini mengharuskan nol makanan olahan?',
        pilihan: [
          'Ya, sama sekali tidak boleh',
          'Tidak, sebagian besar dari bahan segar dan olahan sesekali saja',
          'Tidak, asal makannya pagi hari',
        ],
        benar: 1,
        penjelasan: 'Targetnya realistis: sebagian besar makanan dari bahan segar, bukan larangan total.',
      },
    ],
    alternatif: ['kurangi-gula', 'isi-piringku'],
  },
  // 6
  {
    key: 'defisit-seimbang',
    nama: 'Defisit Kalori Seimbang',
    kelompok: 'hitung-kalori',
    tingkat: 'pemula',
    hitungKalori: true,
    emoji: '⚖️',
    ringkas: 'Makan sedikit di bawah kebutuhan harianmu dengan menu seimbang, tanpa larangan ketat.',
    caraKerja: [
      'Berat badan turun kalau energi yang masuk lebih sedikit dari energi yang dipakai tubuh. Di metode ini aplikasi memperkirakan kebutuhan harianmu dari profil, lalu memberi target sekitar 300–500 kkal di bawahnya.',
      'Semua jenis makanan boleh, asalkan total hariannya masuk target. Supaya tidak cepat lapar, utamakan lauk berprotein, sayur, dan karbo yang mengenyangkan seperti nasi merah atau ubi.',
      'Target tidak dibuat terlalu rendah. Makan terlalu sedikit justru bikin lemas, gampang kalap, dan susah dipertahankan. Aplikasi punya batas bawah yang aman.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Nasi 1/2 centong, telur ceplok minyak sedikit, tumis sawi (sekitar 300 kkal)' },
      { jam: '10.00', isi: 'Pepaya 1 potong besar (sekitar 60 kkal)' },
      { jam: '12.30', isi: 'Gado-gado porsi biasa dengan bumbu kacang sedikit, tanpa kerupuk (sekitar 400 kkal)' },
      { jam: '16.00', isi: 'Susu rendah lemak 1 gelas atau yogurt tawar (sekitar 100 kkal)' },
      { jam: '19.00', isi: 'Nasi 1/2 centong, ikan bakar, sayur bening, tahu kukus (sekitar 400 kkal)' },
    ],
    kelebihan: [
      'Prinsipnya paling terbukti untuk menurunkan berat badan',
      'Tidak ada makanan yang benar-benar dilarang',
      'Mudah disesuaikan kalau berat berhenti turun',
      'Kamu belajar mengenali kalori makanan sehari-hari',
    ],
    tantangan: [
      'Perlu mencatat makanan, terutama di minggu-minggu awal',
      'Angka kalori masakan rumahan hanya perkiraan',
      'Bisa terasa melelahkan kalau terlalu terobsesi dengan angka',
    ],
    hasilRealistis:
      'Kalau defisit konsisten, penurunan sekitar 0,5–1 kg per minggu itu wajar. Minggu pertama kadang turun lebih banyak karena air, lalu melambat. Hasil tiap orang beda.',
    bilaMungkin:
      'Dua minggu pertama cukup catat makanan tanpa mengubah apa pun, supaya kamu tahu pola makanmu. Setelah itu baru mulai mengikuti target kalori.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup mencatat makanan di aplikasi hampir setiap hari?',
        inti: true,
        bilaTidak: 'Tanpa pencatatan, kamu tidak bisa tahu apakah asupanmu sudah di bawah kebutuhan.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu siap merasa sedikit lapar di jam-jam tertentu, terutama di minggu awal?',
        inti: false,
        bilaTidak:
          'Sedikit lapar itu wajar saat defisit. Kalau ini berat, perbanyak sayur dan protein supaya lebih kenyang.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu mau menimbang atau mengira porsi makanan supaya catatannya cukup akurat?',
        inti: false,
        bilaTidak: 'Masih bisa jalan dengan perkiraan kasar, tapi hasil mungkin kurang sesuai target.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Apa yang membuat berat badan turun di metode ini?',
        pilihan: [
          'Makan hanya di pagi hari',
          'Tidak makan nasi sama sekali',
          'Energi yang masuk lebih sedikit dari yang dipakai tubuh',
        ],
        benar: 2,
        penjelasan: 'Kuncinya defisit energi secara konsisten. Jenis dan jam makan boleh fleksibel.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kenapa target kalori sebaiknya tidak dibuat sangat rendah?',
        pilihan: [
          'Karena bikin lemas, gampang kalap, dan sulit bertahan lama',
          'Karena berat malah langsung naik keesokan harinya',
          'Karena tidak ada bedanya sama sekali',
        ],
        benar: 0,
        penjelasan:
          'Defisit yang terlalu besar sulit dipertahankan dan bisa membuat tubuh kekurangan gizi. Defisit sedang lebih awet.',
      },
    ],
    alternatif: ['porsi-tangan', 'isi-piringku'],
  },
  // 7
  {
    key: 'tinggi-protein',
    nama: 'Tinggi Protein',
    kelompok: 'hitung-kalori',
    tingkat: 'menengah',
    hitungKalori: true,
    emoji: '🍗',
    ringkas: 'Defisit kalori dengan protein lebih banyak supaya lebih kenyang dan otot terjaga.',
    caraKerja: [
      'Ini tetap metode defisit kalori, tapi porsi protein dinaikkan. Protein membuat kenyang lebih lama dan membantu menjaga otot saat berat badan turun, apalagi kalau dibarengi latihan kekuatan.',
      'Patokan umumnya sekitar 1,2–1,6 gram protein per kilogram berat badan target per hari. Aplikasi menghitungnya dari profilmu. Sumber lokal yang terjangkau: telur, tempe, tahu, ikan, ayam, susu, dan kacang-kacangan.',
      'Usahakan ada lauk protein di setiap kali makan, lalu lengkapi dengan sayur dan karbo secukupnya sampai total kalori harian masuk target.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Telur rebus 2, nasi 1/2 centong, tumis buncis' },
      { jam: '10.00', isi: 'Susu rendah lemak 1 gelas atau tahu bakso kukus' },
      { jam: '12.30', isi: 'Nasi 1/2 centong, dada ayam bakar, tempe bacem 1, sayur asem' },
      { jam: '16.00', isi: 'Kacang edamame rebus 1 mangkuk kecil' },
      { jam: '19.00', isi: 'Ikan tongkol suwir, tahu kukus, sayur sop, nasi sedikit' },
    ],
    kelebihan: [
      'Biasanya lebih tahan lapar dibanding defisit biasa',
      'Membantu menjaga otot, terutama kalau rutin latihan',
      'Sumber protein lokal banyak dan murah',
      'Tetap fleksibel soal jenis makanan',
    ],
    tantangan: [
      'Perlu mencatat makanan dan memperhatikan gram protein',
      'Lauk protein bisa menambah biaya belanja',
      'Protein yang digoreng atau bersantan bisa membuat kalori ikut naik',
    ],
    hasilRealistis:
      'Kalau defisit konsisten, penurunan sekitar 0,5–1 kg per minggu itu wajar, dengan otot yang lebih terjaga. Hasil tiap orang beda.',
    bilaMungkin:
      'Dua minggu pertama cukup pastikan ada lauk protein di tiap makan tanpa hitung gram. Setelah terbiasa, mulai catat protein dan kalori di aplikasi.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup mencatat makanan dan jumlah protein hampir setiap hari?',
        inti: true,
        bilaTidak: 'Metode ini butuh pencatatan supaya target protein dan kalori sama-sama tercapai.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu bisa makan lauk protein (telur, tempe, tahu, ikan, ayam) di setiap kali makan?',
        inti: true,
        bilaTidak: 'Tanpa protein di tiap makan, target harian akan sulit tercapai.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Anggaran belanjamu cukup untuk menambah lauk protein, minimal telur dan tempe?',
        inti: false,
        bilaTidak: 'Masih bisa dengan sumber murah seperti telur, tempe, tahu, dan ikan pindang.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Kenapa protein dinaikkan saat diet?',
        pilihan: [
          'Supaya lebih kenyang dan otot lebih terjaga',
          'Supaya bisa makan gorengan sebanyak-banyaknya',
          'Karena protein tidak mengandung kalori',
        ],
        benar: 0,
        penjelasan: 'Protein tetap mengandung kalori, tapi membantu rasa kenyang dan menjaga otot saat berat turun.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Mana sumber protein yang paling hemat kalori?',
        pilihan: ['Ayam goreng tepung dengan kulit', 'Tahu kukus atau ikan bakar', 'Rendang bersantan'],
        benar: 1,
        penjelasan:
          'Cara masak berpengaruh besar. Dikukus, direbus, atau dibakar lebih rendah kalori daripada digoreng atau bersantan.',
      },
    ],
    alternatif: ['defisit-seimbang', 'porsi-tangan'],
  },
  // 8
  {
    key: 'volume-eating',
    nama: 'Volume Eating',
    kelompok: 'hitung-kalori',
    tingkat: 'pemula',
    hitungKalori: true,
    emoji: '🥗',
    ringkas: 'Makan porsi yang tetap besar dengan memilih makanan rendah kalori tapi mengenyangkan.',
    caraKerja: [
      'Banyak orang berhenti diet karena porsinya terasa terlalu sedikit. Volume eating memakai makanan yang banyak mengandung air dan serat, seperti sayur, buah, dan sup, sehingga piring tetap penuh tapi kalorinya lebih rendah.',
      'Contohnya, semangkuk besar sayur sop atau sepiring tumis sayur kalorinya jauh lebih kecil daripada segenggam kerupuk atau gorengan. Jadi kamu bisa makan lebih banyak tapi tetap defisit.',
      'Tetap ada target kalori dari aplikasi. Bedanya, kamu sengaja mengisi sebagian besar porsi dengan makanan yang ringan kalori.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Bubur nasi encer porsi besar dengan suwiran ayam dan sayur, tanpa kerupuk' },
      { jam: '10.00', isi: 'Semangka atau melon 1 mangkuk besar' },
      { jam: '12.30', isi: 'Nasi 1/2 centong, sayur sop 1 mangkuk besar, ikan kukus, lalapan' },
      { jam: '16.00', isi: 'Timun dan bengkuang potong dengan sambal rujak sedikit' },
      { jam: '19.00', isi: 'Pecel sayur porsi besar dengan bumbu kacang sedikit, tempe bakar, nasi sedikit' },
    ],
    kelebihan: [
      'Piring tetap penuh, jadi tidak terasa sedang diet',
      'Serat dan air membantu kenyang lebih lama',
      'Asupan sayur dan buah naik banyak',
      'Cocok untuk yang suka makan banyak',
    ],
    tantangan: [
      'Harus suka atau mau belajar makan banyak sayur',
      'Perut bisa kembung di awal kalau serat naik terlalu cepat',
      'Saus, bumbu kacang, dan minyak tetap perlu dibatasi',
    ],
    hasilRealistis:
      'Kalau target kalori terpenuhi secara konsisten, penurunan sekitar 0,5–1 kg per minggu itu wajar. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan menambah satu mangkuk sayur di makan siang dan malam selama dua minggu, sambil mengurangi nasi sedikit. Setelah itu baru ikuti target kalori.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu suka atau mau makan sayur dalam porsi besar setiap hari?',
        inti: true,
        bilaTidak: 'Sayur adalah bahan utama volume eating. Tanpa itu, porsi besar akan tinggi kalori.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu sanggup mencatat makanan di aplikasi hampir setiap hari?',
        inti: true,
        bilaTidak: 'Metode ini tetap memakai target kalori, jadi pencatatan diperlukan.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa mengurangi kerupuk, gorengan, dan saus kental di samping makanan?',
        inti: false,
        bilaTidak:
          'Masih bisa, tapi pelengkap ini kalorinya padat, jadi porsinya perlu kecil supaya tetap masuk target.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Mana yang paling cocok dengan prinsip volume eating?',
        pilihan: ['Segenggam kerupuk', 'Semangkuk besar sayur sop', 'Martabak telur sepotong'],
        benar: 1,
        penjelasan: 'Sayur sop banyak air dan serat, jadi porsinya besar tapi kalorinya rendah.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kalau serat naik tiba-tiba dan perut kembung, apa yang sebaiknya dilakukan?',
        pilihan: [
          'Berhenti makan sayur sama sekali',
          'Minum minuman bersoda',
          'Naikkan sayur pelan-pelan dan perbanyak air putih',
        ],
        benar: 2,
        penjelasan: 'Tubuh butuh waktu menyesuaikan dengan serat. Naikkan bertahap dan cukupi minum air.',
      },
    ],
    alternatif: ['defisit-seimbang', 'isi-piringku'],
  },
  // 9
  {
    key: 'rendah-karbo',
    nama: 'Rendah Karbo (moderat)',
    kelompok: 'hitung-kalori',
    tingkat: 'menengah',
    hitungKalori: true,
    emoji: '🍚',
    ringkas: 'Kurangi nasi, roti, dan gula secara moderat, ganti dengan sayur dan lauk berprotein.',
    caraKerja: [
      'Metode ini mengurangi karbohidrat seperti nasi, mi, roti, dan gula, tapi tidak sampai seketat keto. Nasi tetap boleh, hanya porsinya kecil, misalnya seperempat sampai setengah porsi biasa.',
      'Ruang yang tadinya diisi nasi diganti sayur dan lauk berprotein. Banyak orang merasa lebih mudah mengontrol nafsu makan dengan cara ini, walaupun pada akhirnya yang menentukan turunnya berat tetap total kalori.',
      'Karena itu kamu tetap mencatat kalori di aplikasi. Pilih karbo yang lebih berserat seperti nasi merah, ubi, jagung, atau kentang rebus.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Telur dadar sayur 2 butir, tahu kukus, teh tawar' },
      { jam: '12.00', isi: 'Nasi merah 1/4 centong, ayam bakar, tumis kangkung, lalapan' },
      { jam: '15.30', isi: 'Kacang tanah rebus segenggam atau jambu biji 1 buah' },
      { jam: '19.00', isi: 'Ikan pepes, tempe bakar, sayur bening bayam porsi besar, ubi rebus 1 potong kecil' },
    ],
    kelebihan: [
      'Banyak orang merasa nafsu makan lebih terkendali',
      'Mengurangi gula dan tepung yang sering jadi sumber kalori berlebih',
      'Tidak seketat keto, nasi masih boleh sedikit',
      'Lauk dan sayur jadi bintang utama di piring',
    ],
    tantangan: [
      'Kebiasaan makan nasi banyak di Indonesia membuat awal terasa berat',
      'Bisa lemas atau pusing di beberapa hari pertama',
      'Lauk dan minyak tetap harus dijaga supaya kalori tidak naik',
    ],
    hasilRealistis:
      'Minggu pertama berat sering turun lebih cepat, sebagian besar air. Setelah itu, dengan defisit konsisten, sekitar 0,5–1 kg per minggu itu wajar. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan mengurangi nasi jadi setengah porsi dan berhenti minuman manis selama dua minggu, baru turunkan lagi ke seperempat porsi kalau terasa nyaman.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup makan nasi hanya seperempat sampai setengah porsi biasa?',
        inti: true,
        bilaTidak: 'Pengurangan nasi dan karbo adalah inti metode ini.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu bisa menambah sayur dan lauk sebagai pengganti nasi di piring?',
        inti: true,
        bilaTidak: 'Tanpa pengganti, kamu akan cepat lapar dan sulit bertahan.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu siap kalau beberapa hari awal terasa sedikit lemas atau kurang bertenaga?',
        inti: false,
        bilaTidak: 'Ini biasanya hanya di awal. Turunkan karbo lebih pelan supaya tubuh sempat menyesuaikan.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Kamu sanggup mencatat makanan di aplikasi hampir setiap hari?',
        inti: false,
        bilaTidak: 'Masih bisa jalan, tapi tanpa catatan kalori bisa tetap tinggi dari lauk dan minyak.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Berat turun cepat di minggu pertama rendah karbo. Itu sebagian besar karena apa?',
        pilihan: ['Semua lemak hilang dalam seminggu', 'Otot bertambah', 'Air yang keluar dari tubuh'],
        benar: 2,
        penjelasan:
          'Saat karbo berkurang, tubuh melepas simpanan air. Setelah itu penurunan melambat ke kisaran normal.',
      },
      {
        id: 'q6',
        jenis: 'paham',
        teks: 'Apa beda rendah karbo moderat dengan keto?',
        pilihan: [
          'Tidak ada bedanya',
          'Rendah karbo moderat masih boleh nasi sedikit, keto sangat membatasi karbo',
          'Keto boleh makan nasi lebih banyak',
        ],
        benar: 1,
        penjelasan: 'Rendah karbo moderat lebih longgar. Keto membatasi karbo sangat ketat.',
      },
    ],
    alternatif: ['kurangi-gula', 'defisit-seimbang'],
  },
  // 10
  {
    key: 'jendela-12-12',
    nama: 'Jendela Makan 12:12',
    kelompok: 'puasa',
    tingkat: 'pemula',
    hitungKalori: false,
    jendela: { puasa: 12, makan: 12 },
    emoji: '🕖',
    ringkas: 'Makan dalam 12 jam, misalnya 07.00–19.00, lalu berhenti ngemil di malam hari.',
    caraKerja: [
      'Kamu makan dalam rentang 12 jam, lalu tidak makan selama 12 jam berikutnya. Contohnya makan mulai 07.00 dan selesai 19.00. Sebagian besar waktu puasanya terjadi saat tidur.',
      'Manfaat utamanya sederhana: kebiasaan ngemil larut malam terpotong. Camilan malam sering jadi sumber kalori yang tidak disadari.',
      'Saat jendela tutup, kamu tetap boleh minum air putih, teh tawar, atau kopi tanpa gula. Di dalam jendela, tetap makan dengan porsi wajar.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Nasi 1/2 centong, telur rebus, tumis sayur' },
      { jam: '10.00', isi: 'Buah pepaya atau pisang' },
      { jam: '12.30', isi: 'Nasi, ayam goreng tanpa kulit, sayur lodeh, tempe 1' },
      { jam: '16.00', isi: 'Kacang rebus atau jagung rebus' },
      { jam: '18.30', isi: 'Nasi porsi kecil, ikan bakar, sayur bening. Setelah 19.00 hanya air putih' },
    ],
    kelebihan: [
      'Paling ringan di antara metode puasa, cocok untuk mulai',
      'Memotong kebiasaan ngemil malam',
      'Tidak perlu hitung kalori',
      'Bisa jadi tangga menuju jendela yang lebih pendek',
    ],
    tantangan: [
      'Efek ke berat badan kecil kalau porsi dalam jendela tetap besar',
      'Acara malam seperti kumpul keluarga bisa melewati jam tutup',
      'Kalau tidur larut, rasa lapar malam lebih terasa',
    ],
    hasilRealistis:
      'Efeknya terutama dari berkurangnya camilan malam. Kalau itu memang kebiasaanmu, penurunan sekitar 0,25–0,5 kg per minggu itu wajar. Kalau tidak, hasilnya mungkin kecil. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan berhenti makan jam 20.00 selama dua minggu, lalu majukan ke 19.00 supaya jadi 12:12 penuh.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup tidak makan apa pun setelah jam makan malam terakhir sampai pagi?',
        inti: true,
        bilaTidak: 'Inti metode ini adalah 12 jam tanpa makan, terutama memotong camilan malam.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Jadwal harianmu cukup teratur supaya jam makan pertama dan terakhir bisa tetap?',
        inti: false,
        bilaTidak:
          'Masih bisa. Geser jendela sesuai jadwalmu, yang penting jarak makan terakhir ke makan pertama 12 jam.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa menolak camilan atau minuman manis di acara malam setelah jendela tutup?',
        inti: false,
        bilaTidak: 'Sesekali tidak apa-apa. Kalau sering, geser jendela supaya acara malam masih di dalamnya.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Saat jendela makan tutup, minuman apa yang boleh?',
        pilihan: ['Air putih, teh atau kopi tanpa gula', 'Jus buah', 'Teh manis'],
        benar: 0,
        penjelasan: 'Minuman tanpa gula tidak membatalkan puasa. Jus dan teh manis mengandung kalori.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kalau jendelamu 07.00–19.00, kapan makan terakhirmu?',
        pilihan: ['Jam 21.00', 'Sebelum jam 19.00', 'Jam berapa pun asal sedikit'],
        benar: 1,
        penjelasan: 'Makan terakhir harus selesai sebelum jendela tutup, yaitu sebelum 19.00.',
      },
    ],
    alternatif: ['makan-sadar', 'isi-piringku'],
  },
  // 11
  {
    key: 'jendela-14-10',
    nama: 'Jendela Makan 14:10',
    kelompok: 'puasa',
    tingkat: 'pemula',
    hitungKalori: false,
    jendela: { puasa: 14, makan: 10 },
    emoji: '🕘',
    ringkas: 'Makan dalam 10 jam, misalnya 09.00–19.00, dan puasa 14 jam termasuk saat tidur.',
    caraKerja: [
      'Kamu makan dalam rentang 10 jam dan tidak makan selama 14 jam. Contohnya sarapan jam 09.00 dan makan terakhir sebelum 19.00.',
      'Jendela yang lebih pendek biasanya membuat jumlah waktu makan dan ngemil berkurang sendiri, sehingga asupan harian ikut turun tanpa harus menghitung.',
      'Saat jendela tutup, boleh minum air putih, teh tawar, atau kopi tanpa gula. Di dalam jendela, makan seperti biasa dengan menu seimbang, bukan balas dendam.',
    ],
    contohHari: [
      { jam: '09.00', isi: 'Nasi 1/2 centong, telur dadar, tumis kacang panjang' },
      { jam: '12.30', isi: 'Gado-gado tanpa kerupuk, tempe bakar 1' },
      { jam: '15.30', isi: 'Pisang atau jeruk 1 buah' },
      { jam: '18.30', isi: 'Nasi porsi kecil, ikan pindang, sayur asem. Setelah 19.00 hanya air putih' },
    ],
    kelebihan: [
      'Masih cukup ringan untuk pemula',
      'Mengurangi kesempatan ngemil tanpa hitung kalori',
      'Pola mirip dengan kebiasaan banyak orang yang sarapan agak siang',
      'Langkah persiapan yang baik sebelum 16:8',
    ],
    tantangan: [
      'Pagi hari bisa terasa lapar di minggu pertama',
      'Kalau porsi di jendela membesar, hasilnya bisa tertahan',
      'Perlu menyesuaikan dengan jam kerja dan acara',
    ],
    hasilRealistis:
      'Kalau jendela yang lebih pendek membuat asupanmu berkurang, penurunan sekitar 0,25–0,5 kg per minggu itu wajar. Hasil tiap orang beda.',
    bilaMungkin: 'Mulai dari 12:12 selama dua minggu, lalu mundurkan sarapan satu jam setiap minggu sampai jadi 14:10.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup tidak makan dari 19.00 sampai 09.00 pagi (atau rentang 14 jam lain yang sesuai)?',
        inti: true,
        bilaTidak: 'Rentang 14 jam tanpa makan adalah inti metode ini.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu bisa menunda sarapan beberapa jam tanpa merasa terlalu lemas?',
        inti: false,
        bilaTidak: 'Kalau pagi sering lemas, majukan jendelanya, misalnya 07.00–17.00, atau mulai dari 12:12 dulu.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Jam kerjamu memungkinkan kamu makan di jam yang kurang lebih sama setiap hari?',
        inti: false,
        bilaTidak: 'Masih bisa, tapi jendela yang sering berubah membuat tubuh lebih sulit menyesuaikan.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Saat jendela tutup, mana yang boleh diminum?',
        pilihan: ['Susu kental manis', 'Kopi susu gula aren', 'Kopi hitam tanpa gula'],
        benar: 2,
        penjelasan: 'Kopi hitam tanpa gula hampir tanpa kalori. Minuman dengan susu atau gula mengandung kalori.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kenapa jendela makan bisa membantu menurunkan berat?',
        pilihan: [
          'Karena makanan di jam tertentu tidak berkalori',
          'Karena waktu makan dan ngemil jadi lebih sedikit sehingga asupan ikut turun',
          'Karena puasa langsung membakar lemak di bagian tertentu',
        ],
        benar: 1,
        penjelasan: 'Jendela makan membatasi kesempatan makan. Hasilnya tetap bergantung pada total yang kamu makan.',
      },
    ],
    alternatif: ['jendela-12-12', 'isi-piringku'],
  },
  // 12
  {
    key: 'jendela-16-8',
    nama: 'Jendela Makan 16:8',
    kelompok: 'puasa',
    tingkat: 'menengah',
    hitungKalori: false,
    jendela: { puasa: 16, makan: 8 },
    emoji: '🕛',
    ringkas: 'Makan dalam 8 jam, misalnya 12.00–20.00, lalu puasa 16 jam termasuk saat tidur.',
    caraKerja: [
      'Kamu makan dalam rentang 8 jam dan tidak makan selama 16 jam. Pola yang paling umum: makan pertama jam 12.00 dan makan terakhir sebelum 20.00. Artinya sarapan dilewati.',
      'Dengan dua sampai tiga kali makan dalam 8 jam, biasanya total asupan harian jadi lebih kecil. Tapi kalau di dalam jendela kamu makan berlebihan, hasilnya bisa hilang.',
      'Saat jendela tutup, minum air putih, teh tawar, atau kopi tanpa gula. Makan pertama sebaiknya lengkap dengan protein dan sayur supaya tidak kalap.',
    ],
    contohHari: [
      { jam: '12.00', isi: 'Nasi 1/2 centong, ayam bakar, tumis sayur, tempe 1' },
      { jam: '15.30', isi: 'Buah semangka atau pepaya, segenggam kacang rebus' },
      { jam: '17.00', isi: 'Teh tawar dan tahu kukus 2 potong' },
      { jam: '19.30', isi: 'Nasi porsi kecil, ikan kukus, sayur bening, tahu. Setelah 20.00 hanya air putih' },
    ],
    kelebihan: [
      'Salah satu pola puasa yang paling banyak dijalani orang',
      'Tidak perlu hitung kalori kalau porsi di jendela wajar',
      'Hemat waktu karena hanya dua sampai tiga kali makan',
      'Cocok untuk yang memang jarang lapar di pagi hari',
    ],
    tantangan: [
      'Pagi sampai siang bisa terasa lapar dan sulit fokus di minggu awal',
      'Godaan kalap saat jendela dibuka',
      'Kurang cocok untuk kerja shift atau jadwal yang berubah-ubah',
      'Sarapan bersama keluarga jadi terlewat',
    ],
    hasilRealistis:
      'Kalau total asupan memang turun, penurunan sekitar 0,5–1 kg per minggu itu wajar. Penelitian umumnya menunjukkan hasilnya mirip dengan defisit kalori biasa. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan 14:10 selama dua minggu dulu. Kalau sudah nyaman, mundurkan makan pertama satu jam per minggu sampai jadi 16:8.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup tidak makan dari 20.00 sampai 12.00 siang (atau rentang 16 jam lain)?',
        inti: true,
        bilaTidak: 'Puasa 16 jam adalah inti metode ini.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Jam kerjamu tetap di siang hari, bukan shift malam atau berganti-ganti?',
        inti: false,
        bilaTidak:
          'Kerja shift membuat jendela makan sering bergeser. Masih bisa dicoba dengan jendela yang mengikuti jam bangunmu, tapi lebih menantang.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu jarang merasa lemas atau gemetar kalau telat makan?',
        inti: false,
        bilaTidak:
          'Kalau sering lemas saat telat makan, mulai dari jendela yang lebih panjang seperti 12:12 atau 14:10.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Kamu bisa makan dengan porsi wajar saat jendela dibuka, tidak balas dendam?',
        inti: true,
        bilaTidak: 'Kalau porsi di jendela berlebihan, puasa 16 jam tidak akan membantu menurunkan berat.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Saat jendela tutup, minuman apa yang boleh?',
        pilihan: ['Jus buah tanpa gula tambahan', 'Teh manis', 'Air putih, teh atau kopi tanpa gula'],
        benar: 2,
        penjelasan: 'Jus buah tetap mengandung gula alami dan kalori. Pilih air putih atau minuman tanpa gula.',
      },
      {
        id: 'q6',
        jenis: 'paham',
        teks: 'Jendela makan 12.00–20.00. Mana yang sesuai aturan?',
        pilihan: ['Makan malam jam 19.30', 'Ngemil roti jam 22.00', 'Sarapan bubur jam 07.00'],
        benar: 0,
        penjelasan: 'Semua makan harus di antara 12.00 dan 20.00. Di luar itu hanya minuman tanpa kalori.',
      },
    ],
    alternatif: ['jendela-14-10', 'jendela-12-12'],
  },
  // 13
  {
    key: 'jendela-18-6',
    nama: 'Jendela Makan 18:6',
    kelompok: 'puasa',
    tingkat: 'lanjut',
    hitungKalori: false,
    jendela: { puasa: 18, makan: 6 },
    emoji: '🕐',
    ringkas: 'Makan dalam 6 jam, misalnya 12.00–18.00. Untuk yang sudah terbiasa 16:8.',
    caraKerja: [
      'Kamu makan dalam rentang 6 jam dan tidak makan selama 18 jam. Contohnya makan pertama 12.00 dan makan terakhir sebelum 18.00.',
      'Biasanya hanya muat dua kali makan dan satu camilan. Karena waktunya sempit, setiap makan harus lengkap: lauk protein, sayur, dan karbo secukupnya, supaya gizi harian tetap cukup.',
      'Metode ini ditujukan untuk orang yang sudah nyaman dengan 16:8. Saat jendela tutup, minum air putih, teh tawar, atau kopi tanpa gula.',
    ],
    contohHari: [
      { jam: '12.00', isi: 'Nasi 1/2 centong, ikan bakar, tempe, tumis kangkung, buah pisang' },
      { jam: '14.30', isi: 'Telur rebus 1 dan jeruk 1 buah' },
      { jam: '16.00', isi: 'Segenggam kacang rebus dan air putih' },
      { jam: '17.30', isi: 'Nasi porsi kecil, ayam suwir, tahu kukus, sayur sop. Setelah 18.00 hanya air putih' },
    ],
    kelebihan: [
      'Kesempatan makan sangat terbatas, jadi ngemil berkurang banyak',
      'Tidak perlu hitung kalori kalau porsinya wajar',
      'Jadwal makan jadi sederhana',
    ],
    tantangan: [
      'Lapar lebih terasa, terutama di pagi hari',
      'Sulit memenuhi kebutuhan protein dan sayur dalam waktu sempit',
      'Makan malam bersama keluarga sering di luar jendela',
      'Kurang cocok untuk kerja fisik berat di pagi hari',
    ],
    hasilRealistis:
      'Kalau total asupan turun dan konsisten, penurunan sekitar 0,5–1 kg per minggu itu wajar. Jendela yang lebih sempit tidak otomatis membuat hasil jauh lebih cepat. Hasil tiap orang beda.',
    bilaMungkin:
      'Jalani 16:8 dengan nyaman minimal dua minggu dulu. Setelah itu majukan makan terakhir 30–60 menit per minggu sampai jendela tinggal 6 jam.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sudah pernah menjalani 16:8 dengan nyaman minimal dua minggu?',
        inti: true,
        bilaTidak: '18:6 sebaiknya dijalani setelah terbiasa 16:8, supaya tubuh tidak kaget.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu sanggup selesai makan sebelum sore (misalnya 18.00) hampir setiap hari?',
        inti: true,
        bilaTidak: 'Jendela 6 jam berarti makan malam harus lebih awal dari kebanyakan orang.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa memastikan setiap kali makan ada lauk protein dan sayur?',
        inti: false,
        bilaTidak:
          'Dengan waktu makan sempit, menu yang kurang lengkap bisa membuat gizi harian kurang. Perlu perencanaan menu.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Pekerjaanmu tidak menuntut kerja fisik berat di pagi hari?',
        inti: false,
        bilaTidak: 'Kerja fisik berat saat perut kosong lama bisa melelahkan. Pertimbangkan 16:8 atau 14:10.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Apakah jendela yang lebih sempit selalu membuat berat turun lebih cepat?',
        pilihan: [
          'Ya, makin sempit makin cepat',
          'Tidak, yang menentukan tetap total asupan dan konsistensi',
          'Ya, asal minum kopi',
        ],
        benar: 1,
        penjelasan:
          'Jendela hanya alat bantu. Hasil tetap bergantung pada total yang dimakan dan seberapa konsisten kamu.',
      },
    ],
    alternatif: ['jendela-16-8', 'jendela-14-10'],
  },
  // 14
  {
    key: 'jendela-20-4',
    nama: 'Jendela Makan 20:4',
    kelompok: 'puasa',
    tingkat: 'lanjut',
    hitungKalori: false,
    jendela: { puasa: 20, makan: 4 },
    emoji: '🕓',
    ringkas: 'Makan hanya dalam 4 jam, misalnya 14.00–18.00. Ketat, untuk yang sudah berpengalaman.',
    caraKerja: [
      'Kamu makan dalam rentang 4 jam dan tidak makan selama 20 jam. Contohnya makan pertama 14.00 dan makan terakhir sebelum 18.00.',
      'Dalam 4 jam biasanya hanya muat satu makan besar dan satu makan kecil. Karena itu menu harus benar-benar lengkap dan bergizi, bukan sekadar kenyang.',
      'Metode ini berat dan tidak cocok untuk semua orang. Sebaiknya hanya dijalani setelah nyaman dengan 16:8 dan 18:6. Saat jendela tutup, minum air putih, teh tawar, atau kopi tanpa gula.',
    ],
    contohHari: [
      { jam: '14.00', isi: 'Nasi 1 centong, ikan bakar, tempe, tahu, sayur asem porsi besar, lalapan' },
      { jam: '15.00', isi: 'Buah pepaya dan pisang' },
      { jam: '16.15', isi: 'Segenggam kacang rebus dan teh tawar' },
      { jam: '17.30', isi: 'Telur rebus 2, sayur sop. Setelah 18.00 hanya air putih' },
    ],
    kelebihan: [
      'Jadwal makan sangat sederhana',
      'Kesempatan ngemil hampir tidak ada',
      'Bagi sebagian orang yang sudah terbiasa, terasa praktis',
    ],
    tantangan: [
      'Lapar panjang, bisa sulit fokus dan mudah marah di awal',
      'Sangat sulit memenuhi kebutuhan gizi dalam 4 jam',
      'Risiko kalap saat jendela dibuka cukup tinggi',
      'Sulit dijalankan bersama keluarga dan acara sosial',
    ],
    hasilRealistis:
      'Kalau total asupan turun dan konsisten, penurunan sekitar 0,5–1 kg per minggu itu wajar. Jendela 4 jam tidak menjamin hasil lebih cepat dibanding 16:8 dengan asupan yang sama. Hasil tiap orang beda.',
    bilaMungkin:
      'Jangan langsung lompat. Jalani 16:8 lalu 18:6 masing-masing minimal dua minggu, baru coba 20:4 beberapa hari per minggu dulu.',
    catatan: 'Di Indonesia, pola mirip ini dipopulerkan lewat program OCD.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sudah nyaman menjalani 18:6 atau minimal 16:8 selama beberapa minggu?',
        inti: true,
        bilaTidak: 'Langsung puasa 20 jam tanpa latihan sebelumnya berat dan mudah gagal.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu sanggup tidak makan dari 18.00 sampai 14.00 hari berikutnya?',
        inti: true,
        bilaTidak: 'Puasa 20 jam adalah inti metode ini.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa menyiapkan menu lengkap (protein, sayur, karbo, buah) di jendela 4 jam itu?',
        inti: true,
        bilaTidak: 'Tanpa menu lengkap, gizi harian akan kurang karena waktu makan sangat terbatas.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Kamu jarang merasa lemas, gemetar, atau pusing kalau telat makan?',
        inti: false,
        bilaTidak: 'Kalau sering begitu, jendela yang lebih panjang seperti 16:8 lebih aman untukmu.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Apa yang paling penting saat jendela 4 jam dibuka?',
        pilihan: [
          'Makan lengkap dan bergizi dengan porsi wajar',
          'Makan sebanyak-banyaknya karena sudah lama puasa',
          'Cukup minum kopi lalu tidur',
        ],
        benar: 0,
        penjelasan: 'Waktu makan yang sempit justru menuntut menu yang lengkap, bukan porsi yang berlebihan.',
      },
      {
        id: 'q6',
        jenis: 'paham',
        teks: 'Selama 20 jam puasa, apa yang boleh dikonsumsi?',
        pilihan: ['Camilan sedikit saja', 'Air putih, teh atau kopi tanpa gula', 'Susu dan jus'],
        benar: 1,
        penjelasan: 'Hanya minuman tanpa kalori. Camilan, susu, dan jus sudah membuka jendela makan.',
      },
    ],
    alternatif: ['jendela-18-6', 'jendela-16-8'],
  },
  // 15
  {
    key: 'puasa-5-2',
    nama: 'Puasa 5:2',
    kelompok: 'puasa',
    tingkat: 'lanjut',
    hitungKalori: true,
    emoji: '📅',
    ringkas: 'Lima hari makan normal, dua hari tidak berurutan makan sangat sedikit (±500–600 kkal).',
    caraKerja: [
      'Dalam seminggu, lima hari kamu makan normal dengan porsi wajar. Dua hari lainnya, yang tidak berurutan (misalnya Senin dan Kamis), kamu makan sangat sedikit: sekitar 500 kkal untuk perempuan dan 600 kkal untuk laki-laki.',
      'Di hari puasa, kalori itu bisa dibagi jadi satu atau dua kali makan, dengan fokus pada protein dan sayur supaya lebih tahan lapar. Minum air putih yang cukup.',
      'Di lima hari normal, jangan balas dendam. Kalau hari normal jadi berlebihan, defisit dari dua hari puasa bisa hilang. Karena itu kamu tetap perlu mencatat kalori.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Hari puasa: teh tawar atau kopi tanpa gula, air putih' },
      { jam: '12.00', isi: 'Hari puasa: telur rebus 2, sayur bening bayam, timun (sekitar 200 kkal)' },
      { jam: '16.00', isi: 'Hari puasa: jambu biji atau pepaya 1 potong (sekitar 60 kkal)' },
      { jam: '18.30', isi: 'Hari puasa: ikan kukus, tahu kukus, tumis sayur sedikit minyak (sekitar 250 kkal)' },
    ],
    kelebihan: [
      'Lima hari dalam seminggu makan seperti biasa',
      'Hari puasa bisa dipilih sesuai jadwal',
      'Cocok untuk yang lebih mudah ketat sebentar daripada sedikit setiap hari',
    ],
    tantangan: [
      'Hari puasa terasa berat, bisa lemas dan sulit konsentrasi',
      'Mudah kalap di hari setelah puasa',
      'Perlu mencatat kalori dengan cukup teliti di hari puasa',
      'Kurang cocok kalau hari kerjamu menuntut tenaga besar',
    ],
    hasilRealistis:
      'Kalau hari normal tidak berlebihan, penurunan sekitar 0,5–1 kg per minggu itu wajar, mirip dengan defisit harian biasa. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan satu hari puasa per minggu di sekitar 800 kkal selama dua minggu, lalu turunkan ke 500–600 kkal, dan baru setelah itu jadi dua hari tidak berurutan.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup makan hanya sekitar 500–600 kkal di dua hari dalam seminggu?',
        inti: true,
        bilaTidak: 'Dua hari makan sangat sedikit adalah inti metode ini.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Ada dua hari dalam seminggu yang aktivitasnya cukup ringan untuk dijadikan hari puasa?',
        inti: false,
        bilaTidak:
          'Hari puasa saat kerja fisik berat bisa sangat melelahkan. Pertimbangkan defisit harian yang lebih ringan.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa makan dengan porsi wajar di hari setelah puasa, tidak balas dendam?',
        inti: true,
        bilaTidak: 'Makan berlebihan di hari normal bisa menghapus defisit dari hari puasa.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Kamu mau mencatat kalori, terutama di hari puasa?',
        inti: false,
        bilaTidak: 'Tanpa catatan, mudah melewati batas 500–600 kkal tanpa sadar.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Bagaimana memilih dua hari puasa yang benar?',
        pilihan: ['Dua hari berturut-turut', 'Dua hari yang tidak berurutan', 'Hari mana saja, bahkan tiap hari'],
        benar: 1,
        penjelasan: 'Dua hari puasa dibuat tidak berurutan, misalnya Senin dan Kamis, supaya tubuh sempat pulih.',
      },
    ],
    alternatif: ['defisit-seimbang', 'jendela-14-10'],
  },
  // 16
  {
    key: 'omad',
    nama: 'OMAD (Sekali Makan Sehari)',
    kelompok: 'puasa',
    tingkat: 'lanjut',
    hitungKalori: false,
    jendela: { puasa: 23, makan: 1 },
    emoji: '🍱',
    ringkas: 'Makan sekali sehari dalam satu jam. Paling ketat, hanya untuk yang sudah berpengalaman.',
    caraKerja: [
      'OMAD (one meal a day) berarti kamu makan hanya sekali sehari dalam rentang sekitar satu jam, lalu tidak makan selama 23 jam.',
      'Karena hanya sekali, makanan itu harus memenuhi kebutuhan gizi seharian: lauk protein yang cukup, banyak sayur, karbo, buah, dan sedikit lemak sehat. Ini tidak mudah.',
      'Metode ini paling berat di antara pola puasa. Banyak orang lebih cocok dengan 16:8 atau 18:6. Kalau mau mencoba, lakukan bertahap dan pantau badanmu. Saat tidak makan, minum air putih, teh tawar, atau kopi tanpa gula.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Air putih, teh atau kopi tanpa gula' },
      { jam: '12.00', isi: 'Air putih yang cukup' },
      {
        jam: '17.00',
        isi: 'Makan lengkap: nasi 1 centong, ikan bakar, tempe, telur, sayur lodeh atau sop porsi besar, lalapan',
      },
      { jam: '17.45', isi: 'Penutup: buah pepaya dan pisang. Setelah 18.00 hanya air putih' },
    ],
    kelebihan: [
      'Jadwal makan paling sederhana',
      'Hampir tidak ada kesempatan ngemil',
      'Bagi sebagian kecil orang yang cocok, terasa praktis',
    ],
    tantangan: [
      'Sangat sulit memenuhi gizi harian dalam sekali makan',
      'Lapar panjang, bisa lemas, pusing, dan sulit fokus',
      'Risiko makan berlebihan saat jam makan tiba',
      'Sulit dijalankan bersama keluarga dan acara sosial',
    ],
    hasilRealistis:
      'Kalau total asupan turun dan konsisten, penurunan sekitar 0,5–1 kg per minggu itu wajar. OMAD tidak terbukti lebih unggul dari defisit kalori biasa dengan asupan yang sama, dan lebih sulit dipertahankan. Hasil tiap orang beda.',
    bilaMungkin:
      'Jangan langsung. Jalani 16:8, lalu 18:6, lalu 20:4 dengan nyaman. Setelah itu coba OMAD satu sampai dua hari per minggu dulu, bukan setiap hari.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sudah nyaman menjalani 20:4 atau 18:6 selama beberapa minggu?',
        inti: true,
        bilaTidak: 'OMAD terlalu berat untuk dimulai tanpa pengalaman puasa yang lebih ringan.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu sanggup menyiapkan satu kali makan yang lengkap dan cukup besar setiap hari?',
        inti: true,
        bilaTidak: 'Dengan sekali makan, menu yang tidak lengkap langsung membuat gizi harian kurang.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu jarang merasa lemas, gemetar, atau pusing kalau lama tidak makan?',
        inti: true,
        bilaTidak: 'Kalau tubuhmu sering bereaksi begitu, puasa 23 jam tidak cocok. Pilih jendela yang lebih panjang.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Pekerjaan dan aktivitas harianmu tidak menuntut tenaga fisik besar?',
        inti: false,
        bilaTidak: 'Kerja fisik berat dengan sekali makan sehari bisa sangat melelahkan.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Apa syarat penting supaya OMAD tidak merugikan tubuh?',
        pilihan: [
          'Makan apa saja asal kenyang',
          'Minum kopi sebanyak mungkin seharian',
          'Satu kali makan itu harus lengkap gizinya',
        ],
        benar: 2,
        penjelasan: 'Sekali makan harus memenuhi kebutuhan protein, sayur, karbo, dan buah seharian.',
      },
    ],
    alternatif: ['jendela-18-6', 'jendela-16-8'],
  },
  // 17
  {
    key: 'mediterania',
    nama: 'Pola Mediterania',
    kelompok: 'pola-makan',
    tingkat: 'pemula',
    hitungKalori: false,
    emoji: '🐟',
    ringkas: 'Banyak sayur, buah, ikan, kacang, dan lemak sehat. Versi lokal pakai tempe dan ikan.',
    caraKerja: [
      'Pola Mediterania meniru kebiasaan makan di negara sekitar Laut Tengah: banyak sayur, buah, kacang-kacangan, biji-bijian utuh, ikan, dan lemak sehat, dengan daging merah dan makanan manis dibatasi.',
      'Pola ini termasuk yang paling banyak diteliti dan dikaitkan dengan kesehatan jantung. Di Indonesia, kamu bisa menerapkannya dengan bahan lokal: ikan laut, tempe, tahu, kacang, sayur, buah, nasi merah, dan minyak secukupnya.',
      'Metode ini bukan program penurunan berat yang ketat. Berat turun kalau porsinya juga terjaga, karena lemak sehat seperti kacang tetap tinggi kalori.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Oatmeal atau roti gandum, pisang, segenggam kacang' },
      { jam: '12.00', isi: 'Nasi merah porsi kecil, ikan kembung bakar, tumis sayur, lalapan' },
      { jam: '15.30', isi: 'Buah jeruk atau apel lokal' },
      { jam: '19.00', isi: 'Pepes tahu dan tempe, sayur bening, sedikit nasi merah' },
    ],
    kelebihan: [
      'Pola makan yang banyak diteliti dan dianggap sehat jangka panjang',
      'Tidak ada makanan yang benar-benar dilarang',
      'Rasa beragam, mudah diadaptasi ke masakan lokal',
      'Cocok untuk dijalani seumur hidup',
    ],
    tantangan: [
      'Penurunan berat bisa pelan kalau porsi tidak dijaga',
      'Ikan laut dan kacang tertentu bisa cukup mahal',
      'Perlu mengurangi gorengan dan daging olahan',
    ],
    hasilRealistis:
      'Kalau porsi terjaga, penurunan sekitar 0,25–0,5 kg per minggu itu wajar. Manfaat utamanya kebiasaan makan yang lebih sehat jangka panjang. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan dua perubahan selama dua minggu: lauk ikan atau tempe lebih sering dari daging merah, dan tambah sayur di tiap makan. Setelah itu ganti nasi putih dengan nasi merah sebagian.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu suka atau mau lebih sering makan ikan, tempe, tahu, dan kacang?',
        inti: true,
        bilaTidak: 'Lauk utama pola ini adalah ikan dan protein nabati.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu bisa makan sayur dan buah setiap hari?',
        inti: true,
        bilaTidak: 'Sayur dan buah adalah dasar pola Mediterania.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa mengurangi gorengan dan daging olahan seperti sosis atau kornet?',
        inti: false,
        bilaTidak: 'Masih bisa dicoba, tapi manfaatnya berkurang kalau gorengan dan daging olahan tetap sering.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Mana lauk yang paling sesuai pola Mediterania versi lokal?',
        pilihan: ['Ikan bakar atau tempe', 'Sosis goreng', 'Daging sapi berlemak setiap hari'],
        benar: 0,
        penjelasan: 'Ikan dan protein nabati seperti tempe diutamakan. Daging merah dan olahan dibatasi.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kacang dan minyak termasuk lemak sehat. Apa yang perlu diingat?',
        pilihan: [
          'Boleh sebanyak-banyaknya karena sehat',
          'Harus dihindari sama sekali',
          'Tetap tinggi kalori, jadi porsinya secukupnya',
        ],
        benar: 2,
        penjelasan: 'Lemak sehat tetap padat kalori. Segenggam kacang sudah cukup sebagai camilan.',
      },
    ],
    alternatif: ['isi-piringku', 'dash'],
  },
  // 18
  {
    key: 'dash',
    nama: 'Pola DASH',
    kelompok: 'pola-makan',
    tingkat: 'pemula',
    hitungKalori: false,
    emoji: '🫀',
    ringkas: 'Pola makan rendah garam, kaya sayur dan buah, awalnya dibuat untuk tekanan darah.',
    caraKerja: [
      'DASH (Dietary Approaches to Stop Hypertension) awalnya dikembangkan lewat penelitian di Amerika Serikat untuk membantu menurunkan tekanan darah. Polanya banyak sayur, buah, biji-bijian utuh, kacang, ikan, ayam, dan susu rendah lemak.',
      'Yang dibatasi: garam, gula, gorengan, daging merah berlemak, dan makanan olahan. Untuk lidah Indonesia, tantangan terbesarnya mengurangi garam, kecap asin, penyedap, ikan asin, dan kerupuk.',
      'DASH bukan program diet ketat, tapi dengan porsi yang terjaga dan lebih banyak sayur, berat badan bisa ikut turun. Kalau kamu punya tekanan darah tinggi, tetap konsultasi dengan dokter dan jangan berhenti minum obat tanpa arahan.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Oatmeal dengan pisang, susu rendah lemak' },
      { jam: '10.00', isi: 'Buah pepaya atau melon' },
      { jam: '12.30', isi: 'Nasi merah, ayam rebus bumbu kunyit sedikit garam, tumis bayam, tempe kukus' },
      { jam: '16.00', isi: 'Kacang hijau rebus tanpa gula atau yogurt tawar' },
      { jam: '19.00', isi: 'Ikan kukus jahe, sayur sop tanpa penyedap, sedikit nasi' },
    ],
    kelebihan: [
      'Dirancang lewat penelitian dan direkomendasikan banyak lembaga kesehatan',
      'Tidak ada makanan pokok yang dilarang',
      'Membiasakan lidah dengan rasa kurang asin',
      'Bisa dijalani bersama keluarga',
    ],
    tantangan: [
      'Masakan Indonesia banyak yang asin dan bergaram tinggi',
      'Perlu mengurangi kerupuk, ikan asin, dan penyedap',
      'Penurunan berat bisa pelan kalau porsi tidak diperhatikan',
    ],
    hasilRealistis:
      'Kalau porsi terjaga, penurunan sekitar 0,25–0,5 kg per minggu itu wajar. Fokus utamanya pola makan sehat jangka panjang, bukan angka cepat. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan mengurangi garam dan penyedap setengahnya selama dua minggu, ganti dengan bumbu rempah seperti bawang, jahe, kunyit, dan jeruk nipis. Setelah itu tambahkan porsi sayur dan buah.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup mengurangi garam, kecap asin, dan penyedap di masakanmu?',
        inti: true,
        bilaTidak: 'Mengurangi garam adalah salah satu inti pola DASH.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu bisa makan sayur dan buah beberapa kali setiap hari?',
        inti: true,
        bilaTidak: 'DASH mengandalkan banyak sayur dan buah di setiap hari.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu mau mengurangi kerupuk, ikan asin, dan camilan asin kemasan?',
        inti: false,
        bilaTidak: 'Masih bisa dicoba, tapi makanan ini menyumbang banyak garam tanpa disadari.',
      },
      {
        id: 'q4',
        jenis: 'paham',
        teks: 'Untuk apa pola DASH awalnya dikembangkan?',
        pilihan: [
          'Untuk membantu menurunkan tekanan darah',
          'Untuk menambah massa otot dengan cepat',
          'Untuk menggantikan obat dari dokter',
        ],
        benar: 0,
        penjelasan:
          'DASH dikembangkan untuk membantu tekanan darah. Pola ini tidak menggantikan obat atau arahan dokter.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Mana cara memberi rasa yang sesuai pola DASH?',
        pilihan: ['Tambah penyedap dan kecap asin', 'Pakai bawang, jahe, kunyit, dan jeruk nipis', 'Tambah ikan asin'],
        benar: 1,
        penjelasan: 'Rempah dan bumbu segar memberi rasa tanpa banyak garam.',
      },
    ],
    alternatif: ['mediterania', 'kurangi-gula'],
  },
  // 19
  {
    key: 'nabati',
    nama: 'Nabati / Vegetarian',
    kelompok: 'pola-makan',
    tingkat: 'menengah',
    hitungKalori: false,
    emoji: '🌱',
    ringkas: 'Lauk utama dari tempe, tahu, kacang, dan sayur. Telur dan susu boleh sesuai pilihanmu.',
    caraKerja: [
      'Di pola nabati, lauk utamamu berasal dari tumbuhan: tempe, tahu, kacang-kacangan, oncom, dan sayur. Versi vegetarian yang umum masih boleh telur dan susu. Versi vegan tidak memakai produk hewani sama sekali.',
      'Indonesia beruntung punya tempe dan tahu yang murah dan kaya protein. Kuncinya memastikan protein cukup di setiap makan dan tidak mengganti daging dengan gorengan atau karbo berlebih.',
      'Kalau memilih vegan sepenuhnya, ada zat gizi yang perlu diperhatikan, terutama vitamin B12, zat besi, dan kalsium. Diskusikan dengan tenaga kesehatan kalau perlu suplemen.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Nasi 1/2 centong, telur dadar sayur, tempe bacem' },
      { jam: '10.00', isi: 'Kacang hijau rebus tanpa gula atau buah' },
      { jam: '12.30', isi: 'Gado-gado lengkap dengan tahu, tempe, telur, bumbu kacang secukupnya' },
      { jam: '16.00', isi: 'Edamame rebus atau susu kedelai tanpa gula' },
      { jam: '19.00', isi: 'Nasi merah porsi kecil, pepes tahu, sayur asem, tumis oncom' },
    ],
    kelebihan: [
      'Kaya serat sehingga lebih mengenyangkan',
      'Sumber protein lokal seperti tempe dan tahu sangat terjangkau',
      'Mendorong makan lebih banyak sayur dan kacang',
      'Bisa dimulai bertahap, tidak harus langsung penuh',
    ],
    tantangan: [
      'Perlu perencanaan supaya protein cukup',
      'Mudah tergelincir ke gorengan dan karbo berlebih',
      'Versi vegan perlu perhatian khusus pada vitamin B12, zat besi, dan kalsium',
      'Makan di luar atau di acara keluarga kadang terbatas pilihannya',
    ],
    hasilRealistis:
      'Kalau porsi terjaga dan tidak banyak gorengan, penurunan sekitar 0,25–0,5 kg per minggu itu wajar. Hasil tiap orang beda.',
    bilaMungkin:
      'Mulai dengan beberapa hari tanpa daging per minggu, misalnya tiga hari, selama dua minggu. Kalau nyaman, tambah harinya sedikit demi sedikit.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu suka atau mau makan tempe, tahu, dan kacang-kacangan hampir setiap hari?',
        inti: true,
        bilaTidak: 'Protein nabati adalah lauk utama di pola ini.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu sanggup tidak makan daging dan ayam di hari-hari yang kamu rencanakan?',
        inti: true,
        bilaTidak: 'Inti metode ini mengganti lauk hewani dengan lauk nabati.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa memasak lauk nabati dengan cara selain digoreng, misalnya dikukus, dibacem, atau dipepes?',
        inti: false,
        bilaTidak: 'Masih bisa, tapi tempe dan tahu goreng menyerap banyak minyak sehingga kalori naik.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Keluarga atau tempat makanmu sehari-hari bisa menyediakan pilihan tanpa daging?',
        inti: false,
        bilaTidak: 'Masih bisa dicoba, tapi kamu perlu lebih banyak menyiapkan makanan sendiri.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Kalau memilih vegan sepenuhnya, zat gizi apa yang paling perlu diperhatikan?',
        pilihan: ['Gula', 'Vitamin B12', 'Garam'],
        benar: 1,
        penjelasan: 'Vitamin B12 hampir hanya ada di produk hewani, jadi vegan biasanya butuh sumber tambahan.',
      },
    ],
    alternatif: ['mediterania', 'isi-piringku'],
  },
  // 20
  {
    key: 'keto',
    nama: 'Keto',
    kelompok: 'pola-makan',
    tingkat: 'lanjut',
    hitungKalori: false,
    emoji: '🥑',
    ringkas: 'Karbo sangat rendah, lemak tinggi. Ketat dan butuh perencanaan, bukan untuk semua orang.',
    caraKerja: [
      'Keto (ketogenik) membatasi karbohidrat sangat ketat, biasanya di bawah sekitar 20–50 gram per hari. Itu berarti nasi, mi, roti, gula, umbi, dan sebagian besar buah hampir dihilangkan. Sebagian besar energi diambil dari lemak, ditambah protein secukupnya.',
      'Saat karbo sangat rendah, tubuh beralih memakai lemak dan membentuk keton sebagai sumber energi. Di awal sering muncul keluhan seperti lemas, pusing, sakit kepala, dan sembelit, yang biasa disebut keto flu.',
      'Berat sering turun cepat di awal, sebagian besar karena air. Dalam jangka panjang hasilnya umumnya mirip diet defisit lain. Bagi yang punya kondisi kesehatan atau rutin minum obat, keto sebaiknya hanya dijalani dengan pengawasan dokter.',
    ],
    contohHari: [
      { jam: '07.00', isi: 'Telur dadar 2 butir dengan bayam, kopi tanpa gula' },
      { jam: '12.00', isi: 'Ayam bakar dengan kulit, tumis kangkung, timun dan selada, tanpa nasi' },
      { jam: '15.30', isi: 'Segenggam kacang tanah sangrai atau alpukat setengah buah tanpa gula' },
      { jam: '19.00', isi: 'Ikan kembung goreng, tahu, tumis buncis dan sawi, sambal tanpa gula' },
    ],
    kelebihan: [
      'Sebagian orang merasa nafsu makan lebih terkendali',
      'Aturannya jelas: hampir tanpa karbo',
      'Penurunan berat di awal cepat terlihat, walau sebagian besar air',
    ],
    tantangan: [
      'Sangat sulit di Indonesia yang makanan pokoknya nasi',
      'Keto flu di minggu awal: lemas, pusing, sembelit',
      'Sulit dipertahankan lama, berat bisa naik lagi saat berhenti',
      'Perlu perhatian dokter bagi yang punya kondisi kesehatan atau minum obat',
    ],
    hasilRealistis:
      'Minggu pertama berat bisa turun lebih cepat karena air. Setelah itu, kalau asupan tetap defisit, sekitar 0,5–1 kg per minggu itu wajar, mirip metode lain. Hasil tiap orang beda.',
    bilaMungkin:
      'Jalani dulu Rendah Karbo moderat selama dua sampai empat minggu. Kalau nyaman dan tidak ada keluhan, baru turunkan karbo ke tingkat keto secara bertahap.',
    pertanyaan: [
      {
        id: 'q1',
        jenis: 'sanggup',
        teks: 'Kamu sanggup hampir tidak makan nasi, mi, roti, dan gula setiap hari?',
        inti: true,
        bilaTidak: 'Keto hanya berjalan kalau karbo benar-benar sangat rendah.',
      },
      {
        id: 'q2',
        jenis: 'sanggup',
        teks: 'Kamu siap menghadapi beberapa hari lemas, pusing, atau sembelit di awal?',
        inti: true,
        bilaTidak: 'Keto flu cukup umum di minggu pertama. Kalau ini berat untukmu, rendah karbo moderat lebih cocok.',
      },
      {
        id: 'q3',
        jenis: 'sanggup',
        teks: 'Kamu bisa menyiapkan menu sendiri, karena makan di luar sulit tanpa nasi?',
        inti: false,
        bilaTidak: 'Masih bisa, tapi pilihan di warung terbatas dan sering tidak sengaja ada gula atau tepung.',
      },
      {
        id: 'q4',
        jenis: 'sanggup',
        teks: 'Kamu mau membaca label dan memeriksa kandungan karbo makanan?',
        inti: false,
        bilaTidak: 'Banyak saus, kecap manis, dan bumbu mengandung gula yang bisa mengeluarkanmu dari batas karbo.',
      },
      {
        id: 'q5',
        jenis: 'paham',
        teks: 'Turunnya berat yang cepat di minggu pertama keto sebagian besar karena apa?',
        pilihan: ['Air yang keluar dari tubuh', 'Lemak perut hilang khusus', 'Otot bertambah'],
        benar: 0,
        penjelasan: 'Saat karbo dipangkas, tubuh melepas simpanan air. Setelah itu penurunan melambat.',
      },
      {
        id: 'q6',
        jenis: 'paham',
        teks: 'Siapa yang sebaiknya hanya menjalani keto dengan pengawasan dokter?',
        pilihan: [
          'Tidak ada, keto aman untuk semua',
          'Hanya atlet profesional',
          'Orang yang punya kondisi kesehatan atau rutin minum obat',
        ],
        benar: 2,
        penjelasan:
          'Keto bisa memengaruhi gula darah, ginjal, dan kerja obat, jadi butuh pengawasan bagi yang punya kondisi.',
      },
    ],
    alternatif: ['rendah-karbo', 'kurangi-gula'],
  },
];

export const METODE_BY_KEY: Record<MetodeKey, Metode> = Object.fromEntries(METODE.map((m) => [m.key, m])) as Record<
  MetodeKey,
  Metode
>;
