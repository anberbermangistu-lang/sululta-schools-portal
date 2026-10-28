-- Optional Supabase SQL migration to store teacher assignments directly on the timetable table
ALTER TABLE public.timetable 
ADD COLUMN IF NOT EXISTS teacher_id BIGINT;

ALTER TABLE public.timetable 
ADD COLUMN IF NOT EXISTS teacher_name VARCHAR;
