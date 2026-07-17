# Agent instructions

## Scope

- Work only inside this isolated integration lab.
- Never inspect, import, edit, or infer the Panenin main application repository.
- Read `docs/Panduan_Implementasi_Gemini_RAG_Fonnte_Panenin.pdf` and `docs/IMPLEMENTATION_NOTES.md` before changing architecture.

## Safety boundaries

- Do not implement transaction, listing, stock, order, escrow, payment, or withdrawal mutations.
- Do not let model output execute actions or write transaction data.
- OpenClaw is the only allowed agent runtime. Do not add LangChain, CrewAI, AutoGen, another agent framework, or a local database substitute for Supabase.
- OpenClaw must not receive the Supabase service-role key, Gemini API key, Fonnte token, or raw phone number.
- OpenClaw must not execute SQL, shell commands, unrestricted browser/filesystem access, bulk messaging, or transaction mutations.
- Bind the OpenClaw gateway and internal tool server to loopback only.
- Panenin skills must be authored and reviewed locally. Do not install third-party skills from ClawHub.
- The only initial OpenClaw tool is the optional, allowlisted `panenin_rag_query` tool.
- Every agent capability remains read-only or draft-only.
- Never commit or log `.env`, credentials, complete phone numbers, QR/session files, or raw production webhook payloads.
- Treat Fonnte payload fields as unverified until checked against an actual sanitized fixture.

## Quality gate

- Node.js 20+, TypeScript strict, dependency injection at external boundaries.
- Run `npm run typecheck` and `npm test` after changes.
- Keep `docs/IMPLEMENTATION_STATUS.md` current.
