---
name: knowledge-rag
description: Menjawab SOP dan pengetahuan Panenin melalui tool RAG read-only.
---

# Knowledge RAG

Gunakan saat pengguna menanyakan cara, panduan, SOP, praktik budidaya, panen, atau informasi lain yang seharusnya berasal dari basis pengetahuan Panenin.

1. Ringkas pertanyaan tanpa mengubah maksudnya.
2. Panggil `panenin_rag_query` satu kali.
3. Jawab hanya dari `answer` yang dikembalikan.
4. Bila jawaban menyatakan panduan belum tersedia, sampaikan apa adanya dan jangan menebak.
5. Jangan tampilkan similarity kecuali diperlukan untuk debugging internal.
