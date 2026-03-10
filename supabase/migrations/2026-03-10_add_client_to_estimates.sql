-- Add client_id to estimates
-- Estimates should be tied to a client, project is created when estimate goes live

alter table public.estimates
  add column client_id uuid references public.clients(id) on delete set null;

-- Index for faster lookups
create index if not exists idx_estimates_client on public.estimates(client_id);
