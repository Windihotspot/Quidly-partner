-- Partner settings. All writes go through the edge functions (service role).

create table if not exists public.partner_settings (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  timezone text not null default 'Africa/Lagos',
  notification_email text,
  notify_sale_email boolean not null default true,
  notify_sale_sms boolean not null default false,
  notify_payout_email boolean not null default true,
  notify_kyc_email boolean not null default true,
  notify_webhook_failure_email boolean not null default true,
  notify_weekly_digest boolean not null default false,
  webhook_events text[] not null default array['payment.completed','payment.failed','ticket.issued','ticket.checked_in'],
  webhook_secret_last4 text,
  webhook_secret_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Raw signing secret. RLS on + no policies = readable by the service role only.
create table if not exists public.partner_secrets (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  webhook_secret text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_audit_logs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  actor_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists partner_audit_logs_partner_idx on public.partner_audit_logs (partner_id, created_at desc);
create index if not exists webhook_events_partner_idx on public.webhook_events (partner_id, created_at desc);

alter table public.partner_settings enable row level security;
alter table public.partner_secrets enable row level security;
alter table public.partner_audit_logs enable row level security;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists partner_settings_touch on public.partner_settings;
create trigger partner_settings_touch before update on public.partner_settings
  for each row execute function public.touch_updated_at();

-- Optional hardening: at most one active payout account per partner.
-- Cleans up any existing duplicates first (keeps the newest), so the index can be created.
update public.partner_bank_accounts a set is_active = false
where a.is_active and exists (
  select 1 from public.partner_bank_accounts b
  where b.partner_id = a.partner_id and b.is_active
    and (b.created_at > a.created_at or (b.created_at = a.created_at and b.id > a.id))
);
create unique index if not exists partner_bank_one_active
  on public.partner_bank_accounts (partner_id) where is_active;
