# Setup manual OpenClaw di Windows

Panduan ini tidak menimpa `~/.openclaw/openclaw.json` secara otomatis. Jalankan perintah dari `D:\Dev\panenin-whatsapp-rag-lab`.

## 1. Pastikan Node dan OpenClaw

OpenClaw 2026.7.1 membutuhkan Node 24.15 atau lebih baru pada jalur Node 24. Portable Node 24.18.0 telah disiapkan untuk user ini di:

```powershell
$env:PATH = "C:\Users\user\AppData\Local\Programs\node-v24.18.0;$env:PATH"
node --version
openclaw --version
```

Versi yang diharapkan: Node `v24.18.0` dan OpenClaw `2026.7.1`.

## 2. Buat tiga secret lokal

Gunakan bentuk yang kompatibel dengan Windows PowerShell lama:

```powershell
function New-LocalSecret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  [Convert]::ToBase64String($bytes)
}

New-LocalSecret # OPENCLAW_GATEWAY_TOKEN
New-LocalSecret # AGENT_SESSION_HMAC_SECRET
New-LocalSecret # PANENIN_TOOL_SECRET
```

Simpan setiap hasil berbeda di `.env`. Jangan gunakan hasil `AAAA...`; itu berasal dari byte kosong ketika pembuatan random gagal.

## 3. Lengkapi `.env`

Isi nilai berikut tanpa mengirimkannya ke chat atau commit:

```dotenv
OPENCLAW_ENABLED=false
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<secret-1>
OPENCLAW_MODEL=openclaw/default
AGENT_SESSION_HMAC_SECRET=<secret-2>

INTERNAL_TOOL_HOST=127.0.0.1
INTERNAL_TOOL_PORT=3001
PANENIN_TOOL_SECRET=<secret-3>
PANENIN_RAG_TOOL_URL=http://127.0.0.1:3001/internal/tools/rag-query

# Key baru dari Groq Console yang belum pernah dibagikan di chat/log
GROQ_API_KEY=<api-key-groq-baru>
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
GROQ_TERTIARY_MODEL=qwen/qwen3.6-27b
```

Biarkan `OPENCLAW_ENABLED=false` sampai semua smoke test selesai.

## 4. Uji Groq langsung

Perintah ini melakukan satu request jaringan dan hanya mencetak status sukses atau error aman:

```powershell
npm run test:groq
```

Lanjutkan hanya jika hasilnya `GROQ_OK`.

## 5. Build dan validasi plugin

```powershell
npm --prefix .\openclaw\plugins\panenin-tools install
npm run plugin:test
npm run plugin:validate
openclaw plugins install --link .\openclaw\plugins\panenin-tools
```

Build dan validasi plugin otomatis memilih Node yang memenuhi requirement OpenClaw. Jika auto-detect
tidak menemukan runtime yang benar, set hanya untuk terminal aktif:

```powershell
$env:OPENCLAW_NODE_BINARY = "C:\path\ke\node-v24.18.0\node.exe"
```

Jangan arahkan variable tersebut ke Node `24.14.x`; OpenClaw 2026.7.1 mensyaratkan minimal
Node `24.15.0` pada jalur Node 24.

Plugin menyediakan tepat satu tool read-only: `panenin_rag_query`.

## 6. Siapkan konfigurasi OpenClaw

1. Review `openclaw/config/openclaw.example.json5`.
2. Model utama dibentuk sebagai `groq/<GROQ_MODEL>` oleh launcher; ubah `GROQ_MODEL` hanya ke model aktif yang ditampilkan Groq Console.
3. Jangan gabungkan file ini ke konfigurasi OpenClaw global untuk demo lab.
4. Launcher menyalin config ke `tmp/openclaw-runtime`, mengisi path workspace/plugin lewat environment, dan memakai state terisolasi yang diabaikan Git.
5. Pastikan `.env` memuat `GROQ_API_KEY`, `GROQ_MODEL`, `OPENCLAW_GATEWAY_TOKEN`, `PANENIN_RAG_TOOL_URL`, dan `PANENIN_TOOL_SECRET`.

Konfigurasi membatasi gateway ke loopback, mengaktifkan `/v1/chat/completions`, memilih provider `groq` melalui endpoint OpenAI-compatible resmi, dan mengizinkan hanya `panenin_rag_query`. Launcher meneruskan `GROQ_API_KEY` hanya ke child process OpenClaw; plugin tidak menerima key tersebut.

## 7. Jalankan demo

Cara tercepat adalah satu launcher:

```powershell
npm run demo
```

Launcher memulai atau memakai ulang tiga service di bawah, menunggu readiness, lalu mengecek Fonnte dan endpoint publik tanpa mengirim pesan. Jalankan `npm run demo:check` dari terminal lain untuk mengulang pemeriksaan. `DEMO_LOCAL_READY` dan `DEMO_WHATSAPP_READY` harus muncul sebelum demo WhatsApp.

Jika perlu diagnosis per proses, jalankan manual:

Terminal A — internal RAG tool:

```powershell
npm run dev:tools
```

Harus tampil `http://127.0.0.1:3001`; jangan expose port ini melalui Cloudflare.

Terminal B — OpenClaw gateway:

```powershell
$env:PATH = "C:\Users\user\AppData\Local\Programs\node-v24.18.0;$env:PATH"
npm run openclaw:gateway
```

Launcher repo memuat `.env`, meneruskan `GROQ_API_KEY`, `OPENCLAW_GATEWAY_TOKEN`, dan `PANENIN_TOOL_SECRET` ke gateway, lalu menjalankan `openclaw gateway run` dengan Node portable.

Terminal C — webhook WhatsApp:

```powershell
npm run dev
```

Jika `npm run dev:tools` menampilkan `EADDRINUSE 127.0.0.1:3001`, jangan menjalankan instance kedua. Periksa `Get-NetTCPConnection -LocalPort 3001 -State Listen`; respons `405` untuk `GET /internal/tools/rag-query` adalah tanda service aktif karena endpoint hanya menerima `POST` dengan secret.

## 8. Smoke test berurutan

```powershell
npm run test:openclaw
npm run test:openclaw:rag
```

Jika keduanya sukses, ubah `OPENCLAW_ENABLED=true`, lalu restart `npm run dev`.

## 9. Fonnte dan WhatsApp

Webhook Fonnte tetap mengarah ke URL publik aplikasi utama, bukan ke OpenClaw atau port 3001:

```text
https://<tunnel-anda>/webhook/fonnte?token=<FONNTE_WEBHOOK_SECRET>
```

Uji dari WhatsApp:

1. Kirim `MENU` — harus mendapat menu lokal.
2. Kirim `Halo, saya punya cabai yang siap panen minggu depan` — Nara harus menanggapi natural tanpa meminta format command.
3. Kirim `jumlahnya sekitar 200 kilo` — Nara harus memahami bahwa ini lanjutan konteks cabai.
4. Kirim `Bagaimana persiapan panennya?` — harus mendapat jawaban agent/knowledge tanpa awalan `TANYA:`.
5. Matikan gateway lalu ulangi `TANYA:` — harus fallback ke RAG lokal.

Jangan isi `Webhook Connect`, `Webhook Message Status`, atau `Webhook Chaining` untuk alur pesan masuk ini.
