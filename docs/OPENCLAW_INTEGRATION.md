# Arsitektur integrasi OpenClaw

## Tujuan

OpenClaw menambah orkestrasi percakapan dan skills lokal tanpa memindahkan credential atau akses database ke proses agent. Integrasi bersifat opt-in melalui `OPENCLAW_ENABLED`.

## Komponen

- `src/agent/openclaw-client.ts`: client HTTP ke endpoint OpenAI-compatible OpenClaw pada loopback.
- `src/agent/session-id.ts`: HMAC-SHA256 nomor pengirim menjadi session pseudonim stabil; nomor mentah tidak diteruskan.
- `src/conversation/hybrid-router.ts`: mempertahankan `MENU`, `HELP`, `BANTUAN`, dan `BATAL` secara deterministik; mengarahkan pertanyaan lain ke OpenClaw; menyediakan fallback aman.
- `src/internal-tools/server.ts`: service HTTP terpisah yang wajib bind ke `127.0.0.1`.
- `openclaw/plugins/panenin-tools`: plugin dengan satu tool opsional, `panenin_rag_query`.
- `openclaw/workspace`: instruksi persona dan empat skill lokal (`conversation-companion`, `harvest-intake`, `knowledge-rag`, `sales-planner`). Semua keluaran intake/perencanaan adalah draft.

## Aliran request

1. Fonnte mengirim webhook terautentikasi ke aplikasi lab.
2. Pesan dideduplikasi dan dinormalisasi seperti implementasi lama.
3. Hybrid router menangani command deterministik secara lokal.
4. Untuk request agent, nomor diubah menjadi `panenin:<24 hex>` dengan HMAC sebelum dikirim sebagai `user` OpenClaw.
5. Gateway memilih model Groq dari chain GPT-OSS 120B, GPT-OSS 20B, dan Qwen 3.6 27B; agent hanya boleh menggunakan `panenin_rag_query`.
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

Client melakukan maksimal satu retry setelah cooldown hanya ketika seluruh chain OpenClaw berakhir dengan HTTP 429. Operasi agent dan tool bersifat read-only/draft-only, sedangkan pengiriman Fonnte tetap tidak di-retry agar tidak membuat pesan ganda.

## Percakapan natural

- `TANYA:` tetap didukung untuk kompatibilitas, tetapi tidak wajib.
- Shortcut `MENU`, `BANTUAN`, dan `BATAL` tetap deterministic.
- Pesan natural lain dikirim ke OpenClaw dengan kontrak respons aplikasi yang ringkas; isi pengguna tidak diubah.
- Session ID HMAC yang stabil dipakai sebagai field `user`, sehingga pesan lanjutan dari pengirim yang sama memakai konteks percakapan yang sama tanpa mengirim nomor mentah.
- Workspace mendefinisikan persona Nara, adaptasi bahasa, klarifikasi satu-per-satu, dan aturan penggunaan knowledge.
- Lean mode, batas bootstrap, dan allowlist empat skill menekan prompt dari sekitar 23,5 ribu ke sekitar 13,5 ribu karakter tanpa mengurangi boundary read-only.
- Output default dibatasi 384 completion token, sekitar 120 kata, dan maksimal tiga prioritas untuk analisis singkat.
- Pertanyaan faktual Panenin wajib memakai `panenin_rag_query`; sapaan dan klarifikasi dijawab langsung.
- Ketika generator Groq gagal setelah retrieval berhasil, jawaban knowledge memakai fallback ekstraktif terbatas dari source teratas, bukan tebakan.

## Credential boundary

- Aplikasi webhook: Fonnte, Groq, Gemini embedding, Supabase, gateway token, HMAC secret.
- Internal RAG service: Groq, Gemini embedding, Supabase, internal tool secret.
- OpenClaw: Groq key dan gateway token dari environment. Provider memakai endpoint OpenAI-compatible Groq melalui bearer authorization.
- Plugin: hanya internal tool secret dan URL loopback; tidak menerima Groq/Gemini/Supabase/Fonnte credential.

Konfigurasi contoh ada di `openclaw/config/openclaw.example.json5`. File tersebut tidak berisi secret.
