# OpenClaw test matrix

| Area | Test | Otomatis | Harapan |
|---|---|---:|---|
| Session | HMAC stabil dan tanpa nomor | Ya | `panenin:<24 hex>` |
| Client | Request Chat Completions | Ya | bearer, model, pseudonymous `user` |
| Client | HTTP/format error | Ya | gagal aman tanpa body/token |
| Client | Timeout | Ya | abort satu kali, tanpa retry |
| Client | Rate limit | Ya | satu cooldown retry read-only; body/session tetap sama |
| Client | Respons lanjutan | Ya | kontrak ringkas, maksimum token, dan session stabil |
| Hybrid router | Feature flag off | Ya | perilaku router lama |
| Hybrid router | MENU/BATAL | Ya | selalu lokal |
| Hybrid router | TANYA gateway down | Ya | fallback RAG lokal |
| Hybrid router | Natural language gateway down | Ya | fallback menu |
| Internal tool | Secret salah | Ya | 401 sebelum RAG |
| Internal tool | Input invalid/terlalu panjang | Ya | 400 |
| Internal tool | Pipeline error | Ya | 503 tanpa detail internal |
| Internal tool | Output minimisasi | Ya | answer + maks. 4 sources |
| Plugin | URL arbitrer | Ya | ditolak; loopback/path fixed saja |
| Plugin | Output minimisasi | Ya | chunks mentah dibuang |
| Groq | OpenAI-compatible Chat Completions | Manual/network | `GROQ_OK` |
| OpenClaw | Gateway + model | Manual/network | `OPENCLAW_OK` |
| OpenClaw | Percakapan natural 3 putaran | Manual/network | `OPENCLAW_NATURAL_OK` |
| OpenClaw/RAG | Agent memanggil plugin | Manual/network | `OPENCLAW_RAG_OK` |
| WhatsApp | End-to-end via Fonnte | Manual | pesan mendapat respons |

Perintah quality gate lokal:

```powershell
npm run typecheck
npm test
npm run build
npm run plugin:test
npm run plugin:validate
```

Test jaringan tidak dijalankan otomatis dan membutuhkan `.env` lengkap serta proses lokal aktif.
