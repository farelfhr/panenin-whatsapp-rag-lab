# Arsitektur integrasi OpenClaw

## Tujuan

OpenClaw menambah orkestrasi percakapan dan skills lokal tanpa memindahkan credential atau akses database ke proses agent. Integrasi bersifat opt-in melalui `OPENCLAW_ENABLED`.

## Komponen

- `src/agent/openclaw-client.ts`: client HTTP ke endpoint OpenAI-compatible OpenClaw pada loopback.
- `src/agent/session-id.ts`: HMAC-SHA256 nomor pengirim menjadi session pseudonim stabil; nomor mentah tidak diteruskan.
- `src/conversation/hybrid-router.ts`: mempertahankan `MENU`, `HELP`, `BANTUAN`, dan `BATAL` secara deterministik; mengarahkan pertanyaan lain ke OpenClaw; menyediakan fallback aman.
- `src/internal-tools/server.ts`: service HTTP terpisah yang wajib bind ke `127.0.0.1`.
- `openclaw/plugins/panenin-tools`: plugin dengan satu tool opsional, `panenin_rag_query`.
- `openclaw/workspace`: instruksi dan tiga skill lokal. Semua keluaran intake/perencanaan adalah draft.

## Aliran request

1. Fonnte mengirim webhook terautentikasi ke aplikasi lab.
2. Pesan dideduplikasi dan dinormalisasi seperti implementasi lama.
3. Hybrid router menangani command deterministik secara lokal.
4. Untuk request agent, nomor diubah menjadi `panenin:<24 hex>` dengan HMAC sebelum dikirim sebagai `user` OpenClaw.
5. Gateway memilih model utama Olagon dan hanya boleh menggunakan `panenin_rag_query`.
6. Plugin memanggil URL RAG tetap pada loopback dengan `x-panenin-tool-secret`.
7. Internal service menjalankan pipeline `answerKnowledge` yang sudah ada, lalu hanya mengembalikan `answer` dan maksimal empat metadata sumber.
8. Jawaban kembali melalui Fonnte. Tidak ada model output yang dijalankan sebagai action.

## Routing dan fallback

| Input | OpenClaw nonaktif | OpenClaw aktif | Jika gateway gagal |
|---|---|---|---|
| `MENU`, `HELP`, `BANTUAN` | Menu lokal | Menu lokal | Tidak relevan |
| `BATAL` | Reset sesi lokal | Reset sesi lokal | Tidak relevan |
| `TANYA: <pertanyaan>` | RAG lokal | OpenClaw | RAG lokal |
| Bahasa natural lain | Fallback menu | OpenClaw | Fallback menu |

Tidak ada retry otomatis di client OpenClaw atau plugin. Hal ini membatasi duplikasi dan beban saat dependency bermasalah.

## Credential boundary

- Aplikasi webhook: Fonnte, Gemini, Supabase, gateway token, HMAC secret.
- Internal RAG service: Gemini, Supabase, internal tool secret.
- OpenClaw: Olagon key dan gateway token dari environment. Provider Olagon memakai header Anthropic `x-api-key`, bukan bearer authorization.
- Plugin: hanya internal tool secret dan URL loopback; tidak menerima Gemini/Supabase/Fonnte credential.

Konfigurasi contoh ada di `openclaw/config/openclaw.example.json5`. File tersebut tidak berisi secret.
