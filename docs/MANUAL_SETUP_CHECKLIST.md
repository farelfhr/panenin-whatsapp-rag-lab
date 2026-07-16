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

- [x] Project ref `npczucfvnjgutvynsrka` terverifikasi aktif dan sehat.
- [x] Extension `vector` 0.8.2 terverifikasi berada di schema `extensions`.
- [x] Migration `20260716163145_create_isolated_panenin_ai_lab_schema` sudah diterapkan dan diverifikasi.
- [ ] Buka Project Settings > API > Exposed schemas, lalu tambahkan `panenin_ai_lab` tanpa menghapus schema yang sudah terdaftar.
- [ ] Ambil Project URL, anon key, dan service-role key dari Project Settings > API.
- [ ] Isi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` di `.env` lokal.
- [ ] Pastikan service-role key hanya dipakai server/CLI, bukan browser.
- [ ] Aktifkan dan konfigurasikan provider Supabase Auth yang disetujui tim di Authentication > Providers.
- [ ] Setelah sign-in, uji `GET /api/protected` dengan `Authorization: Bearer <access-token>`; jangan menaruh token di source, fixture, atau log.
- [ ] Jalankan `npm run rag:ingest`, lalu `npm run rag:test`.

## Fonnte

- [ ] Buat akun Fonnte dan gunakan nomor WhatsApp khusus demo.
- [ ] Tambahkan device, misalnya `panenin-lab`.
- [ ] Scan QR dari WhatsApp > Settings > Linked Devices > Link a Device.
- [ ] Pastikan status device `connected`/`ready`.
- [ ] Salin token API device dan simpan di password manager.
- [ ] Isi `FONNTE_TOKEN` di `.env` lokal.
- [ ] Siapkan endpoint publik `POST /webhook/fonnte` (tunnel atau deployment).
- [ ] Buat `FONNTE_WEBHOOK_SECRET` acak sendiri dan simpan hanya di `.env` lokal; secret ini bukan token dari Fonnte.
- [ ] Isi `PUBLIC_WEBHOOK_URL` dan masukkan URL webhook lengkap pada dashboard Fonnte. Untuk provider tanpa custom header, gunakan `.../webhook/fonnte?token=<url-encoded-secret>` hanya untuk demo/tunnel.
- [ ] Untuk production, gunakan proxy/deployment yang meneruskan `x-webhook-secret` tanpa menaruh secret di URL.
- [ ] Kirim payload dummy dari dashboard/provider dan simpan satu fixture setelah data pribadi disanitasi.
- [ ] Bandingkan field payload aktual dengan normalizer; jangan menganggap fixture contoh sebagai kontrak final.
- [ ] Jalankan `npm run fonnte:test -- 6281234567890` hanya dengan nomor demo yang diizinkan.

## Secret hygiene

- [ ] Salin `.env.example` menjadi `.env` hanya di mesin lokal.
- [ ] Jangan commit `.env`, log, QR, atau session file.
- [ ] Simpan semua secret di password manager dan batasi akses tim.
- [ ] Rotasi key/token bila pernah tercetak di terminal, issue, atau chat.
