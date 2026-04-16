-- AWS RDS PostgreSQL compatible schema
-- Cleaned from Supabase-specific auth and RLS dependencies.

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

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
-- Legacy external user foreign key removed.
-- Replaced with:
--   created_by_uid text
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  class_name text,
  subject_name text,
  detected_confidence numeric,
  timestamp timestamp with time zone default now(),
  created_by_uid text not null,
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
create index if not exists idx_attendance_records_created_by_uid on public.attendance_records(created_by_uid);
create index if not exists idx_attendance_records_class_name on public.attendance_records(class_name);
create index if not exists idx_attendance_records_subject_name on public.attendance_records(subject_name);
create index if not exists idx_attendance_records_date_class_subject on public.attendance_records(date, class_name, subject_name);
create index if not exists idx_face_embeddings_student_id on public.face_embeddings(student_id);
create index if not exists idx_students_roll_number on public.students(roll_number);
