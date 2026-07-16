# Panenin WhatsApp RAG Lab

Integration lab terpisah untuk membuktikan integrasi Gemini API, Supabase PostgreSQL + pgvector, Fonnte WhatsApp text gateway, webhook idempotent, dan router percakapan sebelum artefak terpilih dihubungkan ke repository utama Panenin.

Lab ini tidak menyentuh repository aplikasi utama, tidak membuat listing, tidak menerima order, tidak mengubah stok, tidak melakukan payment/escrow/withdrawal, dan tidak memberi AI akses untuk menulis database transaksi.

## Arsitektur

```text
WhatsApp user -> Fonnte -> POST /webhook/fonnte -> normalize/sanitize -> dedup
                                                     -> deterministic router
                                                        MENU/HELP/BANTUAN -> menu
                                                        TANYA: -> embed -> pgvector RPC -> Gemini -> source-aware reply
                                                        BATAL -> reset session
                                                        other -> fallback
                                                     -> Fonnte send text -> user
```

Komponen provider tidak menyimpan business logic. Webhook memberi acknowledgement setelah dedup dan menjadwalkan pemrosesan. Event outgoing bot, duplicate provider ID, payload tanpa ID stabil, dan input tidak valid tidak boleh membuat loop atau mutation.

## Requirement

- Node.js 20 atau lebih baru
- TypeScript strict
- `@google/genai`, `@supabase/supabase-js`, `zod`, `dotenv`, Vitest
- Supabase pgvector dengan embedding 768 dimensi
- Tidak memakai LangChain atau framework agent

## Instalasi dan environment

```bash
npm install
copy .env.example .env
```

Isi `.env` secara lokal. Semua variable divalidasi dengan Zod:

`GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSION=768`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FONNTE_TOKEN`, `FONNTE_WEBHOOK_SECRET`, `PUBLIC_WEBHOOK_URL`, `NODE_ENV`, dan `LOG_LEVEL`. Anon key hanya dipakai server untuk memverifikasi access token Supabase Auth; service-role key hanya dipakai untuk akses database backend.

Jangan menaruh nilai asli di `.env.example`, source, fixture, atau log. Lihat [manual setup checklist](docs/MANUAL_SETUP_CHECKLIST.md).

## Migration Supabase

Migration versioned `20260716163145_create_isolated_panenin_ai_lab_schema.sql` membuat seluruh objek hanya di schema `panenin_ai_lab`. Schema memakai `extensions.vector(768)`, `knowledge_documents`, `knowledge_chunks`, `match_knowledge`, `incoming_messages`, dan `conversation_sessions`. Keempat tabel memakai RLS tanpa policy `anon`/`authenticated`; hanya service role backend yang mendapat grant minimum.

Tambahkan `panenin_ai_lab` secara manual di **Project Settings > API > Exposed schemas** tanpa menghapus schema lain. Klien server sudah menetapkan `db.schema` ke `panenin_ai_lab`, sehingga ingestion, retrieval, webhook store, dan RPC tidak lagi memakai schema `public`.

## Supabase Auth dan route terproteksi

Frontend atau client tepercaya melakukan sign-in melalui Supabase Auth dan mengirim access token sebagai `Authorization: Bearer <token>`. Server memverifikasi token menggunakan `auth.getClaims()` sebelum melayani:

```text
GET /api/protected
```

Response berhasil hanya berisi status autentikasi dan tidak mengembalikan claim atau data pengguna. `GET /health` tetap publik. `POST /webhook/fonnte` tidak memakai JWT pengguna karena dipanggil provider; endpoint itu tetap dilindungi `FONNTE_WEBHOOK_SECRET` melalui header `x-webhook-secret` atau query `?token=` untuk kompatibilitas provider yang tidak dapat mengirim custom header. Query token hanya untuk demo/tunnel; gunakan proxy atau deployment dengan header verification untuk production karena URL dapat masuk ke log provider/tunnel.

## Command

```bash
npm run typecheck       # TypeScript strict check
npm test                # unit test, seluruh network dimock
npm run test:watch      # Vitest watch
npm run build           # compile ke dist
npm run test:gemini     # prompt GEMINI_OK (memerlukan key/model)
npm run test:embedding  # verifikasi vector 768 (memerlukan key/model)
npm run rag:ingest      # ingest semua kb/*.md (memerlukan Supabase + Gemini)
npm run rag:test -- "Bagaimana cara packing?"
npm run fonnte:test -- 6281234567890
npm run fonnte:inspect -- tests/fixtures/fonnte-text-message.json
npm run dev             # HTTP server lokal pada PORT atau 3000
```

Script integrasi akan berhenti dengan error yang jelas bila key, model, project, atau device belum tersedia. Jangan membuat credential palsu.

## Knowledge dan RAG

Tambahkan Markdown dengan frontmatter `title`, `category`, `version`, dan `status`. Chunking memakai target sekitar 250 kata dengan overlap 40 kata (batas validasi 150-400 dan 30-60), lalu setiap chunk di-embed ke vector 768. Retrieval memanggil RPC `match_knowledge`; answer generator hanya menerima context retrieved dan mengembalikan:

```ts
type RagAnswer = {
  answer: string;
  sources: Array<{ title: string; similarity: number }>;
};
```

Jika tidak ada match atau context tidak cukup, jawaban kanonik adalah `Maaf, panduan tersebut belum tersedia dalam basis pengetahuan Panenin.`

## Fonnte dan webhook lokal

`FonnteProvider` membungkus endpoint send, timeout, HTTP non-2xx, dan tidak me-retry send secara otomatis. Normalizer defensif menerima bentuk payload umum sebagai hipotesis; field aktual wajib dikonfirmasi dari satu payload yang disanitasi. Lihat TODO di `src/webhook/normalize-fonnte-payload.ts`.

Jalankan `npm run dev`, lalu expose `POST /webhook/fonnte` dengan tunnel publik (misalnya Cloudflare Tunnel) atau deployment sementara yang disetujui tim. Masukkan URL lengkap `https://<public-host>/webhook/fonnte?token=<url-encoded-FONNTE_WEBHOOK_SECRET>` ke field Webhook Fonnte bila provider tidak mengirim custom header. Jangan mencetak URL tersebut ke log. Laptop harus tetap menyala bila memakai tunnel lokal. `GET /health` tersedia untuk smoke test.

