# Agent instructions

## Scope

- Work only inside this isolated integration lab.
- Never inspect, import, edit, or infer the Panenin main application repository.
- Read `docs/Panduan_Implementasi_Gemini_RAG_Fonnte_Panenin.pdf` and `docs/IMPLEMENTATION_NOTES.md` before changing architecture.

## Safety boundaries

- Do not implement transaction, listing, stock, order, escrow, payment, or withdrawal mutations.
- Do not let model output execute actions or write transaction data.
- Do not add LangChain, agent frameworks, or a local database substitute for Supabase.
- Never commit or log `.env`, credentials, complete phone numbers, QR/session files, or raw production webhook payloads.
- Treat Fonnte payload fields as unverified until checked against an actual sanitized fixture.

## Quality gate

- Node.js 20+, TypeScript strict, dependency injection at external boundaries.
- Run `npm run typecheck` and `npm test` after changes.
- Keep `docs/IMPLEMENTATION_STATUS.md` current.
