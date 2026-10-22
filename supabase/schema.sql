-- Rose&Bloom (rnb) — database schema as applied to the shared Supabase project "home".
-- Every object is prefixed rnb_. Access requires a row in rnb_profiles (other apps' users can't see anything).

create table public.rnb_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  phone text,
  role text not null default 'worker' check (role in ('admin','worker')),
  active boolean not null default true,        -- can sign in
  schedulable boolean not null default true,   -- shown in the worker picker
  created_at timestamptz not null default now()
);

create table public.rnb_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, address text,
  active boolean not null default true,
  legacy_id text unique,                       -- Base44 id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rnb_client_tasks (         -- fixed (recurring) tasks per client
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.rnb_clients(id) on delete cascade,
  title text not null, position int not null default 0,
  legacy_id text unique, created_at timestamptz not null default now()
);

create table public.rnb_assignments (          -- a job: client + date
  id uuid primary key default gen_random_uuid(),
  date date not null,
  client_id uuid not null references public.rnb_clients(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','in_progress','submitted')),
  notes text,
  submitted_at timestamptz,
  submitted_by uuid references public.rnb_profiles(id) on delete set null,
  created_by uuid references public.rnb_profiles(id) on delete set null,
  legacy_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rnb_assignment_workers (
  assignment_id uuid not null references public.rnb_assignments(id) on delete cascade,
  worker_id uuid not null references public.rnb_profiles(id) on delete cascade,
  primary key (assignment_id, worker_id)
);

create table public.rnb_assignment_tasks (     -- one shared checklist per job
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.rnb_assignments(id) on delete cascade,
  kind text not null check (kind in ('fixed','extra')),  -- fixed = copied from client when scheduled
  title text not null, position int not null default 0,
  done boolean not null default false,
  done_by uuid references public.rnb_profiles(id) on delete set null,
  done_at timestamptz
);

create table public.rnb_assignment_photos (     -- files live in storage bucket "rnb-photos" at <assignment_id>/<file>
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.rnb_assignments(id) on delete cascade,
  path text not null,
  uploaded_by uuid references public.rnb_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.rnb_settings (key text primary key, value text);  -- report_whatsapp

-- Helpers (security definer): rnb_is_member(), rnb_is_admin(), rnb_is_assigned(assignment uuid)
-- RLS: members read profiles/clients/client tasks/settings; admins write everything;
--      workers read only assignments they are assigned to (and their tasks/photos/workers).
-- Worker writes go through RPCs: rnb_set_task_done(task, done), rnb_set_notes(assignment, notes),
--      rnb_submit(assignment). Photos: workers insert/delete their own on assigned jobs.
-- Admin RPC: rnb_create_assignment(date, client, workers[], extra_titles[]) — copies fixed tasks.
-- Storage bucket rnb-photos (private) with matching policies.
-- Edge function rnb-admin (supabase/functions/rnb-admin): create_user, set_password (admins only).
