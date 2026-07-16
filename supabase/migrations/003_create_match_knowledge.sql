create or replace function public.match_knowledge(
  query_embedding extensions.vector(768),
  match_threshold float default 0.62,
  match_count int default 5
)
returns table (
  chunk_id bigint,
  title text,
  content text,
  similarity float
)
language sql stable
as $$
  select kc.id,
         kd.title,
         kc.content,
         1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  where kd.status = 'active'
    and 1 - (kc.embedding <=> query_embedding) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
