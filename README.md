# Panenin WhatsApp RAG Lab

Integration lab terpisah untuk membuktikan integrasi Groq untuk percakapan/generasi jawaban, Gemini embedding, Supabase PostgreSQL + pgvector, Fonnte WhatsApp text gateway, webhook idempotent, dan router percakapan sebelum artefak terpilih dihubungkan ke repository utama Panenin.

Lab ini tidak menyentuh repository aplikasi utama, tidak membuat listing, tidak menerima order, tidak mengubah stok, tidak melakukan payment/escrow/withdrawal, dan tidak memberi AI akses untuk menulis database transaksi.

## Arsitektur

```text
WhatsApp user -> Fonnte -> POST /webhook/fonnte -> normalize/sanitize -> dedup
                                                     -> hybrid router (feature flag)
                                                        MENU/HELP/BANTUAN -> menu
                                                        TANYA: -> OpenClaw -> read-only RAG tool
                                                               -> fallback RAG lokal
                                                        BATAL -> reset session
                                                        other -> OpenClaw / fallback
                                                     -> Fonnte send text -> user
```

Komponen provider tidak menyimpan business logic. Webhook memberi acknowledgement setelah dedup dan menjadwalkan pemrosesan. Event outgoing bot, duplicate provider ID, payload tanpa ID stabil, dan input tidak valid tidak boleh membuat loop atau mutation.

## Requirement

- Node.js 20 atau lebih baru untuk lab; gateway OpenClaw 2026.7.1 dijalankan dengan Node 24.15 atau lebih baru
- TypeScript strict
- Groq Chat Completions melalui native `fetch`, `@google/genai` untuk embedding, `@supabase/supabase-js`, `zod`, `dotenv`, Vitest
- Supabase pgvector dengan embedding 768 dimensi
- Tidak memakai LangChain atau framework agent

## Instalasi dan environment

```bash
npm install
copy .env.example .env
```

Isi `.env` secara lokal. Semua variable divalidasi dengan Zod:

`GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`, `GROQ_TERTIARY_MODEL`, `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSION=768`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FONNTE_TOKEN`, `FONNTE_WEBHOOK_SECRET`, `PUBLIC_WEBHOOK_URL`, `NODE_ENV`, dan `LOG_LEVEL`. Groq menangani seluruh generasi teks. Gemini hanya membuat embedding yang harus tetap kompatibel dengan knowledge lama. Anon key hanya dipakai server untuk memverifikasi access token Supabase Auth; service-role key hanya dipakai untuk akses database backend.

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
npm run test:groq       # prompt GROQ_OK untuk generator chat utama
npm run test:embedding  # verifikasi vector 768 (memerlukan key/model)
npm run test:gemini     # smoke test chat Gemini legacy/opsional
npm run rag:ingest      # ingest semua kb/*.md (memerlukan Supabase + Gemini)
npm run rag:test -- "Bagaimana cara packing?"
npm run fonnte:activate # validasi token/device lalu set webhook + Auto Read personal
npm run fonnte:test -- 6281234567890
npm run fonnte:inspect -- tests/fixtures/fonnte-text-message.json
npm run demo            # start/reuse tool, OpenClaw, dan webhook dalam satu terminal
npm run demo:check      # cek service lokal, device Fonnte, dan endpoint publik tanpa mengirim pesan
npm run dev             # HTTP server lokal pada PORT atau 3000
npm run dev:tools       # internal RAG tool pada 127.0.0.1:3001
npm run openclaw:gateway # OpenClaw gateway dengan env repo + Node portable
npm run test:openclaw   # smoke test gateway OpenClaw
npm run test:openclaw:rag # smoke test OpenClaw -> plugin -> RAG
npm run test:openclaw:conversation # bukti konteks natural multi-turn
npm run test:openclaw:natural # evaluasi grounding, gaya, dan analisis 3 putaran
npm run plugin:test
npm run plugin:validate
```

Script integrasi akan berhenti dengan error yang jelas bila key, model, project, atau device belum tersedia. Jangan membuat credential palsu.

## Demo tercepat

Setelah `.env` lengkap dan `OPENCLAW_ENABLED=true`, jalankan:

```powershell
npm run demo
```

Launcher memakai config OpenClaw, state sementara, workspace, dan plugin yang semuanya berada di dalam lab. Tool RAG dan gateway tetap loopback-only; hanya webhook app pada `PORT` yang boleh ditunnel. Launcher memakai service yang sudah aktif bila portnya sehat dan menghentikan hanya child process yang ia mulai saat `Ctrl+C`.

