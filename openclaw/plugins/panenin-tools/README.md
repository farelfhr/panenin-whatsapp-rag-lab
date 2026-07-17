# Panenin Tools

Plugin OpenClaw lokal untuk satu tool `panenin_rag_query`. Tool ini read-only, hanya memanggil endpoint RAG loopback yang path-nya tetap, dan membaca `PANENIN_TOOL_SECRET` dari environment proses plugin. Plugin tidak memiliki credential Gemini, Supabase, Fonnte, SQL, shell, browser, filesystem, atau mutation API. Runtime entry mengikuti format tool plugin OpenClaw `dist/index.js`; TypeBox dicantumkan sebagai dependency produksi plugin.

## Build

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```

`plugin:build` mengompilasi TypeScript lalu memakai mode `plugins build --check`, sehingga metadata
yang stale membuat proses gagal tanpa menulis ulang file. Gunakan `npm run plugin:generate` hanya
ketika metadata tool memang sengaja diubah, kemudian review perubahan manifest dan package metadata.

Script build/validate memilih runtime Node yang kompatibel dengan OpenClaw. Pada Windows, script
akan memakai Node aktif bila versinya didukung atau mencari instalasi portable `node-v*` di
`%LOCALAPPDATA%\Programs`. Jika perlu, set `OPENCLAW_NODE_BINARY` pada terminal ke path `node.exe`
yang kompatibel. Nilai ini bukan secret dan tidak perlu dimasukkan ke konfigurasi plugin.

`toolUrl` pada konfigurasi plugin boleh diisi, tetapi runtime tetap menolak URL non-loopback atau path selain `/internal/tools/rag-query`. Respons yang diteruskan ke agent hanya `answer` dan maksimal empat judul/similarity sumber.
