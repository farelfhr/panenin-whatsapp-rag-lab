# Tools yang diizinkan

## `panenin_rag_query`

Tool read-only untuk menjawab pertanyaan dari knowledge Panenin yang sudah ada. Input utama adalah `question` (3-1000 karakter); `category` hanya label opsional dan belum menjadi filter database.

Tool tidak mengembalikan embedding, row Supabase, atau chunk mentah. Tool tidak mendukung mutasi apa pun.
