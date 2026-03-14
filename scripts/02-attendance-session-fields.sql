-- Add class and subject metadata to attendance records
alter table if exists public.attendance_records
  add column if not exists class_name text,
  add column if not exists subject_name text;

create index if not exists idx_attendance_records_class_name on public.attendance_records(class_name);
create index if not exists idx_attendance_records_subject_name on public.attendance_records(subject_name);
create index if not exists idx_attendance_records_date_class_subject on public.attendance_records(date, class_name, subject_name);
