create table if not exists public.waitlist_contacts (
  id uuid primary key,
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  marketing_consent boolean not null default false,
  source text not null default 'HiLex Individuals waitlist'
);

alter table public.waitlist_contacts enable row level security;

create policy "Service role can manage waitlist contacts"
on public.waitlist_contacts
for all
to service_role
using (true)
with check (true);
