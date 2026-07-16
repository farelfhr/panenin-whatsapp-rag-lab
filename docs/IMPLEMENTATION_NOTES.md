# Implementation Notes

## Tujuan lab

`panenin-whatsapp-rag-lab` adalah integration lab terpisah untuk membuktikan alur pesan WhatsApp berbasis teks melalui Fonnte, routing percakapan yang deterministik, pencarian knowledge dengan Supabase PostgreSQL dan pgvector, serta pembuatan jawaban terbatas konteks dengan Gemini. Lab menyiapkan kontrak dan artefak yang kelak dapat dipindahkan secara selektif ke repository utama tanpa mengasumsikan struktur repository tersebut.

Lab ini bukan backend transaksi Panenin. Lab tidak membuat listing, menerima order, mengubah stok, memproses pembayaran atau escrow, melakukan withdrawal, maupun memberi AI akses untuk menulis transaksi.

## Milestone M0-M6

| Milestone | Bukti keberhasilan | Kondisi berhenti atau batas |
| --- | --- | --- |
| M0 - Account ready | Gemini API key tersedia, project Supabase dibuat, dan device Fonnte terhubung | Aktivitas dashboard dan credential dikerjakan manusia; pekerjaan lokal yang tidak memerlukan secret tetap dapat dilanjutkan |
| M1 - Gemini test | Prompt sederhana menghasilkan `GEMINI_OK`; structured intent tervalidasi | Model/key/quota harus diverifikasi manual bila panggilan langsung gagal |
| M2 - RAG standalone | Pertanyaan relevan menghasilkan jawaban beserta source; no-answer juga benar | Dimensi embedding harus tetap 768 dan knowledge harus di-ingest ulang bila model/dimensi berubah |
| M3 - Fonnte echo | Pesan teks outbound dan payload inbound dapat diuji terpisah | Jangan menghubungkan AI sebelum payload aktual yang disanitasi diverifikasi |
| M4 - WhatsApp + RAG | Pesan `TANYA: ...` dirutekan satu kali ke RAG dengan fallback aman | Tidak ada mutation dan event duplicate/outgoing harus diblokir |
| M5 - Intent router | Menu/help, query, cancel, dan fallback dipisahkan | Classifier hanya mengklasifikasikan; router tetap menentukan tindakan |
| M6 - Handoff | Adapter, kontrak, migration, ingestion, fixture, dan test siap dipindahkan selektif | Repository utama tetap tidak disentuh dan seluruh lab tidak boleh disalin begitu saja |

## Batasan keamanan

- Secret hanya dibaca dari environment dan tidak boleh ditulis ke source, fixture, log, atau pesan error.
- Service-role key hanya dipakai oleh proses server/CLI untuk ingestion dan webhook lab; tidak boleh dikirim ke browser atau pengguna.
- Input webhook diperlakukan sebagai data tidak tepercaya, dinormalisasi secara defensif, disanitasi sebelum disimpan, dan dideduplicate berdasarkan provider message ID.
- Event outgoing/bot sendiri tidak boleh diproses ulang.
- Gemini hanya dipakai untuk embedding, jawaban RAG berbasis konteks, dan klasifikasi intent terstruktur. Output model tidak mengeksekusi action dan tidak menulis database transaksi.
- Jawaban RAG harus menggunakan konteks retrieved saja, berbahasa Indonesia sederhana, tidak mengarang, dan tidak membuat klaim keamanan pangan.
- Prompt injection diperlakukan sebagai input pengguna biasa dan tidak boleh menyebabkan secret, instruction internal, atau raw payload terungkap.
- Panggilan provider eksternal memakai timeout dan retry terbatas hanya untuk operasi aman/idempotent. Pengiriman pesan tidak di-retry secara otomatis karena dapat menghasilkan pesan ganda.
- Log produksi tidak memuat payload lengkap, nomor lengkap, token, secret, atau API key.

## Pekerjaan manusia yang wajib dilakukan manual

- Membuat API key di Google AI Studio, memilih model Flash/Lite dan model embedding yang benar-benar tersedia, lalu menyimpan key di password manager.
- Membuat project Supabase, memilih region, membuat password kuat, mengaktifkan extension `vector`, menjalankan migration, dan mengambil Project URL, anon key, serta service-role key.
- Membuat akun Fonnte, menambahkan device dengan nomor khusus demo, memindai QR, memverifikasi status connected, mengambil token, dan mengatur webhook URL publik.
- Membuat tunnel publik atau deployment endpoint, memastikan laptop/server tetap aktif, lalu menguji webhook dari dashboard/provider aktual.
- Mengisi `.env` lokal sendiri. Repository hanya menyediakan `.env.example` tanpa nilai rahasia.
- Menyediakan satu payload webhook Fonnte aktual yang telah disanitasi agar fixture dan normalizer dapat dikonfirmasi.
- Memverifikasi kuota, ketentuan penggunaan, harga, fitur paket, dan ketersediaan model/provider karena semuanya dapat berubah.

