-- Ticket issuance, delivery tracking, and door check-in

-- ---------- storage: private bucket for the per-order ticket PDFs (service role only, no policies) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-pdfs', 'ticket-pdfs', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- ---------- email delivery state (one row per order) ----------
create table if not exists public.ticket_deliveries (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  resend_count integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  pdf_path text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ticket_deliveries_due_idx on public.ticket_deliveries (status, last_attempt_at);
drop trigger if exists ticket_deliveries_touch on public.ticket_deliveries;
create trigger ticket_deliveries_touch before update on public.ticket_deliveries
  for each row execute function public.touch_updated_at();

-- ---------- every scan attempt, valid or not ----------
create table if not exists public.ticket_scans (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  event_id uuid not null references public.events(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  result text not null,   -- admitted | already_used | cancelled | wrong_event | not_found | event_cancelled | invalid
  method text not null default 'qr' check (method in ('qr','manual')),
  scanned_by uuid,
  device text,
  note text,
  scanned_at timestamptz not null default now()
);
create index if not exists ticket_scans_event_idx on public.ticket_scans (event_id, scanned_at desc);
create index if not exists ticket_scans_ticket_idx on public.ticket_scans (ticket_id);

alter table public.ticket_deliveries enable row level security;
alter table public.ticket_scans enable row level security;

-- ---------- exactly-once admission ----------
-- The row lock means two phones scanning the same code at the same instant cannot both be admitted.
create or replace function public.admit_ticket(
  p_ticket_reference text, p_partner_id uuid, p_event_id uuid, p_scanned_by uuid,
  p_device text default null, p_method text default 'qr'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.tickets%rowtype;
  ev public.events%rowtype;
  tt public.ticket_types%rowtype;
  v_found boolean;
  v_mine boolean := false;
  v_result text;
  v_prev timestamptz;
  v_checked timestamptz;
begin
  select * into t from public.tickets where ticket_reference = p_ticket_reference for update;
  v_found := found;
  if v_found then
    select * into ev from public.events where id = t.event_id;
    v_mine := (ev.partner_id = p_partner_id);
    select * into tt from public.ticket_types where id = t.ticket_type_id;
  end if;

  if not v_found or not v_mine then
    v_result := 'not_found';              -- never reveal other partners' tickets
  elsif t.event_id <> p_event_id then
    v_result := 'wrong_event';
  elsif ev.status = 'cancelled' then
    v_result := 'event_cancelled';
  elsif t.status = 'cancelled' then
    v_result := 'cancelled';
  elsif t.status = 'used' then
    v_result := 'already_used';
    v_prev := t.checked_in_at;
  else
    update public.tickets set status = 'used', checked_in_at = now(), updated_at = now()
      where id = t.id returning checked_in_at into v_checked;
    v_result := 'admitted';
  end if;

  insert into public.ticket_scans (ticket_id, event_id, partner_id, result, method, scanned_by, device)
  values (case when v_mine then t.id end, p_event_id, p_partner_id, v_result, p_method, p_scanned_by, p_device);

  return jsonb_build_object(
    'result', v_result,
    'ticket', case when v_mine then jsonb_build_object(
      'id', t.id, 'reference', t.ticket_reference, 'holder', t.customer_name,
      'ticket_type', tt.name, 'kind', tt.kind, 'group_size', tt.group_size,
      'checked_in_at', coalesce(v_checked, t.checked_in_at), 'previous_checked_in_at', v_prev) end
  );
end $$;

create or replace function public.event_checkin_stats(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'issued', count(*) filter (where status <> 'cancelled'),
    'admitted', count(*) filter (where status = 'used'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'by_type', coalesce((
      select jsonb_agg(x order by x->>'sort') from (
        select jsonb_build_object(
          'sort', lpad(tt.sort_order::text, 6, '0'), 'name', tt.name,
          'issued', count(*) filter (where t2.status <> 'cancelled'),
          'admitted', count(*) filter (where t2.status = 'used')) as x
        from public.tickets t2 join public.ticket_types tt on tt.id = t2.ticket_type_id
        where t2.event_id = p_event_id group by tt.id, tt.name, tt.sort_order) s), '[]'::jsonb))
  from public.tickets where event_id = p_event_id $$;

revoke all on function public.admit_ticket(text, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.event_checkin_stats(uuid) from public, anon, authenticated;
grant execute on function public.admit_ticket(text, uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.event_checkin_stats(uuid) to service_role;

-- ---------- retry job (run once, with your real project URL and CRON_SECRET) ----------
-- select cron.schedule('ticket-delivery-retry', '*/5 * * * *', $$
--   select net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/ticket-delivery-retry',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb) $$);
