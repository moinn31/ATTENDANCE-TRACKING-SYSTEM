-- Create students table
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  roll_number text not null unique,
  photo_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create attendance_records table
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  detected_confidence numeric,
  timestamp timestamp with time zone default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create face_embeddings table for improved recognition
create table if not exists public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  embedding_vector text not null,
  created_at timestamp with time zone default now()
);

-- Create analytics_daily table for pre-computed stats
create table if not exists public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  total_students integer,
  present_count integer,
  absent_count integer,
  late_count integer,
  created_at timestamp with time zone default now(),
  unique(date)
);

-- Create face_recognition_metrics table
create table if not exists public.face_recognition_metrics (
  id uuid primary key default gen_random_uuid(),
  detection_date date not null,
  avg_confidence numeric,
  total_detections integer,
  false_positives integer,
  created_at timestamp with time zone default now(),
  unique(detection_date)
);

-- Create indexes for performance
create index if not exists idx_attendance_records_student_id on public.attendance_records(student_id);
create index if not exists idx_attendance_records_date on public.attendance_records(date);
create index if not exists idx_attendance_records_created_by on public.attendance_records(created_by);
create index if not exists idx_face_embeddings_student_id on public.face_embeddings(student_id);
create index if not exists idx_students_roll_number on public.students(roll_number);

-- Enable RLS for all tables
alter table public.students enable row level security;
alter table public.attendance_records enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.face_recognition_metrics enable row level security;

-- RLS Policies for students table
create policy if not exists "allow_authenticated_select_students" on public.students 
  for select using (auth.role() = 'authenticated');

create policy if not exists "allow_authenticated_insert_students" on public.students 
  for insert with check (auth.role() = 'authenticated');

create policy if not exists "allow_authenticated_update_students" on public.students 
  for update using (auth.role() = 'authenticated');

-- RLS Policies for attendance_records
create policy if not exists "allow_authenticated_select_attendance" on public.attendance_records 
  for select using (auth.role() = 'authenticated');

create policy if not exists "allow_authenticated_insert_attendance" on public.attendance_records 
  for insert with check (auth.role() = 'authenticated');

create policy if not exists "allow_authenticated_update_attendance" on public.attendance_records 
  for update using (auth.role() = 'authenticated');

-- RLS Policies for face_embeddings
create policy if not exists "allow_authenticated_select_embeddings" on public.face_embeddings 
  for select using (auth.role() = 'authenticated');

create policy if not exists "allow_authenticated_insert_embeddings" on public.face_embeddings 
  for insert with check (auth.role() = 'authenticated');

-- RLS Policies for analytics tables
create policy if not exists "allow_authenticated_view_analytics_daily" on public.analytics_daily 
  for select using (auth.role() = 'authenticated');

create policy if not exists "allow_authenticated_view_face_metrics" on public.face_recognition_metrics 
  for select using (auth.role() = 'authenticated');
