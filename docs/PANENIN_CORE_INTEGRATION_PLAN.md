# Panenin Core Integration Plan

Tanggal audit: 2026-07-17

## Ringkasan audit

Repo `panenin-whatsapp-rag-lab` sudah memiliki fondasi OpenClaw, internal RAG tool, hybrid router, dan boundary keamanan untuk lab WhatsApp. Namun workstream `panenin-core-business-tools` belum bisa dimulai penuh karena prasyarat wajib berikut tidak tersedia di repo ini:

- `contracts/panenin-agent-api.openapi.yaml`
- versi kontrak `0.1.0`
- metadata sumber kontrak berupa source repository dan source commit SHA

Tanpa kontrak itu, saya tidak boleh mengarang endpoint, menulis client business tool, atau melanjutkan implementasi mutasi bisnis.

## Arsitektur saat ini

- WhatsApp masuk lewat Fonnte ke webhook lokal aplikasi lab.
- Webhook melakukan normalisasi, sanitasi, deduplication, lalu routing deterministik.
- `TANYA:` dan jalur natural language saat ini sudah bisa diarahkan ke OpenClaw dan fallback RAG lokal.
- Internal tool server saat ini hanya menghidupkan RAG read-only pada `127.0.0.1:3001`.
- OpenClaw gateway berjalan loopback-only dan hanya boleh memanggil tool read-only yang diallowlist.
- Supabase dipakai sebagai runtime database lab untuk knowledge dan state lab, bukan sebagai backend transaksi Panenin.

## Batas proses

- Proses webhook AI tidak boleh menerima credential bisnis Panenin.
- Internal tool broker adalah satu-satunya penghubung menuju Panenin Core.
- OpenClaw tidak boleh mendapat service-role key, Gemini API key, Fonnte token, atau raw phone number.
- Plugin OpenClaw hanya boleh berbicara ke broker loopback.
- Mutation bisnis hanya boleh terjadi setelah preview backend dan konfirmasi eksplisit pengguna.

## Boundary kredensial

Yang sudah ada di lab:

- `FONNTE_*` untuk gateway WhatsApp.
- `SUPABASE_*` untuk storage lab.
- `GEMINI_*` untuk RAG dan klasifikasi.
- `OPENCLAW_*`, `GROQ_*`, `PANENIN_TOOL_SECRET`, `AGENT_SESSION_HMAC_SECRET` untuk runtime agent dan loopback tool.

Yang diminta brief untuk fase berikutnya, tapi belum boleh dipakai sampai kontrak tersedia:

- `PANENIN_AI_SERVICE_TOKEN`
- `WHATSAPP_CHANNEL_HMAC_SECRET`
- `PANENIN_CORE_API_URL`
- `PANENIN_AGENT_CONTRACT_VERSION`

## State machine yang direncanakan

State yang diminta brief:

- `idle`
- `linking`
- `sell_collecting`
- `sell_previewing`
- `sell_waiting_confirmation`
- `buy_collecting`
- `buy_searching`
- `buy_selecting_listing`
- `buy_waiting_confirmation`
- `control_selecting`
- `control_waiting_confirmation`

State itu belum diimplementasikan karena kontrak Panenin Core belum tersedia di repo ini.

## Perintah deterministik

Yang harus tetap ditangani tanpa OpenClaw:

- `MENU`
- `HELP`
- `BANTUAN`
- `BATAL`
- `HUBUNGKAN <CODE>`
- `STATUS AKUN`
- `SETUJUI <CODE>`

Aturan ini tidak berubah. `SETUJUI` dan `BATAL` harus tetap bypass OpenClaw.

## Tool list yang direncanakan

Belum boleh diturunkan ke implementasi sampai kontrak tersedia. Target yang diminta brief:

- `resolveIdentity`
- `linkIdentity`
- `getContext`
- `getInventory`
- `getDemands`
- `getOrders`
- `searchCatalog`
- `previewSell`
- `previewBuy`
- `previewOrder`
- `getControlOverview`
- `previewControlAction`
- `confirmAction`
- `cancelAction`

## Risiko

1. Kontrak OpenAPI belum ada di repo ini.
2. Endpoint Panenin Core bisa saja berbeda dari yang diharapkan brief.
3. Implementasi business tool tanpa kontrak berisiko mengarang path, payload, atau status code.
4. Raw phone number dan secret bisa bocor bila batas identity tidak disiplin.
5. Mutasi bisnis tanpa backend preview akan melanggar batas keamanan yang diminta.

## Fallback yang aman

Sampai kontrak tersedia:

- pertahankan jalur WhatsApp, Fonnte, RAG, dan OpenClaw yang sudah ada,
- jawab bisnis dengan penolakan aman atau fallback edukatif,
- jangan menulis client Panenin Core,
- jangan menambah tool mutasi,
- jangan menambah session state baru yang bergantung pada kontrak.

## Urutan testing nanti

Kalau kontrak sudah tersedia, urutannya:

1. audit kontrak dan cocokkan version.
2. implementasi client Panenin Core yang typed dan tervalidasi.
3. perluasan internal tool broker.
4. perluasan plugin OpenClaw.
5. perluasan session state machine.
6. tambah unit test dan integration mock.
7. jalankan `npm run typecheck`.
8. jalankan `npm test`.
9. jalankan build dan plugin validation.
10. baru jalankan smoke test jaringan bila pengguna menyetujui.

## Rollback plan

- Tetap pertahankan jalur lab lama bila `OPENCLAW_ENABLED=false`.
- Jangan ubah schema atau data Panenin Core dari repo ini.
- Bila nanti implementasi business tool gagal, rollback cukup dengan menonaktifkan wiring baru dan menghapus artefak fase ini.

## Status saat ini

Audit selesai, tetapi workstream ini diblokir sampai kontrak OpenAPI Panenin Core tersedia di repo ini.

## Kesiapan demo yang tetap dapat dijalankan

Fondasi demo WhatsApp, RAG, dan OpenClaw read-only tetap dapat digunakan tanpa Panenin Core.
Audit lokal menemukan terminal default memakai Node `24.14.1`, sementara OpenClaw 2026.7.1
mensyaratkan minimal Node `24.15.0` pada jalur Node 24. Plugin sekarang memakai launcher lokal yang
memilih runtime kompatibel secara deterministik dan tidak mencetak credential. Packaging plugin juga
diselaraskan dengan tool-plugin entry resmi `dist/index.js`; metadata diperiksa dengan mode `--check`
agar quality gate tidak menulis ulang manifest secara diam-diam.

Integrasi berikut tetap sengaja belum dibuat sampai kontrak tersedia:

- env dan client Panenin Core,
- endpoint business tool broker,
- identity linking,
- state preview/confirmation,
- business tools dan skills OpenClaw,
- mock Core integration tests.

Hal tersebut bukan kekurangan implementasi yang boleh ditutup dengan asumsi; path, request, response,
status code, dan version header harus diturunkan dari kontrak `0.1.0` yang asli.
