-- =====================================================================
-- KYC refactor: registered businesses (RC / BN / IT) + unregistered individuals
-- Safe to re-run.
-- =====================================================================

-- 1. New profile fields
alter table public.partner_kyc_submissions
  add column if not exists entity_type    text,
  add column if not exists trading_name   text,
  add column if not exists business_city  text,
  add column if not exists business_state text,
  add column if not exists director_dob   date,
  add column if not exists director_nin   text;

-- 2. Drafts are saved step by step, so these can't be NOT NULL any more
alter table public.partner_kyc_submissions
  alter column legal_business_name drop not null,
  alter column business_address    drop not null,
  alter column director_full_name  drop not null;

-- 3. Constraints
alter table public.partner_kyc_submissions
  drop constraint if exists partner_kyc_submissions_status_check,
  drop constraint if exists partner_kyc_submissions_entity_type_check;

alter table public.partner_kyc_submissions
  add constraint partner_kyc_submissions_status_check
    check (status in ('draft','submitted','under_review','approved','rejected')),
  add constraint partner_kyc_submissions_entity_type_check
    check (entity_type is null or entity_type in ('individual','business_name','limited_company','incorporated_trustees'));

alter table public.partner_kyc_documents
  drop constraint if exists partner_kyc_documents_document_type_check;

alter table public.partner_kyc_documents
  add constraint partner_kyc_documents_document_type_check
    check (document_type in (
      'cac_certificate','valid_id','proof_of_address','bank_statement','tax_clearance',
      'memorandum_of_association','other',
      'cac_status_report','tin_certificate','selfie','constitution'
    ));

-- 4. Existing submissions pre-date entity_type: infer it from the registration number
update public.partner_kyc_submissions
   set entity_type = case
         when upper(business_registration_number) like 'BN%' then 'business_name'
         when upper(business_registration_number) like 'IT%' then 'incorporated_trustees'
         else 'limited_company'
       end
 where entity_type is null and business_registration_number is not null;

-- 5. At most one open draft per partner
create unique index if not exists partner_kyc_one_draft
  on public.partner_kyc_submissions (partner_id) where status = 'draft';

-- 6. Private bucket for KYC documents (no client policies: access is through the edge function only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 5242880, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 7. SECURITY CHECK (run these queries, then decide):
--    The old KYC page wrote to these tables straight from the browser. If any
--    policy lets a partner UPDATE/INSERT here, they could mark their own KYC
--    "approved" or their bank account "verified".
--
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where tablename in ('partner_kyc_submissions','partner_kyc_documents',
--                        'partner_kyc_status_history','partner_bank_accounts','partners');
--
-- Everything now goes through edge functions (service role), so partners need no
-- write access. After reviewing, drop any INSERT/UPDATE/DELETE policies, e.g.:
--   drop policy "<policy name>" on public.partner_kyc_submissions;
-- and make sure RLS is on:
--   alter table public.partner_kyc_submissions       enable row level security;
--   alter table public.partner_kyc_documents         enable row level security;
--   alter table public.partner_kyc_status_history    enable row level security;
--   alter table public.partner_bank_accounts         enable row level security;
-- On `partners`, make sure clients cannot update kyc_status, status or role.
-- ---------------------------------------------------------------------
