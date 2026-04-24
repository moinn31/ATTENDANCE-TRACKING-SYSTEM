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

-- ============================================================================
-- BDA: Spark Analytics Results Storage
-- These tables store pre-computed analytics from the Apache Spark pipeline.
-- ============================================================================

-- Student risk scores computed by Bayesian ML model
create table if not exists public.student_risk_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  total_classes integer default 0,
  present_count integer default 0,
  absent_count integer default 0,
  late_count integer default 0,
  absence_ratio numeric(5,4) default 0,
  late_ratio numeric(5,4) default 0,
  confidence_stddev numeric(6,2) default 0,
  risk_score numeric(5,4) default 0,
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  computed_at timestamp with time zone default now(),
  engine text default 'spark',  -- 'spark' or 'local_python'
  unique(student_id)
);

-- Detection method comparison metrics
create table if not exists public.detection_method_metrics (
  id uuid primary key default gen_random_uuid(),
  detection_method text not null,  -- 'face-api', 'yolo-arcface', 'manual'
  total_detections integer default 0,
  avg_confidence numeric(5,2) default 0,
  confidence_stddev numeric(5,2) default 0,
  avg_processing_ms numeric(8,2) default 0,
  avg_frames_used numeric(5,1) default 0,
  computed_at timestamp with time zone default now(),
  unique(detection_method)
);

-- HDFS export tracking (for BDA data lake operations)
create table if not exists public.hdfs_exports (
  id uuid primary key default gen_random_uuid(),
  export_type text not null,  -- 'attendance_records', 'analytics_daily', 'risk_scores'
  hdfs_path text not null,
  file_format text default 'parquet',  -- 'parquet', 'csv', 'json'
  record_count integer default 0,
  file_size_bytes bigint default 0,
  date_range_start date,
  date_range_end date,
  exported_at timestamp with time zone default now(),
  status text default 'completed' check (status in ('pending', 'running', 'completed', 'failed'))
);

-- Spark job execution history
create table if not exists public.spark_job_history (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  job_type text not null,  -- 'daily_summary', 'risk_scoring', 'trend_analysis', 'full_pipeline'
  input_records integer default 0,
  output_records integer default 0,
  duration_seconds numeric(8,2) default 0,
  spark_master text default 'local[*]',
  status text default 'completed' check (status in ('submitted', 'running', 'completed', 'failed')),
  error_message text,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

create index if not exists idx_student_risk_scores_student_id on public.student_risk_scores(student_id);
create index if not exists idx_student_risk_scores_risk_level on public.student_risk_scores(risk_level);
create index if not exists idx_hdfs_exports_type on public.hdfs_exports(export_type);
create index if not exists idx_spark_job_history_type on public.spark_job_history(job_type);
