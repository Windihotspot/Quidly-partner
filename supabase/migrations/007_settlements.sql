-- =====================================================================
-- Settlements: batch completed ticket sales into payouts per partner.
-- Fee model (assumption, change as needed): fee = percent of the sale + a flat amount per ticket,
-- deducted from the partner's payout. Free tickets carry no money and are never settled.
-- Safe to re-run.
-- =====================================================================

-- 1. Settlements ---------------------------------------------------------------
create table if not exists public.settlements (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  partner_id           uuid not null references public.partners(id),
  bank_account_id      uuid references public.partner_bank_accounts(id),
  -- snapshot of the payout destination at the time of settlement
  bank_name            text not null,
  bank_code            text not null,
  account_number       text not null,
  account_name         text not null,
  period_start         timestamptz not null,
  period_end           timestamptz not null,
  gross                numeric(14,2) not null check (gross >= 0),
  fees                 numeric(14,2) not null check (fees >= 0),
  refunds              numeric(14,2) not null default 0 check (refunds >= 0),
  net                  numeric(14,2) not null check (net >= 0),
  currency             text not null default 'NGN',
  transaction_count    integer not null,
  ticket_count         integer not null,
  status               text not null default 'pending'
                         check (status in ('pending','processing','paid','failed','cancelled')),
  payout_method        text check (payout_method in ('manual','gateway')),
  payout_reference     text,
  gateway_transfer_code text,
  failure_reason       text,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists settlements_partner_idx on public.settlements (partner_id, created_at desc);
create index if not exists settlements_status_idx  on public.settlements (status);

drop trigger if exists trg_settlements_updated_at on public.settlements;
create trigger trg_settlements_updated_at
  before update on public.settlements
  for each row execute function public.set_updated_at();

-- Server-only table: no client policies, so nobody can read or write it with the anon key.
alter table public.settlements enable row level security;

-- 2. Link sales to settlements ------------------------------------------------------
alter table public.transactions
  add column if not exists settlement_id   uuid references public.settlements(id),
  add column if not exists platform_fee    numeric(14,2),
  add column if not exists refunded_amount numeric(14,2) not null default 0;

alter table public.transactions drop constraint if exists transactions_refund_range;
alter table public.transactions
  add constraint transactions_refund_range check (refunded_amount >= 0 and refunded_amount <= amount);

create index if not exists transactions_settle_idx
  on public.transactions (partner_id, completed_at)
  where status = 'completed' and settlement_id is null and amount > 0;
create index if not exists transactions_settlement_idx on public.transactions (settlement_id);

-- 3. Per-partner fee override + cached gateway recipient --------------------------------
alter table public.partners
  add column if not exists platform_fee_percent numeric(5,2)
    check (platform_fee_percent is null or (platform_fee_percent >= 0 and platform_fee_percent <= 100));

alter table public.partner_bank_accounts
  add column if not exists gateway_recipient_code text;

-- 4. Fee expression (single definition, used by every function below) ---------------------
create or replace function public.sale_fee(p_amount numeric, p_quantity integer, p_percent numeric, p_flat numeric)
returns numeric language sql immutable as $$
  select least(p_amount, round(p_amount * p_percent / 100 + p_flat * p_quantity, 2))
$$;

-- 5. Atomic settlement creation -------------------------------------------------------------
-- Locks eligible sales (skip locked => two concurrent runs can never settle the same sale),
-- computes totals, then writes the settlement and stamps the sales in one transaction.
create or replace function public.create_settlement(
  p_partner_id  uuid,
  p_cutoff      timestamptz,
  p_fee_percent numeric,
  p_fee_flat    numeric,
  p_min_payout  numeric,
  p_after_event boolean default false,
  p_dry_run     boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acct    public.partner_bank_accounts%rowtype;
  v_ids   uuid[];
  v_gross numeric; v_fees numeric; v_refunds numeric; v_net numeric;
  v_count integer; v_tickets integer; v_start timestamptz;
  v_sid   uuid; v_ref text;
begin
  select * into acct from public.partner_bank_accounts
   where partner_id = p_partner_id and is_active and is_verified
   order by created_at desc limit 1;
  if not found then
    return jsonb_build_object('created', false, 'reason', 'no_payout_account');
  end if;

  select array_agg(t.id) into v_ids from (
    select tx.id from public.transactions tx
     where tx.partner_id = p_partner_id
       and tx.status = 'completed'
       and tx.settlement_id is null
       and tx.amount > 0
       and tx.completed_at <= p_cutoff
       and (not p_after_event or exists (
             select 1 from public.events e where e.id = tx.event_id and e.ends_at <= p_cutoff))
     for update of tx skip locked
  ) t;

  if v_ids is null then
    return jsonb_build_object('created', false, 'reason', 'nothing_to_settle');
  end if;

  select coalesce(sum(tx.amount), 0),
         coalesce(sum(public.sale_fee(tx.amount, tx.quantity, p_fee_percent, p_fee_flat)), 0),
         coalesce(sum(tx.refunded_amount), 0),
         count(*), coalesce(sum(tx.quantity), 0), min(tx.completed_at)
    into v_gross, v_fees, v_refunds, v_count, v_tickets, v_start
    from public.transactions tx where tx.id = any(v_ids);

  v_net := v_gross - v_fees - v_refunds;

  if v_net < p_min_payout then
    return jsonb_build_object('created', false, 'reason', 'below_minimum', 'net', v_net, 'gross', v_gross);
  end if;

  if p_dry_run then
    return jsonb_build_object('created', false, 'dry_run', true, 'reason', 'would_settle',
      'gross', v_gross, 'fees', v_fees, 'refunds', v_refunds, 'net', v_net, 'transaction_count', v_count);
  end if;

  v_ref := 'STL-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-' ||
           upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.settlements
    (reference, partner_id, bank_account_id, bank_name, bank_code, account_number, account_name,
     period_start, period_end, gross, fees, refunds, net, transaction_count, ticket_count, status)
  values
    (v_ref, p_partner_id, acct.id, acct.bank_name, acct.bank_code, acct.account_number, acct.account_name,
     v_start, p_cutoff, v_gross, v_fees, v_refunds, v_net, v_count, v_tickets, 'pending')
  returning id into v_sid;

  update public.transactions tx
     set settlement_id = v_sid,
         platform_fee  = public.sale_fee(tx.amount, tx.quantity, p_fee_percent, p_fee_flat)
   where tx.id = any(v_ids);

  return jsonb_build_object('created', true, 'settlement_id', v_sid, 'reference', v_ref,
    'gross', v_gross, 'fees', v_fees, 'refunds', v_refunds, 'net', v_net, 'transaction_count', v_count);
end $$;

-- 6. Which partners have anything to settle -------------------------------------------------
create or replace function public.settlement_candidate_partners(p_cutoff timestamptz)
returns table (partner_id uuid) language sql stable security definer set search_path = public as $$
  select distinct tx.partner_id from public.transactions tx
   where tx.status = 'completed' and tx.settlement_id is null and tx.amount > 0 and tx.completed_at <= p_cutoff
$$;

-- 7. A partner's not-yet-settled balance (shown on the settlements page) -----------------------
create or replace function public.partner_unsettled(p_partner_id uuid, p_fee_percent numeric, p_fee_flat numeric)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'gross',        coalesce(sum(amount), 0),
    'fees',         coalesce(sum(public.sale_fee(amount, quantity, p_fee_percent, p_fee_flat)), 0),
    'refunds',      coalesce(sum(refunded_amount), 0),
    'transactions', count(*)
  )
  from public.transactions
  where partner_id = p_partner_id and status = 'completed' and settlement_id is null and amount > 0
$$;

-- 8. Server-only ---------------------------------------------------------------------------------
revoke all on function public.create_settlement(uuid, timestamptz, numeric, numeric, numeric, boolean, boolean) from public, anon, authenticated;
revoke all on function public.settlement_candidate_partners(timestamptz)                                        from public, anon, authenticated;
revoke all on function public.partner_unsettled(uuid, numeric, numeric)                                         from public, anon, authenticated;
grant execute on function public.create_settlement(uuid, timestamptz, numeric, numeric, numeric, boolean, boolean) to service_role;
grant execute on function public.settlement_candidate_partners(timestamptz)                                        to service_role;
grant execute on function public.partner_unsettled(uuid, numeric, numeric)                                         to service_role;
