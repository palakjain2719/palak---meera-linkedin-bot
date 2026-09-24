-- Optional. Run this in the Supabase SQL editor only when you want the memory layer.

create table if not exists notes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  chat_id text not null,
  telegram_message_id bigint,
  text text not null,
  score int,
  reason text,
  passed boolean
);

create table if not exists drafts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  chat_id text not null,
  note_id bigint references notes(id),
  body text not null,
  news_url text,
  status text not null default 'pending',
  resolved_at timestamptz
);

-- Rejected notes and rejected drafts are kept, never deleted.
create index if not exists drafts_pending_idx on drafts (chat_id, status, created_at desc);
