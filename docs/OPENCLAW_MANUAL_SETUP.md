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

# API key Olagon asli dari dashboard/provider (bukan hasil New-LocalSecret)
OLAGON_API_KEY=<api-key-olagon>
ANTHROPIC_API_KEY=<salin-api-key-olagon-untuk-environment-OpenClaw>
OLAGON_API_URL=https://gateway.olagon.site/anthropic/v1/messages
OLAGON_BASE_URL=https://gateway.olagon.site/anthropic
# ID model persis yang disediakan Olagon
OLAGON_MODEL_ID=<id-model-yang-diberikan-olagon>
```

Biarkan `OPENCLAW_ENABLED=false` sampai semua smoke test selesai.

## 4. Uji Olagon langsung

Perintah ini melakukan satu request jaringan dan hanya mencetak status sukses atau error aman:

```powershell
npm run test:olagon
```

Lanjutkan hanya jika hasilnya `OLAGON_OK`.

## 5. Build dan validasi plugin

```powershell
$env:PATH = "C:\Users\user\AppData\Local\Programs\node-v24.18.0;$env:PATH"
npm --prefix .\openclaw\plugins\panenin-tools install
npm run plugin:test
npm run plugin:validate
openclaw plugins install --link .\openclaw\plugins\panenin-tools
```

Plugin menyediakan tepat satu tool read-only: `panenin_rag_query`.

## 6. Siapkan konfigurasi OpenClaw

1. Buka `openclaw/config/openclaw.example.json5`.
2. Model yang sudah dicantumkan adalah `anthropic/claude-3-5-sonnet`, sesuai model dari portal Olagon; ubah hanya jika provider memberikan ID berbeda.
3. Pastikan path workspace sesuai lokasi repo.
4. Gabungkan konfigurasi secara manual ke konfigurasi OpenClaw Anda. Jangan menghapus konfigurasi lain tanpa review.
5. Pastikan environment pada terminal gateway memuat `OLAGON_API_KEY`, `OLAGON_BASE_URL`, `OPENCLAW_GATEWAY_TOKEN`, `PANENIN_RAG_TOOL_URL`, dan `PANENIN_TOOL_SECRET`.

Konfigurasi membatasi gateway ke loopback, mengaktifkan `/v1/chat/completions`, memilih provider `anthropic` melalui base URL Olagon, dan mengizinkan hanya `panenin_rag_query`. OpenClaw membaca `ANTHROPIC_API_KEY` dari environment globalnya (`~/.openclaw/.env` atau shell gateway).

## 7. Jalankan tiga proses

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

Launcher repo memuat `.env`, meneruskan `ANTHROPIC_API_KEY`, `OPENCLAW_GATEWAY_TOKEN`, dan `PANENIN_TOOL_SECRET` ke gateway, lalu menjalankan `openclaw gateway run` dengan Node portable.

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
2. Kirim `TANYA: bagaimana persiapan panen?` — harus mendapat jawaban agent/RAG.
3. Matikan gateway lalu ulangi `TANYA:` — harus fallback ke RAG lokal.
4. Kirim kalimat natural — saat gateway hidup, dijawab OpenClaw; saat mati, mendapat petunjuk menu.

Jangan isi `Webhook Connect`, `Webhook Message Status`, atau `Webhook Chaining` untuk alur pesan masuk ini.
