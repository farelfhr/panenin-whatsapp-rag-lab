# Panenin Tools

Plugin OpenClaw lokal untuk satu tool `panenin_rag_query`. Tool ini read-only, hanya memanggil endpoint RAG loopback yang path-nya tetap, dan membaca `PANENIN_TOOL_SECRET` dari environment proses plugin. Plugin tidak memiliki credential Gemini, Supabase, Fonnte, SQL, shell, browser, filesystem, atau mutation API. Build membundel TypeBox ke artefak agar instalasi runtime tidak memerlukan dependency produksi tambahan.

## Build

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```

`toolUrl` pada konfigurasi plugin boleh diisi, tetapi runtime tetap menolak URL non-loopback atau path selain `/internal/tools/rag-query`. Respons yang diteruskan ke agent hanya `answer` dan maksimal empat judul/similarity sumber.