Di terminal kedua, jalankan `npm run demo:check`. Status `DEMO_LOCAL_READY` membuktikan proses webhook, gateway OpenClaw, dan broker RAG lokal hidup; jalankan `npm run test:openclaw:rag` untuk membuktikan pipeline RAG eksternal benar-benar menjawab. Status `DEMO_WHATSAPP_READY` baru muncul bila token device Fonnte valid/connected, `PUBLIC_WEBHOOK_URL` memiliki route serta secret yang benar, dan `/health` publik dapat dijangkau. Check ini tidak mengirim WhatsApp dan tidak mencetak token, URL ber-secret, nomor, atau payload.

Setelah tunnel publik sehat dan `FONNTE_TOKEN` berisi **Device Token** dari menu **Device > Token**, jalankan `npm run fonnte:activate`. Command ini memvalidasi token/device, memastikan URL publik dan secret sesuai, lalu mengaktifkan webhook serta Auto Read khusus personal chat melalui API update-device. Command tidak mencetak token, nomor device, atau URL ber-secret.

Istilah remote control pada lab ini berarti Control UI/gateway OpenClaw lokal dan percakapan WhatsApp read-only/draft-only. Port `18789` dan `3001` tidak boleh dipublikasikan. Kontrol bisnis Panenin, mutasi listing/stok/order, payment, dan withdrawal tidak tersedia.

## Percakapan natural dengan Nara

Pengguna tidak wajib memakai `TANYA:`. Saat OpenClaw aktif, semua pesan selain shortcut aman `MENU`, `BANTUAN`, dan `BATAL` dikirim sebagai bahasa natural ke Nara. Nomor pengirim diubah menjadi session HMAC pseudonim yang stabil, lalu dikirim sebagai field `user` OpenAI-compatible; pesan berikutnya dari pengirim yang sama masuk ke sesi OpenClaw yang sama tanpa membocorkan nomor.

Peran OpenClaw adalah memahami maksud dan konteks multi-turn, memilih kapan perlu memakai knowledge, mengajukan satu klarifikasi yang relevan, serta menyusun bahasa WhatsApp yang natural. `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, dan `USER.md` membentuk perilaku/persona Nara; empat skill lokal menangani percakapan bebas, intake panen, knowledge, dan perencanaan penjualan. Client menambahkan kontrak respons singkat pada awal sesi dan pengingat ringkas per giliran agar cerita pengguna tidak otomatis berubah menjadi SOP atau asumsi penjualan. Fakta Panenin tetap berasal dari tool read-only `panenin_rag_query`, bukan dari tebakan model.

Groq menyusun respons percakapan OpenClaw dan jawaban RAG. Default model chain adalah `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, lalu `qwen/qwen3.6-27b`; reasoning dibatasi agar output WhatsApp tidak habis pada token berpikir. Konteks OpenClaw memakai lean mode, hanya empat skill Panenin, dan satu tool. Request read-only yang seluruh modelnya terkena 429 menunggu cooldown sekali lalu mencoba ulang; pengiriman Fonnte tetap tidak pernah di-retry otomatis. Jika generasi Groq gagal tetapi retrieval masih berhasil, pipeline memakai fallback ekstraktif maksimal 420 karakter dari source teratas. OpenClaw tidak menerima key Gemini, Supabase, Fonnte, ataupun nomor WhatsApp mentah. Uji end-to-end:

```powershell
npm run test:openclaw:conversation
npm run test:openclaw:natural
npm run test:openclaw:rag
```

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

`FonnteProvider` membungkus endpoint send, timeout, HTTP non-2xx, menolak respons HTTP 200 yang membawa `status=false`, menormalisasi response provider ID string/angka/array, dan tidak me-retry send secara otomatis. Webhook mencatat tahap menerima, membuat jawaban, dan mengirim tanpa menulis nomor/token/payload ke log; kegagalan penyimpanan mengembalikan 503 agar Fonnte dapat mencoba webhook lagi. Setiap pesan yang sudah diklaim juga berakhir dengan status `processed` atau `failed`, sehingga kegagalan setelah acknowledgement tidak lagi tampak sebagai pesan yang selamanya `received`. Payload personal-chat Fonnte yang memakai `inboxid=0` dibuatkan ID dedup deterministik dari pengirim, timestamp, tipe, dan pesan; retry event yang sama tetap idempotent, sedangkan pesan baru tidak lagi salah dianggap duplikat.

