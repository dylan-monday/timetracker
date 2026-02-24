-- Add line_order column to profiles for cross-device row ordering
-- Stores an array of project IDs representing the user's preferred row order

alter table public.profiles
add column if not exists line_order text[] default '{}';

comment on column public.profiles.line_order is 'User-defined order of project rows in the week view';
