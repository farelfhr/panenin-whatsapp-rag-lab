---
name: knowledge-rag
description: Menjawab SOP dan pengetahuan Panenin melalui tool RAG read-only.
---

# Knowledge RAG

Gunakan saat pengguna menanyakan cara, panduan, SOP, praktik budidaya, panen, atau informasi lain yang seharusnya berasal dari basis pengetahuan Panenin.

1. Jadikan pertanyaan mandiri dengan memasukkan konteks penting dari pesan sebelumnya, tanpa mengubah maksudnya.
2. Panggil `panenin_rag_query` satu kali.
3. Jawab natural hanya dari `answer` yang dikembalikan; jangan menyebut tool atau istilah RAG.
4. Bila jawaban menyatakan panduan belum tersedia, sampaikan apa adanya dan jangan menebak.
5. Jangan tampilkan similarity kecuali diperlukan untuk debugging internal.
6. Jika pengguna meminta analisis, gabungkan knowledge dengan fakta yang diberikan pengguna dan jelaskan prioritas/trade-off secara ringkas tanpa menambah fakta baru.
7. Jangan memanggil tool untuk sapaan, empati, penulisan ulang, atau analisis yang sepenuhnya dapat dilakukan dari data pengguna.
