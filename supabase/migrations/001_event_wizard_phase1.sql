-- =====================================================================
-- Quidly: Phase 1 storage for the partner event-creation wizard
-- Run in the Supabase SQL editor (or as a migration). Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Resolves the partner row for the logged-in user.
-- SECURITY DEFINER so RLS policies on other tables can call it cheaply.
create or replace function public.current_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.partners where auth_user_id = auth.uid() limit 1
$$;

-- ---------------------------------------------------------------------
-- 1. events: draft-first lifecycle + wizard fields
-- ---------------------------------------------------------------------
alter table public.events drop constraint if exists events_status_check;

-- Existing 'active' rows become 'published'
update public.events set status = 'published' where status = 'active';

alter table public.events
  add column if not exists slug          text,
  add column if not exists format        text,
  add column if not exists country       text,
  add column if not exists venue_name    text,
  add column if not exists address       text,
  add column if not exists latitude      numeric,
  add column if not exists longitude     numeric,
  add column if not exists timezone      text default 'Africa/Lagos',
  add column if not exists starts_at     timestamptz,
  add column if not exists ends_at       timestamptz,
  add column if not exists categories    text[] not null default '{}',
  add column if not exists theme         text,
  add column if not exists socials       jsonb  not null default '{}',
  add column if not exists published_at  timestamptz;

-- Drafts don't have these yet; price now lives on ticket_types
alter table public.events
  alter column event_date   drop not null,
  alter column ticket_price drop not null,
  alter column status       set default 'draft';

-- Backfill new timestamptz column from the old timestamp
update public.events
   set starts_at = event_date at time zone 'Africa/Lagos'
 where starts_at is null and event_date is not null;

alter table public.events
  add constraint events_status_check
    check (status in ('draft','published','cancelled','completed')),
  add constraint events_format_check
    check (format is null or format in ('in_person','online','hybrid')),
  add constraint events_name_len_check
    check (char_length(event_name) <= 75),
  add constraint events_slug_format_check
    check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint events_dates_check
    check (starts_at is null or ends_at is null or ends_at > starts_at);

create unique index if not exists events_slug_key on public.events (slug);
create index if not exists events_partner_idx on public.events (partner_id, status);
create index if not exists events_published_idx on public.events (starts_at) where status = 'published';

-- Auto-generate a slug on insert if none supplied (partner can edit it later)
create or replace function public.events_default_slug()
returns trigger language plpgsql as $$
declare base text;
begin
  if new.slug is null or new.slug = '' then
    base := regexp_replace(lower(coalesce(new.event_name, 'event')), '[^a-z0-9]+', '-', 'g');
    base := trim(both '-' from base);
    if base = '' then base := 'event'; end if;
    new.slug := left(base, 50) || '-' || substr(md5(random()::text), 1, 6);
  end if;
  return new;
end $$;

drop trigger if exists trg_events_default_slug on public.events;
create trigger trg_events_default_slug
  before insert on public.events
  for each row execute function public.events_default_slug();

-- Partners can't flip an event to 'published' directly. Only service role
-- (edge functions) or the publish RPC (which sets app.publishing) may.
create or replace function public.events_guard_publish()
returns trigger language plpgsql as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and auth.uid() is not null
     and coalesce(current_setting('app.publishing', true), '') <> 'on' then
    raise exception 'Events must be published through the publish function';
  end if;
  return new;
end $$;

drop trigger if exists trg_events_guard_publish on public.events;
create trigger trg_events_guard_publish
  before insert or update on public.events
  for each row execute function public.events_guard_publish();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. ticket_types
-- ---------------------------------------------------------------------
create table if not exists public.ticket_types (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  name          text not null check (char_length(name) <= 75),
  description   text check (description is null or char_length(description) <= 280),
  kind          text not null default 'single' check (kind in ('single','group')),
  group_size    integer,
  is_free       boolean not null default false,
  invite_only   boolean not null default false,
  price         numeric not null default 0 check (price >= 0),
  currency      text not null default 'NGN',
  quantity      integer check (quantity is null or quantity > 0),  -- null = unlimited
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  max_per_order integer not null default 5 check (max_per_order > 0),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ticket_types_price_rule
    check ((is_free and price = 0) or (not is_free and price > 0)),
  constraint ticket_types_group_rule
    check ((kind = 'single' and group_size is null) or (kind = 'group' and group_size >= 2)),
  constraint ticket_types_sold_lte_qty
    check (quantity is null or quantity_sold <= quantity)
);

create index if not exists ticket_types_event_idx on public.ticket_types (event_id, sort_order);

