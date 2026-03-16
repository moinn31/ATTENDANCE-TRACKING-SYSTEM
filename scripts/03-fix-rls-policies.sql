alter table public.students enable row level security;
alter table public.attendance_records enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.face_recognition_metrics enable row level security;

drop policy if exists "allow_authenticated_select_students" on public.students;
drop policy if exists "allow_authenticated_insert_students" on public.students;
drop policy if exists "allow_authenticated_update_students" on public.students;

create policy "allow_authenticated_select_students" on public.students
  for select using (auth.role() = 'authenticated');

create policy "allow_authenticated_insert_students" on public.students
  for insert with check (auth.role() = 'authenticated');

create policy "allow_authenticated_update_students" on public.students
  for update using (auth.role() = 'authenticated');

drop policy if exists "allow_authenticated_select_attendance" on public.attendance_records;
drop policy if exists "allow_authenticated_insert_attendance" on public.attendance_records;
drop policy if exists "allow_authenticated_update_attendance" on public.attendance_records;

create policy "allow_authenticated_select_attendance" on public.attendance_records
  for select using (auth.role() = 'authenticated');

create policy "allow_authenticated_insert_attendance" on public.attendance_records
  for insert with check (auth.role() = 'authenticated');

create policy "allow_authenticated_update_attendance" on public.attendance_records
  for update using (auth.role() = 'authenticated');

drop policy if exists "allow_authenticated_select_embeddings" on public.face_embeddings;
drop policy if exists "allow_authenticated_insert_embeddings" on public.face_embeddings;

create policy "allow_authenticated_select_embeddings" on public.face_embeddings
  for select using (auth.role() = 'authenticated');

create policy "allow_authenticated_insert_embeddings" on public.face_embeddings
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "allow_authenticated_view_analytics_daily" on public.analytics_daily;
drop policy if exists "allow_authenticated_view_face_metrics" on public.face_recognition_metrics;

create policy "allow_authenticated_view_analytics_daily" on public.analytics_daily
  for select using (auth.role() = 'authenticated');

create policy "allow_authenticated_view_face_metrics" on public.face_recognition_metrics
  for select using (auth.role() = 'authenticated');