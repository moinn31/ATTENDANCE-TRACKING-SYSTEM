-- Test simple table creation
create table if not exists public.test_table (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