## Asumsi teknis

- Runtime adalah Node.js 20 atau lebih baru dengan native `fetch`, `FormData`, `Request`, dan `Response`.
- Implementasi memakai TypeScript strict, `@google/genai`, `@supabase/supabase-js`, Zod, dotenv, dan Vitest tanpa LangChain atau framework agent.
- Embedding selalu memiliki 768 elemen. Nama model chat dan embedding berasal dari environment.
- Supabase menjadi satu-satunya database runtime; test menggunakan dependency injection/mocks, bukan database lokal pengganti.
- Webhook lab berjalan pada server HTTP Node sederhana dan mengembalikan acknowledgement cepat setelah normalisasi serta klaim dedup. Pemrosesan diteruskan secara asynchronous di dalam proses lab; deployment production kelak membutuhkan queue/durable worker.
- RPC `match_knowledge` mengembalikan `chunk_id`, `title`, `content`, dan `similarity` dengan cosine distance.
- Isi knowledge source memakai frontmatter sederhana dengan `title`, `category`, `version`, dan `status`.
- Contoh payload Fonnte bersifat hipotesis dan hanya untuk test defensif sampai payload aktual tersedia.

## Risiko Fonnte

- Fonnte adalah gateway WhatsApp tidak resmi; sesi dapat logout, QR dapat perlu dipindai ulang, dan nomor dapat dibatasi oleh WhatsApp.
- Paket, kuota, attachment, format webhook, field outgoing, autentikasi webhook, dan response send API dapat berubah tanpa kontrak yang cukup kuat.
- Tombol interaktif deprecated/tidak dijadikan dependency. Demo hanya memakai teks dan link.
- Webhook dapat dikirim ulang, urutannya dapat berubah, dan provider message ID dapat hilang. Payload tanpa ID yang stabil harus diabaikan, bukan diberi ID berbasis waktu yang merusak idempotensi.
- Pengiriman message timeout dapat memiliki hasil ambigu: provider mungkin sudah menerima request meskipun client tidak memperoleh response. Karena itu send tidak di-retry otomatis.
- Nomor pribadi atau nomor bisnis utama tidak boleh digunakan untuk demo.

## Keputusan arsitektur

1. `MessagingProvider` menjadi batas vendor; `FonnteProvider` hanya mengirim teks dan mengubah payload menjadi `NormalizedIncomingMessage`.
2. Webhook handler menerima JSON atau form, memverifikasi secret bila dikonfigurasi, menormalisasi, menyaring event outgoing, mengklaim dedup di Supabase, menyimpan payload tersanitasi, lalu melakukan dispatch non-blocking.
3. Router deterministic menangani `MENU`/`HELP`/`BANTUAN`, `TANYA:`, `BATAL`, dan fallback. Jalur ini tidak membutuhkan classifier Gemini.
4. Intent classifier disediakan sebagai komponen murni terpisah untuk kontrak M5; confidence di bawah 0,80 dipetakan ke `UNKNOWN` dan classifier tidak mengeksekusi apa pun.
5. RAG dipisah menjadi loader/chunker, ingestion, retrieval, dan answer generation. Semua dependency eksternal diberikan melalui interface agar network dapat dimock.
6. No-answer memiliki satu teks kanonik: `Maaf, panduan tersebut belum tersedia dalam basis pengetahuan Panenin.`
7. Ingestion memakai service-role key dan melakukan upsert dokumen secara eksplisit; retrieval dapat memakai server-side client. Row Level Security dan grant minimum perlu disesuaikan lagi saat target deployment final diketahui.
8. SQL migration dipisahkan berdasarkan extension, knowledge schema, RPC retrieval, dan tabel WhatsApp lab agar dapat diaudit dan dipindahkan selektif.
9. Lab tetap monolit modular, bukan microservices. Endpoint, router, provider, dan RAG berada dalam satu package Node untuk kemudahan pengujian.
10. Handoff hanya mencakup provider abstraction/adapter, message dan RAG contracts, migration, knowledge ingestion, fixtures, serta test cases. Tidak ada sinkronisasi otomatis dengan repository utama.

## Perbedaan panduan dan implementasi defensif

- Panduan memberi pseudocode yang mencetak raw payload pertama kali. Implementasi lab menggantinya dengan inspeksi tersanitasi agar data pribadi dan secret tidak tercetak lengkap.
- Panduan memberi contoh fallback provider message ID berbasis waktu. Implementasi menolak message tanpa ID stabil untuk mempertahankan idempotensi.
- Panduan menyebut M0 sebagai stop sebelum coding, sedangkan brief eksplisit meminta melanjutkan bagian yang tidak membutuhkan secret. Karena folder ini harus dapat dibangun dan diuji offline, scaffolding, source, migration, fixture palsu, dokumentasi, dan unit test tetap dibuat; uji integrasi aktual ditandai manual.
- Nama model contoh dalam PDF tidak di-hardcode sebagai fallback. Ketersediaan model berubah dan brief mewajibkan model dibaca dari environment.

