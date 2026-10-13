-- Run in Supabase SQL editor. Also enable: Authentication > Providers > Anonymous sign-ins.
create table if not exists public.scores (
  user_id uuid primary key default auth.uid(),
  name text not null check (char_length(name) between 1 and 32),
  score integer not null default 0 check (score >= 0 and score < 1000000),
  updated_at timestamptz not null default now()
);
alter table public.scores enable row level security;
create policy "scores readable by all" on public.scores for select using (true);
create policy "insert own row" on public.scores for insert to authenticated with check (auth.uid() = user_id);
create policy "update own row" on public.scores for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.scores;
