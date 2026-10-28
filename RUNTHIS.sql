CREATE TABLE IF NOT EXISTS public.teachers (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, teacher_id VARCHAR NOT NULL UNIQUE, first_name VARCHAR NOT NULL, last_name VARCHAR NOT NULL, gender VARCHAR, phone VARCHAR, email VARCHAR, address TEXT, qualification VARCHAR, photo_url TEXT, user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, status VARCHAR NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.classes (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, class_name VARCHAR NOT NULL, section VARCHAR NOT NULL, room_number VARCHAR, class_teacher BIGINT REFERENCES public.teachers(id) ON DELETE SET NULL, academic_year VARCHAR, status VARCHAR NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.subjects (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, subject_code VARCHAR NOT NULL UNIQUE, subject_name VARCHAR NOT NULL, grade_level VARCHAR, credit NUMERIC, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.students (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, student_id VARCHAR NOT NULL UNIQUE, first_name VARCHAR NOT NULL, last_name VARCHAR NOT NULL, gender VARCHAR, date_of_birth DATE, phone VARCHAR, email VARCHAR, address TEXT, class_id BIGINT REFERENCES public.classes(id) ON DELETE SET NULL, class VARCHAR, section VARCHAR, parent_name VARCHAR, parent_phone VARCHAR, photo_url TEXT, status VARCHAR NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.parents (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, parent_id VARCHAR UNIQUE, first_name VARCHAR NOT NULL, last_name VARCHAR NOT NULL, gender VARCHAR, relationship VARCHAR, phone VARCHAR NOT NULL, email VARCHAR, address TEXT, occupation VARCHAR, photo_url TEXT, user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, student_id BIGINT REFERENCES public.students(id) ON DELETE SET NULL, status VARCHAR NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.profiles (id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name VARCHAR NOT NULL DEFAULT '', first_name VARCHAR NOT NULL DEFAULT '', last_name VARCHAR NOT NULL DEFAULT '', email VARCHAR NOT NULL DEFAULT '', username VARCHAR, role VARCHAR NOT NULL DEFAULT 'student', phone VARCHAR, photo_url TEXT, status VARCHAR NOT NULL DEFAULT 'active', student_id BIGINT REFERENCES public.students(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.attendance (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE, attendance_date DATE NOT NULL, status VARCHAR NOT NULL, remark TEXT, recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.results (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, student_id TEXT NOT NULL, subject_code VARCHAR NOT NULL, exam_type VARCHAR NOT NULL, mark NUMERIC, grade VARCHAR, remark VARCHAR, recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.timetable (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, class_name VARCHAR NOT NULL, section VARCHAR NOT NULL, subject_code VARCHAR NOT NULL, subject_name VARCHAR NOT NULL, day VARCHAR NOT NULL, start_time TIME, end_time TIME, room_number VARCHAR, academic_year VARCHAR NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.books (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, book_code VARCHAR NOT NULL UNIQUE, title VARCHAR NOT NULL, author VARCHAR, publisher VARCHAR, category VARCHAR, available INTEGER NOT NULL DEFAULT 1, book_file TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.book_loans (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE, book_id BIGINT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE, borrow_date DATE NOT NULL DEFAULT CURRENT_DATE, return_date DATE, status TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed','returned')), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fees (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE, amount NUMERIC NOT NULL DEFAULT 0, paid_amount NUMERIC NOT NULL DEFAULT 0, payment_date DATE, payment_method VARCHAR, status VARCHAR NOT NULL DEFAULT 'Unpaid', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.events (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_name VARCHAR NOT NULL, event_type VARCHAR, event_date DATE NOT NULL, start_time TIME, end_time TIME, location VARCHAR, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.notices (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title VARCHAR NOT NULL, message TEXT NOT NULL, audience VARCHAR NOT NULL DEFAULT 'all', publish_date DATE NOT NULL DEFAULT CURRENT_DATE, expiry_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.exams (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, exam_name VARCHAR NOT NULL, exam_type VARCHAR NOT NULL, grade_level VARCHAR NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS admission_date DATE,
    ADD COLUMN IF NOT EXISTS parent_id BIGINT;
ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS employee_id VARCHAR,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS department VARCHAR,
    ADD COLUMN IF NOT EXISTS experience INTEGER,
    ADD COLUMN IF NOT EXISTS joining_date DATE;
UPDATE public.teachers SET employee_id = teacher_id WHERE employee_id IS NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'students_parent_id_fkey'
          AND conrelid = 'public.students'::regclass
    ) THEN
        ALTER TABLE public.students
            ADD CONSTRAINT students_parent_id_fkey
            FOREIGN KEY (parent_id)
            REFERENCES public.parents(id)
            ON DELETE SET NULL;
    END IF;
END
$$;
NOTIFY pgrst, 'reload schema';
-- This file only creates/extends the base schema. Apply
-- supabase/migrations/20261027000000_role_security.sql immediately afterward.
