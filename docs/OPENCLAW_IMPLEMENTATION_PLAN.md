# OpenClaw Integration Implementation Plan

## Status audit

Tanggal audit: 2026-07-17

- Repository yang disentuh hanya `panenin-whatsapp-rag-lab`.
- Branch lokal: `feat/openclaw-integration`.
- Node sistem: v24.14.1; OpenClaw membutuhkan Node 24.15+.
- User-level portable Node v24.18.0 tersedia di `C:\Users\user\AppData\Local\Programs\node-v24.18.0`.
- OpenClaw 2026.7.1 terpasang dan `openclaw --version` terverifikasi dengan portable Node.
- `openclaw plugins validate` berhasil; smoke test model/gateway tetap menunggu credential dan konfigurasi lokal.
- Worktree sudah memiliki perubahan pengguna pada README, implementation status, Fonnte provider, dan test Fonnte; perubahan tersebut dipertahankan.

## Kondisi arsitektur sekarang

- `src/index.ts` membuat HTTP server lab, Gemini client, Supabase server client, Fonnte provider, retriever, deterministic `ConversationRouter`, dan webhook handler melalui dependency injection.
- `ConversationRouter` saat ini menangani `MENU`/`HELP`/`BANTUAN`, `TANYA:`, `BATAL`, dan fallback tanpa agent runtime.
- Pipeline RAG sudah dipisah menjadi chunker, ingestion, retriever, dan answer generator.
- Supabase adalah database runtime satu-satunya dan client server diarahkan ke schema `panenin_ai_lab`.
- Webhook menormalisasi payload, menyaring event outgoing, melakukan dedup berdasarkan provider message ID, menyimpan payload tersanitasi, lalu dispatch asynchronous.
- `FonnteProvider` adalah batas vendor untuk pengiriman text dan parsing webhook.
- Source sekarang memiliki client OpenClaw/Olagon, hybrid router, internal tool, plugin, workspace, dan dokumentasi seperti dirinci pada fase implementasi.

## Blocker dan compatibility concern

Format config, gateway endpoint, dan Plugin SDK dicocokkan dengan OpenClaw 2026.7.1 yang terpasang; manifest plugin sudah lolos validasi runtime.

