-- Aggregates payment stats for the partner dashboard in one round trip.
-- service_role only (called from the dashboard-overview edge function).
create or replace function public.partner_dashboard_stats(p_partner_id uuid, p_since timestamptz default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_payments', count(*),
    'successful',     count(*) filter (where status = 'completed'),
    'failed',         count(*) filter (where status = 'failed'),
    'pending',        count(*) filter (where status in ('pending', 'processing')),
    'cancelled',      count(*) filter (where status = 'cancelled'),
    'revenue',        coalesce(sum(amount)   filter (where status = 'completed'), 0),
    'tickets_sold',   coalesce(sum(quantity) filter (where status = 'completed'), 0)
  )
  from public.transactions
  where partner_id = p_partner_id
    and (p_since is null or created_at >= p_since)
$$;

revoke all on function public.partner_dashboard_stats(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.partner_dashboard_stats(uuid, timestamptz) to service_role;

-- Dashboard "recent orders" and stats read by partner_id + recency
create index if not exists transactions_partner_created_idx on public.transactions (partner_id, created_at desc);
