-- =====================================================================
-- Reference table of Nigerian banks / payout destinations.
-- partner_bank_accounts keeps a snapshot (bank_name, bank_code) per partner;
-- this table only feeds the payout dropdown and name-enquiry lookups.
-- =====================================================================
create table if not exists public.banks (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,          -- stable key (codes are NOT unique)
  code            text not null,                 -- gateway bank code
  category        text not null default 'commercial'
    check (category in ('commercial','microfinance','psb','wallet','mortgage_bank','merchant_bank','finance_company','other')),
  country         text not null default 'NG',
  currency        text not null default 'NGN',
  payout_eligible boolean not null default true, -- false = hidden from payout dropdown
  is_active       boolean not null default true, -- false = retired / duplicate entry
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists banks_code_idx on public.banks (code);
create index if not exists banks_listing_idx on public.banks (country, is_active, payout_eligible, name);

drop trigger if exists trg_banks_updated_at on public.banks;
create trigger trg_banks_updated_at
  before update on public.banks
  for each row execute function public.set_updated_at();

-- Public reference data: readable by logged-in users, writable only by service role
alter table public.banks enable row level security;
drop policy if exists banks_read on public.banks;
create policy banks_read on public.banks for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Payout integrity: at most ONE active payout account per partner.
-- (payout-account deactivates the old one before inserting the new one)
-- Existing data is tidied first so the index can be created.
-- ---------------------------------------------------------------------
update public.partner_bank_accounts a
   set is_active = false
 where a.is_active
   and exists (
     select 1 from public.partner_bank_accounts b
      where b.partner_id = a.partner_id
        and b.is_active
        and (b.created_at, b.id) > (a.created_at, a.id)
   );

create unique index if not exists partner_bank_accounts_one_active
  on public.partner_bank_accounts (partner_id) where is_active;
