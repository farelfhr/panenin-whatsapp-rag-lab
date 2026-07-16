# Handoff Guide

Saat repository utama Panenin siap dan kontrak backend final tersedia, pindahkan artefak secara selektif. Jangan menyalin seluruh folder lab.

## Artefak yang dapat dipindahkan

- `MessagingProvider` abstraction dan `FonnteProvider` adapter setelah payload aktual diverifikasi.
- `NormalizedIncomingMessage` contract dan normalizer/sanitization helper.
- `RagAnswer`, knowledge match contract, dan interface repository.
- Migration knowledge tables, `match_knowledge`, dan tabel webhook yang sudah disesuaikan dengan schema final.
- Markdown loader, frontmatter parser, chunking, embedding, dan ingestion pipeline.
- Fixtures webhook tersanitasi dan regression test yang tidak melakukan network.
- Intent schema/classifier bila router final membutuhkannya.

## Artefak yang tidak dipindahkan otomatis

- `.env`, key, token, QR, session, log, dan data pengguna.
- HTTP server lab dan wiring Supabase service-role yang spesifik eksperimen.
- Knowledge sample yang tidak disetujui pemilik produk.
- Dokumentasi eksperimen dan asumsi yang belum dicocokkan dengan Context Pack final.

## Checklist sebelum merge

- [ ] Akses repository utama tersedia; jangan mengarang nama platform, service, atau environment variable.
- [ ] Cocokkan platform mobile, nama service, data model, dan endpoint dengan Context Pack final.
- [ ] Review RLS, role database, dan batas service-role pada deployment final.
- [ ] Verifikasi payload Fonnte aktual atau ganti provider dengan adapter resmi Meta Cloud API.
- [ ] Jalankan test lab dan test repository utama tanpa network call yang tidak dikontrol.
- [ ] Review prompt injection, secret logging, deduplication, timeout, dan outgoing loop.
- [ ] Minta persetujuan pemilik produk sebelum menambahkan mutation apa pun.

## Kontrak ringkas

```ts
interface MessagingProvider {
  sendText(input: { to: string; text: string }): Promise<{ providerMessageId?: string }>;
  parseWebhook(payload: unknown): NormalizedIncomingMessage[];
}

interface NormalizedIncomingMessage {
  providerMessageId: string;
  sender: string;
  type: "text" | "image" | "audio" | "unknown";
  text?: string;
  raw: unknown;
}

type RagAnswer = {
  answer: string;
  sources: Array<{ title: string; similarity: number }>;
};
```
