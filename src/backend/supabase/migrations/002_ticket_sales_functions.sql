-- =====================================================================
-- Quidly: atomic stock + ticket issuing for the payment widget
-- quantity_sold = sold + currently reserved (15 min hold on pending orders)
-- All functions are service_role only (called from edge functions).
-- =====================================================================

create or replace function public.reserve_ticket_stock(p_ticket_type_id uuid, p_qty integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare t public.ticket_types%rowtype;
begin
  if p_qty is null or p_qty < 1 then return false; end if;
  select * into t from public.ticket_types where id = p_ticket_type_id for update;
  if not found then return false; end if;
  if t.quantity is not null and t.quantity_sold + p_qty > t.quantity then return false; end if;
  update public.ticket_types set quantity_sold = quantity_sold + p_qty where id = p_ticket_type_id;
  return true;
end $$;

create or replace function public.release_ticket_stock(p_ticket_type_id uuid, p_qty integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ticket_types
     set quantity_sold = greatest(quantity_sold - greatest(p_qty, 0), 0)
   where id = p_ticket_type_id;
end $$;

-- Idempotent: safe to call repeatedly for the same reference (webhook retries).
create or replace function public.complete_transaction(p_reference text, p_gateway_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tx public.transactions%rowtype;
  i integer;
  ref text;
  tickets_json jsonb;
begin
  select * into tx from public.transactions where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'transaction_not_found');
  end if;

  if tx.status <> 'completed' then
    if tx.status = 'cancelled' and tx.failed_reason = 'expired' then
      -- customer paid after the hold expired: try to re-take the stock
      if tx.ticket_type_id is null or not public.reserve_ticket_stock(tx.ticket_type_id, tx.quantity) then
        update public.transactions
           set failed_reason = 'paid_after_expiry_sold_out', updated_at = now()
         where id = tx.id;
        return jsonb_build_object('ok', false, 'reason', 'sold_out_after_payment');
      end if;
    elsif tx.status in ('failed', 'cancelled') then
      return jsonb_build_object('ok', false, 'reason', 'transaction_closed');
    end if;

    update public.transactions
       set status = 'completed',
           completed_at = now(),
           failed_reason = null,
           payment_gateway_ref = coalesce(p_gateway_ref, payment_gateway_ref),
           updated_at = now()
     where id = tx.id;

    for i in 1..tx.quantity loop
      ref := 'QT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
      insert into public.tickets
        (transaction_id, event_id, ticket_type_id, ticket_reference, qr_code_data, customer_name, customer_email)
      values
        (tx.id, tx.event_id, tx.ticket_type_id, ref, ref, tx.customer_name, tx.customer_email);
    end loop;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'reference', t.ticket_reference, 'qr_code_data', t.qr_code_data
         ) order by t.created_at), '[]'::jsonb)
    into tickets_json
    from public.tickets t where t.transaction_id = tx.id;

  return jsonb_build_object('ok', true, 'status', 'completed', 'tickets', tickets_json);
end $$;

create or replace function public.fail_transaction(p_reference text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tx public.transactions%rowtype;
begin
  select * into tx from public.transactions where reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false); end if;

  if tx.status in ('pending', 'processing') then
    update public.transactions
       set status = 'failed', failed_reason = p_reason, updated_at = now()
     where id = tx.id;
    if tx.ticket_type_id is not null then
      perform public.release_ticket_stock(tx.ticket_type_id, tx.quantity);
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Releases holds on abandoned checkouts. Schedule every 5 minutes (see bottom).
create or replace function public.release_expired_transactions(p_minutes integer default 15)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select id, ticket_type_id, quantity
      from public.transactions
     where status = 'pending'
       and created_at < now() - make_interval(mins => p_minutes)
       for update skip locked
  loop
    update public.transactions
       set status = 'cancelled', failed_reason = 'expired', updated_at = now()
     where id = r.id;
    if r.ticket_type_id is not null then
      perform public.release_ticket_stock(r.ticket_type_id, r.quantity);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Lock these down: never callable from the browser.
revoke all on function public.reserve_ticket_stock(uuid, integer)        from public, anon, authenticated;
revoke all on function public.release_ticket_stock(uuid, integer)        from public, anon, authenticated;
revoke all on function public.complete_transaction(text, text)           from public, anon, authenticated;
revoke all on function public.fail_transaction(text, text)               from public, anon, authenticated;
revoke all on function public.release_expired_transactions(integer)      from public, anon, authenticated;
grant execute on function public.reserve_ticket_stock(uuid, integer)     to service_role;
grant execute on function public.release_ticket_stock(uuid, integer)     to service_role;
grant execute on function public.complete_transaction(text, text)        to service_role;
grant execute on function public.fail_transaction(text, text)            to service_role;
grant execute on function public.release_expired_transactions(integer)   to service_role;

-- Schedule the hold release (enable the pg_cron extension first):
-- select cron.schedule('release-expired-ticket-holds', '*/5 * * * *',
--   $$ select public.release_expired_transactions(15); $$);
