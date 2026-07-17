# Security boundary OpenClaw

## Prinsip

- Semua endpoint agent/tool bind ke loopback.
- Gateway menggunakan bearer token; internal tool menggunakan secret terpisah.
- Nomor WhatsApp dipseudonimkan dengan HMAC dan tidak diteruskan ke OpenClaw.
- Tool agent hanya read-only dan hanya mengembalikan jawaban serta metadata sumber.
- OpenClaw hanya menerima Groq API key sebagai credential model dan gateway token lokal. OpenClaw tidak mendapat service-role key, Gemini key, Fonnte token, webhook payload mentah, SQL, shell, filesystem, browser, atau messaging tool.
- Tidak ada output model yang dieksekusi sebagai tindakan.

## Ancaman dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Gateway diakses dari jaringan | `gateway.bind=loopback`, URL client harus loopback, bearer token kuat |
| Internal RAG dipanggil pihak lain | Bind literal `127.0.0.1`, header secret, timing-safe comparison, tanpa CORS |
| Nomor telepon bocor ke model | HMAC-SHA256 stabil; hanya `panenin:<hash>` yang dikirim |
| Prompt injection meminta action/secret | Workspace policy, allowlist satu tool, RAG system instruction, tidak ada mutation tool |
| SSRF dari plugin | URL harus HTTP loopback dan path tepat `/internal/tools/rag-query` |
| Data Supabase mentah keluar | Handler memetakan respons ke `answer` + maksimal empat sumber; tanpa chunks/rows/embedding |
| Credential masuk log | Client hanya mengeluarkan error status; payload/token tidak dicetak |
| Dependency lambat/gagal | Timeout, tanpa retry otomatis, fallback deterministik/RAG lokal |
| Intake dianggap transaksi | Skills mewajibkan label draft dan melarang penyimpanan/listing/order |

## Rotasi

Rotasi `OPENCLAW_GATEWAY_TOKEN`, `AGENT_SESSION_HMAC_SECRET`, dan `PANENIN_TOOL_SECRET` secara terpisah. Mengganti HMAC secret menghasilkan session ID baru dan memutus kontinuitas percakapan lama; ini disengaja. Restart proses terkait setelah rotasi.

## Larangan operasional

Jangan expose port 18789 atau 3001 lewat Cloudflare/ngrok/firewall. Hanya endpoint webhook aplikasi (umumnya port 8000) yang boleh ditunnel ke Fonnte.
