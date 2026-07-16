create table if not exists public.incoming_messages (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique,
  sender text not null,
  message_type text not null,
  text_body text,
  raw_payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  received_at timestamptz not null default now()
);

create table if not exists public.conversation_sessions (
  sender text primary key,
  current_intent text,
  state text not null default 'idle',
  context jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
