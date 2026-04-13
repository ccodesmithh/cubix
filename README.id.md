# CubiX - Ekstensi Adobe CEP

Repositori ini berisi kode sumber untuk Ekstensi Adobe CEP (Common Extensibility Platform) CubiX. Ekstensi ini dirancang untuk meningkatkan alur kerja Anda dalam aplikasi Adobe Creative Cloud dengan menyediakan panel dan fungsionalitas kustom.

## Fitur

*   **Fitur 1**: Jelaskan fitur utama pertama di sini.
*   **Fitur 2**: Jelaskan fitur utama kedua di sini.
*   **Fitur 3**: Jelaskan fitur utama ketiga di sini.
    *(Mohon ganti ini dengan fitur sebenarnya dari CubiX)*

## Instalasi

Untuk menginstal ekstensi CubiX, ikuti langkah-langkah berikut:

1.  **Unduh Ekstensi**: Dapatkan file `.zxp` (atau folder yang belum di-zip) untuk ekstensi CubiX.
2.  **Instal dengan ZXP Installer (Disarankan)**:
    *   Gunakan utilitas penginstal ZXP seperti Anastasiy's Extension Manager, ExMan Command Line Tool, atau yang serupa.
    *   Seret dan lepas file `.zxp` ke penginstal, atau gunakan antarmuka penginstal untuk menelusuri dan memilih file `.zxp`.
3.  **Instalasi Manual (untuk folder yang belum di-zip)**:
    *   Temukan folder ekstensi CEP untuk sistem operasi Anda:
        *   **Windows**: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions` atau `C:\Users\<NAMA_PENGGUNA_ANDA>\AppData\Roaming\Adobe\CEP\extensions`
        *   **macOS**: `/Library/Application Support/Adobe/CEP/extensions/` atau `~/Library/Application Support/Adobe/CEP/extensions/`
    *   Letakkan folder CubiX yang belum di-zip langsung ke salah satu direktori `extensions` ini. Pastikan nama folder cocok dengan `ExtensionBundleId` yang ditentukan dalam `manifest.xml`.

## Penggunaan

Setelah terinstal, Anda dapat mengakses ekstensi CubiX dari dalam aplikasi Adobe Creative Cloud Anda (misalnya, Photoshop, Illustrator, Premiere Pro).

1.  Buka aplikasi Adobe Anda.
2.  Navigasi ke `Window > Extensions > CubiX` (jalur yang tepat mungkin sedikit berbeda tergantung pada aplikasi dan konfigurasi manifes).
3.  Panel CubiX seharusnya sekarang muncul, siap untuk digunakan.

## Pengembangan

Jika Anda seorang pengembang yang tertarik untuk memodifikasi atau berkontribusi pada CubiX:

1.  **Kloning repositori**:
    ```bash
    git clone [url-repositori]
    cd CubiX
    ```
2.  **Dependensi**: (Daftarkan dependensi pengembangan di sini, misalnya, Node.js, npm, alat build tertentu)
3.  **Proses Build**: (Jelaskan cara membangun ekstensi jika ada langkah build)
4.  **Debugging**: Aktifkan mode debug di aplikasi Adobe Anda untuk memeriksa ekstensi.

## Kontribusi

Kami menerima kontribusi! Silakan lihat `CONTRIBUTING.md` (jika tersedia) untuk detail tentang cara mengirimkan pull request, melaporkan bug, dan menyarankan fitur.

## Lisensi

Proyek ini dilisensikan di bawah [NAMA LISENSI] - lihat file `LICENSE.md` untuk detailnya.
*(misalnya, Lisensi MIT, Lisensi Apache 2.0)*

## Kontak

Untuk pertanyaan, dukungan, atau umpan balik, silakan hubungi [Nama Anda/Email/Situs Web].
