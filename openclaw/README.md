# OpenClaw integration (isolated lab)

Folder ini berisi konfigurasi contoh, workspace lokal, dan satu plugin read-only untuk menghubungkan OpenClaw ke RAG Panenin. OpenClaw tidak diberi credential Supabase, Gemini, Fonnte, akses shell, browser, filesystem, atau tool transaksi.

Alur runtime:

`WhatsApp -> Fonnte webhook -> HybridConversationRouter -> OpenClaw gateway -> panenin_rag_query -> internal RAG service -> Gemini/Supabase`

Saat `OPENCLAW_ENABLED=false`, perilaku bot lama tetap digunakan. Saat OpenClaw aktif tetapi gagal, `TANYA:` fallback ke RAG lama; pesan natural-language lain mendapat fallback deterministik.

Mulai dari [panduan setup manual](../docs/OPENCLAW_MANUAL_SETUP.md). Jangan menyalin file konfigurasi contoh sebelum mengganti placeholder model dan memastikan semua secret hanya ada di environment.
