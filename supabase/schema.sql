-- Run once in Supabase SQL Editor. All user content protected by RLS.
create extension if not exists pgcrypto;
create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, created_at timestamptz not null default now(), unique(user_id,name), unique(id,user_id)
);
create table if not exists public.bookmarks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 url text not null check (char_length(url)<=4096 and url ~* '^https?://'),
 normalized_url text not null, title text not null default '', description text not null default '',
 thumbnail_url text, source_type text not null default 'Web', content_text text,
 ai_summary text, personal_memo text not null default '', category_id uuid,
 is_favorite boolean not null default false,
 extraction_status text not null default 'pending' check (extraction_status in ('pending','success','failed','blocked')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,normalized_url), foreign key (category_id,user_id) references public.categories(id,user_id) on delete set null (category_id)
);
create table if not exists public.tags (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, unique(user_id,name), unique(id,user_id)
);
create table if not exists public.bookmark_tags (
 user_id uuid not null references auth.users(id) on delete cascade,
 bookmark_id uuid not null, tag_id uuid not null,
 primary key(bookmark_id,tag_id),
 foreign key(bookmark_id,user_id) references public.bookmarks(id,user_id) on delete cascade,
 foreign key(tag_id,user_id) references public.tags(id,user_id) on delete cascade
);
create table if not exists public.attachments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 bookmark_id uuid not null, storage_path text not null, file_type text, created_at timestamptz default now(),
 foreign key(bookmark_id,user_id) references public.bookmarks(id,user_id) on delete cascade
);
create index if not exists bookmarks_user_created on public.bookmarks(user_id,created_at desc);
create index if not exists bookmarks_user_category on public.bookmarks(user_id,category_id);
create index if not exists bookmarks_user_favorite on public.bookmarks(user_id,is_favorite);
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists bookmarks_updated on public.bookmarks;
create trigger bookmarks_updated before update on public.bookmarks for each row execute function public.set_updated_at();
alter table public.categories enable row level security;
alter table public.bookmarks enable row level security;
alter table public.tags enable row level security;
alter table public.bookmark_tags enable row level security;
alter table public.attachments enable row level security;
do $$ declare t text; begin foreach t in array array['categories','bookmarks','tags','bookmark_tags','attachments'] loop
 execute format('drop policy if exists own_rows on public.%I',t);
 execute format('create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
 end loop; end $$;
