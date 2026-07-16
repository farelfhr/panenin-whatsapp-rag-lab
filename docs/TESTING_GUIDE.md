# Testing Guide

## Gate lokal

```bash
npm install
npm run typecheck
npm test
npm run build
```

Unit test tidak melakukan network call. Gemini, Supabase, dan Fonnte diuji melalui dependency injection dan mock.

## Urutan milestone

1. M0: selesaikan `MANUAL_SETUP_CHECKLIST.md` yang memerlukan dashboard.
2. M1: `npm run test:gemini` dan `npm run test:embedding`.
3. M2: jalankan migration, `npm run rag:ingest`, lalu `npm run rag:test -- "Bagaimana cara packing?"`.
4. M3: `npm run fonnte:test -- 628...` dan uji normalizer dengan fixture tersanitasi.
5. M4-M5: jalankan `npm run dev`, expose `/webhook/fonnte`, lalu uji `MENU`, `TANYA: ...`, `BATAL`, dan fallback dari WhatsApp.
6. M6: catat payload aktual, hasil log yang sudah disanitasi, dan artefak handoff.

## Cakupan unit test

- Router: menu/help, query tepat satu kali, pertanyaan kosong, fallback, cancel reset, dan error fallback.
- RAG: no-answer, sources, embedding dimension 768, dan prompt injection policy.
- Webhook: parse, acknowledgement, duplicate, serta outgoing loop prevention.
- Fonnte: outbound success, HTTP non-2xx, timeout boundary, dan normalizer defensif.
- Intent classifier: schema valid, threshold 0,80, dan JSON invalid.
- Chunker: frontmatter dan overlap.

## Uji payload aktual

Simpan payload hanya setelah menghapus token, secret, nomor lengkap, nama, dan isi pribadi. Cetak struktur tanpa nilai:

```bash
npm run fonnte:inspect -- tests/fixtures/fonnte-text-message.json
```

Normalisasi harus diverifikasi terhadap payload aktual yang disanitasi. TODO di `normalize-fonnte-payload.ts` tidak boleh dihapus sebelum verifikasi manusia.

## Evaluasi keamanan

- Cari secret: `rg -n "AIza|service_role|FONNTE_TOKEN|Authorization:" --glob '!package-lock.json' .`
- Pastikan `.env` tidak terlacak Git.
- Pastikan event `from_me` tidak membuat balasan.
- Pastikan duplicate provider ID hanya diproses sekali.
- Pastikan pertanyaan tentang token/secret mengembalikan no-answer/fallback dan tidak menampilkan environment.