Jalankan `npm run dev`, lalu expose `POST /webhook/fonnte` dengan tunnel publik (misalnya Cloudflare Tunnel) atau deployment sementara yang disetujui tim. Masukkan URL lengkap `https://<public-host>/webhook/fonnte?token=<url-encoded-FONNTE_WEBHOOK_SECRET>` ke field Webhook Fonnte bila provider tidak mengirim custom header. Jangan mencetak URL tersebut ke log. Laptop harus tetap menyala bila memakai tunnel lokal. `GET /health` tersedia untuk smoke test.

Jangan bergantung pada tombol interaktif WhatsApp atau attachment paket gratis. Demo awal berbasis teks.

## OpenClaw (opsional)

Integrasi OpenClaw dikendalikan oleh `OPENCLAW_ENABLED`. Nilai default `false` mempertahankan router lama. Ketika aktif, gateway hanya berjalan pada loopback, nomor WhatsApp diubah menjadi session HMAC, model utama memakai provider Groq OpenAI-compatible, dan agent hanya diizinkan memakai tool read-only `panenin_rag_query`. Plugin tidak menerima credential Supabase, Gemini, Groq, atau Fonnte.

Launcher menunjuk `OPENCLAW_CONFIG_PATH` dan `OPENCLAW_STATE_DIR` ke artefak terisolasi di dalam lab, memuat plugin lokal melalui allowlist, serta memakai Node yang kompatibel. Mulai dari [arsitektur integrasi](docs/OPENCLAW_INTEGRATION.md), [setup manual Windows](docs/OPENCLAW_MANUAL_SETUP.md), [security boundary](docs/OPENCLAW_SECURITY.md), dan [test matrix](docs/OPENCLAW_TEST_MATRIX.md). Jangan tunnel port OpenClaw `18789` atau internal tool `3001`; hanya endpoint webhook aplikasi yang boleh dipublikasikan.

## Log dan troubleshooting

- Groq 400/404: cek `GROQ_MODEL` terhadap model aktif di Groq Console.
- Groq 401: revoke key yang terekspos, buat key baru, dan isi hanya `.env` lokal.
- Groq 429: model chain dan satu retry cooldown akan mencoba pulih otomatis untuk request AI read-only. Bila trafik tetap melebihi limit organisasi, naikkan plan/limit; pengiriman pesan tidak di-retry.
- Gemini embedding 400/429: cek model embedding dan kuotanya; Gemini chat tidak dipakai runtime utama.
- Embedding mismatch: pastikan model/dimensi 768; re-embed seluruh KB setelah perubahan.
- RAG kosong: cek migration, ingestion, threshold 0.62, dan similarity.
- Fonnte offline/nomor salah: cek device connected dan format nomor `62...` tanpa `+`.
- Fonnte `token invalid`: salin **Device Token** dari menu **Device > Token**, bukan account token atau Groq key, ke `FONNTE_TOKEN`, restart service, lalu jalankan `npm run fonnte:activate`.
- Webhook tidak masuk: cek URL publik, route `POST`, `Auto Read`, dan query token/header. Untuk tunnel demo, URL harus berakhir dengan `/webhook/fonnte?token=...`; jangan mencetak token atau raw payload.
- Balasan ganda: pastikan `provider_message_id` unique dan outgoing event difilter.
- Nomor logout: scan QR ulang dengan nomor demo; jangan gunakan nomor pribadi utama.

Log tidak boleh berisi token, key, raw payload lengkap, atau nomor lengkap. Gunakan `npm run fonnte:inspect` untuk mencetak struktur payload tanpa nilai.

## Batasan dan handoff

AI hanya mengklasifikasikan, menjawab RAG, atau menyusun draft percakapan. Router mempertahankan `MENU`, `HELP`, `BANTUAN`, `TANYA:`, `BATAL`, dan fallback. OpenClaw hanya memiliki tool knowledge read-only. Tidak ada `CREATE_LISTING`, `UPDATE_STOCK`, `ACCEPT_ORDER`, payment, atau withdrawal.

Saat repository utama siap, pindahkan hanya adapter, kontrak normalized message/RAG, migration, ingestion, fixture, dan test yang telah direview. Jangan menyalin seluruh lab. Lihat [handoff guide](docs/HANDOFF_GUIDE.md) dan [testing guide](docs/TESTING_GUIDE.md).