drop trigger if exists trg_ticket_types_updated_at on public.ticket_types;
create trigger trg_ticket_types_updated_at
  before update on public.ticket_types
  for each row execute function public.set_updated_at();

-- quantity_sold is server-controlled (payments flow), never client-writable
create or replace function public.ticket_types_guard_sold()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.quantity_sold := 0;
    elsif new.quantity_sold is distinct from old.quantity_sold then
      raise exception 'quantity_sold cannot be modified directly';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_ticket_types_guard_sold on public.ticket_types;
create trigger trg_ticket_types_guard_sold
  before insert or update on public.ticket_types
  for each row execute function public.ticket_types_guard_sold();

-- ---------------------------------------------------------------------
-- 3. event_lineups
-- ---------------------------------------------------------------------
create table if not exists public.event_lineups (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  title       text not null,   -- group label, e.g. "Speakers", "Headliners"
  name        text not null,
  image_url   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists event_lineups_event_idx on public.event_lineups (event_id, sort_order);

-- ---------------------------------------------------------------------
-- 4. Link purchases to ticket types
-- ---------------------------------------------------------------------
alter table public.transactions
  add column if not exists ticket_type_id uuid references public.ticket_types(id),
  add column if not exists quantity integer not null default 1 check (quantity > 0);

alter table public.tickets
  add column if not exists ticket_type_id uuid references public.ticket_types(id);

create index if not exists transactions_ticket_type_idx on public.transactions (ticket_type_id);
create index if not exists tickets_ticket_type_idx on public.tickets (ticket_type_id);

-- ---------------------------------------------------------------------
-- 5. RLS
--    NOTE: if events already had policies, review them first:
--    select * from pg_policies where tablename in ('events');
-- ---------------------------------------------------------------------
alter table public.events        enable row level security;
alter table public.ticket_types  enable row level security;
alter table public.event_lineups enable row level security;

-- events
drop policy if exists events_partner_select on public.events;
create policy events_partner_select on public.events
  for select to authenticated
  using (partner_id = public.current_partner_id());

drop policy if exists events_public_select on public.events;
create policy events_public_select on public.events
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists events_partner_insert on public.events;
create policy events_partner_insert on public.events
  for insert to authenticated
  with check (partner_id = public.current_partner_id() and status = 'draft');

drop policy if exists events_partner_update on public.events;
create policy events_partner_update on public.events
  for update to authenticated
  using (partner_id = public.current_partner_id())
  with check (partner_id = public.current_partner_id());

drop policy if exists events_partner_delete on public.events;
create policy events_partner_delete on public.events
  for delete to authenticated
  using (partner_id = public.current_partner_id() and status = 'draft');

-- ticket_types
drop policy if exists ticket_types_partner_all on public.ticket_types;
create policy ticket_types_partner_all on public.ticket_types
  for all to authenticated
  using (exists (select 1 from public.events e
                 where e.id = ticket_types.event_id
                   and e.partner_id = public.current_partner_id()))
  with check (exists (select 1 from public.events e
                      where e.id = ticket_types.event_id
                        and e.partner_id = public.current_partner_id()));

drop policy if exists ticket_types_public_select on public.ticket_types;
create policy ticket_types_public_select on public.ticket_types
  for select to anon, authenticated
  using (invite_only = false
         and exists (select 1 from public.events e
                     where e.id = ticket_types.event_id and e.status = 'published'));

-- event_lineups
drop policy if exists event_lineups_partner_all on public.event_lineups;
create policy event_lineups_partner_all on public.event_lineups
  for all to authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_lineups.event_id
                   and e.partner_id = public.current_partner_id()))
  with check (exists (select 1 from public.events e
                      where e.id = event_lineups.event_id
                        and e.partner_id = public.current_partner_id()));

drop policy if exists event_lineups_public_select on public.event_lineups;
create policy event_lineups_public_select on public.event_lineups
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_lineups.event_id and e.status = 'published'));

-- ---------------------------------------------------------------------
-- 6. Storage: event images (banners + lineup photos)
--    Path convention: {partner_id}/{event_id}/{filename}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists event_images_public_read on storage.objects;
create policy event_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'event-images');

drop policy if exists event_images_partner_insert on storage.objects;
create policy event_images_partner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-images'
              and (storage.foldername(name))[1] = public.current_partner_id()::text);

drop policy if exists event_images_partner_update on storage.objects;
create policy event_images_partner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images'
         and (storage.foldername(name))[1] = public.current_partner_id()::text);

drop policy if exists event_images_partner_delete on storage.objects;
create policy event_images_partner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-images'
         and (storage.foldername(name))[1] = public.current_partner_id()::text);
