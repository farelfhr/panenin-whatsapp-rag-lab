# Manual Setup Checklist

Checklist ini sengaja memisahkan pekerjaan dashboard, device, dan secret yang tidak dapat dilakukan oleh source code.

## Gemini / Google AI Studio

- [ ] Buka Google AI Studio dengan akun pemilik project.
- [ ] Buat API key pada project `panenin-ai-lab` atau project tim yang disepakati.
- [ ] Simpan key di password manager; jangan menaruhnya di chat, Git, fixture, atau log.
- [ ] Buka model list dan pilih model chat Flash/Lite yang tersedia pada akun/free tier.
- [ ] Pilih model embedding yang tersedia dan mendukung output dimensionality 768.
- [ ] Isi `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`, dan `GEMINI_API_KEY` di `.env` lokal.
- [ ] Jalankan `npm run test:gemini` dan `npm run test:embedding`.

## Supabase

- [ ] Buat project Supabase baru dan simpan password database secara aman.
- [ ] Pilih region yang disepakati tim.
- [ ] Buka Database > Extensions dan aktifkan `vector`/pgvector bila belum aktif.
- [ ] Jalankan migration secara berurutan: `001` sampai `004`.
- [ ] Ambil Project URL, anon key, dan service-role key dari Project Settings > API.
- [ ] Isi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` di `.env` lokal.
- [ ] Pastikan service-role key hanya dipakai server/CLI, bukan browser.
- [ ] Jalankan `npm run rag:ingest`, lalu `npm run rag:test`.

## Fonnte

- [ ] Buat akun Fonnte dan gunakan nomor WhatsApp khusus demo.
- [ ] Tambahkan device, misalnya `panenin-lab`.
- [ ] Scan QR dari WhatsApp > Settings > Linked Devices > Link a Device.
- [ ] Pastikan status device `connected`/`ready`.
- [ ] Salin token API device dan simpan di password manager.
- [ ] Isi `FONNTE_TOKEN` di `.env` lokal.
- [ ] Siapkan endpoint publik `POST /webhook/fonnte` (tunnel atau deployment).
- [ ] Isi `FONNTE_WEBHOOK_SECRET` dengan secret acak yang disepakati, bila dashboard/provider mendukung header secret.
- [ ] Isi `PUBLIC_WEBHOOK_URL` dan masukkan URL webhook pada dashboard Fonnte.
- [ ] Kirim payload dummy dari dashboard/provider dan simpan satu fixture setelah data pribadi disanitasi.
- [ ] Bandingkan field payload aktual dengan normalizer; jangan menganggap fixture contoh sebagai kontrak final.
- [ ] Jalankan `npm run fonnte:test -- 6281234567890` hanya dengan nomor demo yang diizinkan.

## Secret hygiene

- [ ] Salin `.env.example` menjadi `.env` hanya di mesin lokal.
- [ ] Jangan commit `.env`, log, QR, atau session file.
- [ ] Simpan semua secret di password manager dan batasi akses tim.
- [ ] Rotasi key/token bila pernah tercetak di terminal, issue, atau chat.