OpenClaw juga tidak boleh menerima `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, atau kredensial Fonnte. OpenClaw hanya boleh memanggil tool RAG internal melalui loopback dan shared tool secret.

Olagon API compatibility belum dapat diverifikasi. Direct test hanya boleh dijalankan setelah model ID dan credential lokal tersedia serta pengguna menyetujui satu network request.

Fonnte inbound tetap provider boundary yang tidak boleh ditulis ulang. OpenClaw integration harus masuk melalui hybrid router dan tidak boleh mengubah deduplication, acknowledgement, sanitization, atau Supabase webhook store.

## File yang ditambahkan

- `src/agent/agent-gateway.ts`
- `src/agent/openclaw-client.ts`
- `src/agent/session-id.ts`
- `src/agent/fallback.ts`
- `src/conversation/hybrid-router.ts`
- `src/internal-tools/server.ts`
- `src/internal-tools/authenticate.ts`
- `src/internal-tools/rag-query-handler.ts`
- `scripts/test-olagon.ts`
- `scripts/test-openclaw.ts`
- `scripts/test-openclaw-rag.ts`
- `openclaw/config/openclaw.example.json5`
- `openclaw/README.md`
- `openclaw/workspace/AGENTS.md`
- `openclaw/workspace/SOUL.md`
- `openclaw/workspace/TOOLS.md`
- `openclaw/workspace/skills/knowledge-rag/SKILL.md`
- `openclaw/workspace/skills/harvest-intake/SKILL.md`
- `openclaw/workspace/skills/sales-planner/SKILL.md`
- `openclaw/plugins/panenin-tools/package.json`
- `openclaw/plugins/panenin-tools/tsconfig.json`
- `openclaw/plugins/panenin-tools/openclaw.plugin.json`
- `openclaw/plugins/panenin-tools/src/index.ts`
- `openclaw/plugins/panenin-tools/tests/*`
- `docs/OPENCLAW_MANUAL_SETUP.md`
- `docs/OPENCLAW_INTEGRATION.md`
- `docs/OPENCLAW_SECURITY.md`
- `docs/OPENCLAW_TEST_MATRIX.md`
- `tests/openclaw-client.test.ts`
- `tests/session-id.test.ts`
- `tests/hybrid-router.test.ts`
- `tests/internal-rag-tool.test.ts`

## File yang diubah

- `AGENTS.md`: menegaskan OpenClaw sebagai satu-satunya runtime agent yang diizinkan, loopback-only gateway, read-only/draft-only, dan tool allowlist.
- `.env.example`: menambahkan variable OpenClaw, Olagon, internal tool, dan HMAC tanpa nilai rahasia.
- `src/config/env.ts`: schema Zod conditional berdasarkan `OPENCLAW_ENABLED`, secret minimum 24 karakter, loopback validation, dan tanpa default model tebakan.
- `src/index.ts`: wiring hybrid router dan dependency injection tanpa menyalin wiring Fonnte/Supabase.
- `package.json`: script test/build yang diperlukan; dependency tambahan hanya bila SDK versi terpasang benar-benar memerlukannya.
- `README.md`, `docs/IMPLEMENTATION_STATUS.md`, dan dokumentasi setup/testing: runbook OpenClaw dan stop conditions.

Tidak ada migration Supabase yang direncanakan. Tidak ada schema selain `panenin_ai_lab` yang boleh disentuh.

## Risiko

1. Config atau Plugin SDK OpenClaw berubah antarversi.
2. Olagon endpoint Anthropic-compatible dapat memiliki response atau tool-calling yang berbeda.
3. Query token webhook dapat bocor pada URL/log; dipakai hanya untuk demo, bukan pola production.
4. Session ID yang salah dapat membocorkan nomor sender; wajib HMAC dan tidak boleh mengirim nomor asli.
5. Hybrid fallback dapat menimbulkan duplicate send bila retry tidak dibatasi.
6. Prompt injection dapat mencoba meminta secret atau tool di luar allowlist.
7. Skill harvest/sales dapat melebar menjadi mutation; semua output harus draft-only.
8. Tool internal yang bind ke non-loopback dapat mengekspos RAG ke jaringan.

## Rollback plan

- Jangan menimpa `~/.openclaw/openclaw.json`; semua config dimulai dari template example dan command additive.
- `OPENCLAW_ENABLED=false` harus mempertahankan perilaku `ConversationRouter` lama.
- Rollback aplikasi dilakukan dengan menghapus wiring hybrid router dan file agent/internal-tool/plugin baru; Fonnte provider, webhook, Supabase store, dan router lama tetap dipertahankan.
- Rollback tidak menghapus atau mengubah data Supabase karena tidak ada migration baru.
- Plugin hanya dilink secara lokal setelah persetujuan; uninstall/disable plugin tidak mengubah root package.

## Urutan testing

1. Setelah OpenClaw tersedia, catat `openclaw --version` dan jalankan `openclaw doctor` tanpa credential di output.
2. Jalankan `npm install`, `npm run typecheck`, `npm test`, dan `npm run build` untuk baseline.
3. Jalankan unit test agent, session ID, hybrid router, internal tool, dan plugin dengan network dimock.
4. Build dan validasi plugin sesuai CLI OpenClaw yang terpasang.
5. Isi environment lokal; tidak mencetak secret.
6. Dengan persetujuan pengguna, lakukan maksimal satu `npm run test:olagon`.
7. Start internal RAG tool pada `127.0.0.1`, lalu start OpenClaw gateway loopback-only.
8. Jalankan `npm run test:openclaw` dan kemudian `npm run test:openclaw:rag` masing-masing sesuai stop condition.
9. Verifikasi existing Fonnte webhook, deduplication, outgoing filter, dan router tests tetap lulus.
10. Jangan menunnel port OpenClaw atau internal tool; hanya port Fonnte gateway yang boleh dipublikasikan.

## Gate saat ini

Pekerjaan berhenti setelah audit dan pembuatan rencana ini karena CLI OpenClaw belum tersedia. Instalasi global memerlukan persetujuan pengguna sesuai instruksi pekerjaan. Tidak ada source code OpenClaw, plugin, skill, credential, atau network test yang dibuat/dijalankan pada tahap ini.