Jangan bergantung pada tombol interaktif WhatsApp atau attachment paket gratis. Demo awal berbasis teks.

## Log dan troubleshooting

- Gemini 400/404: pilih model yang benar-benar muncul di AI Studio dan update `.env`.
- Gemini 429: kurangi call, gunakan Flash/Lite, dan pertimbangkan backoff terbatas pada operasi aman.
- Embedding mismatch: pastikan model/dimensi 768; re-embed seluruh KB setelah perubahan.
- RAG kosong: cek migration, ingestion, threshold 0.62, dan similarity.
- Fonnte offline/nomor salah: cek device connected dan format nomor `62...` tanpa `+`.
- Webhook tidak masuk: cek URL publik, route `POST`, `Auto Read`, dan query token/header. Untuk tunnel demo, URL harus berakhir dengan `/webhook/fonnte?token=...`; jangan mencetak token atau raw payload.
- Balasan ganda: pastikan `provider_message_id` unique dan outgoing event difilter.
- Nomor logout: scan QR ulang dengan nomor demo; jangan gunakan nomor pribadi utama.

Log tidak boleh berisi token, key, raw payload lengkap, atau nomor lengkap. Gunakan `npm run fonnte:inspect` untuk mencetak struktur payload tanpa nilai.

## Batasan dan handoff

AI hanya mengklasifikasikan atau menjawab RAG. Router awal hanya `MENU`, `HELP`, `BANTUAN`, `TANYA:`, `BATAL`, dan fallback. Tidak ada `CREATE_LISTING`, `UPDATE_STOCK`, `ACCEPT_ORDER`, payment, atau withdrawal.

Saat repository utama siap, pindahkan hanya adapter, kontrak normalized message/RAG, migration, ingestion, fixture, dan test yang telah direview. Jangan menyalin seluruh lab. Lihat [handoff guide](docs/HANDOFF_GUIDE.md) dan [testing guide](docs/TESTING_GUIDE.md).
