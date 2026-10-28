-- ================================================================
-- SULULTA SCHOOL PORTAL - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rbkrezomrouycmxfiuzh/sql/new
-- Run only as a schema bootstrap. Apply
-- supabase/migrations/20261027000000_role_security.sql before enabling the app.
-- ================================================================

-- 1. TEACHERS (must be first — classes references it)
CREATE TABLE IF NOT EXISTS public.teachers (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    teacher_id    VARCHAR NOT NULL UNIQUE,
    employee_id   VARCHAR,
    first_name    VARCHAR NOT NULL,
    last_name     VARCHAR NOT NULL,
    date_of_birth DATE,
    gender        VARCHAR,
    phone         VARCHAR,
    email         VARCHAR,
    address       TEXT,
    qualification VARCHAR,
    department    VARCHAR,
    experience    INTEGER,
    joining_date  DATE,
    photo_url     TEXT,
    user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status        VARCHAR NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_name    VARCHAR NOT NULL,
    section       VARCHAR NOT NULL,
    room_number   VARCHAR,
    class_teacher BIGINT REFERENCES public.teachers(id) ON DELETE SET NULL,
    academic_year VARCHAR,
    status        VARCHAR NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SUBJECTS
CREATE TABLE IF NOT EXISTS public.subjects (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_code VARCHAR NOT NULL UNIQUE,
    subject_name VARCHAR NOT NULL,
    grade_level  VARCHAR,
    credit       NUMERIC,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. STUDENTS (references classes)
CREATE TABLE IF NOT EXISTS public.students (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id    VARCHAR NOT NULL UNIQUE,
    first_name    VARCHAR NOT NULL,
    last_name     VARCHAR NOT NULL,
    gender        VARCHAR,
    date_of_birth DATE,
    phone         VARCHAR,
    email         VARCHAR,
    address       TEXT,
    class_id      BIGINT REFERENCES public.classes(id) ON DELETE SET NULL,
    parent_id     BIGINT,
    class         VARCHAR,
    section       VARCHAR,
    parent_name   VARCHAR,
    parent_phone  VARCHAR,
    photo_url     TEXT,
    admission_date DATE,
    status        VARCHAR NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PARENTS (references students)
CREATE TABLE IF NOT EXISTS public.parents (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id    VARCHAR UNIQUE,
    first_name   VARCHAR NOT NULL,
    last_name    VARCHAR NOT NULL,
    gender       VARCHAR,
    relationship VARCHAR,
    phone        VARCHAR NOT NULL,
    email        VARCHAR,
    address      TEXT,
    occupation   VARCHAR,
    photo_url    TEXT,
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    student_id   BIGINT REFERENCES public.students(id) ON DELETE SET NULL,
    status       VARCHAR NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- 6. PROFILES (extends auth.users — references students)
-- Columns match ALL queries found in the JS files
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR NOT NULL DEFAULT '',
    last_name  VARCHAR NOT NULL DEFAULT '',
    full_name  VARCHAR NOT NULL DEFAULT '',
    email      VARCHAR NOT NULL DEFAULT '',
    username   VARCHAR,
    role       VARCHAR NOT NULL DEFAULT 'student',
    phone      VARCHAR,
    photo_url  TEXT,
    status     VARCHAR NOT NULL DEFAULT 'active',
    student_id BIGINT REFERENCES public.students(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id      BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status          VARCHAR NOT NULL,
    remark          TEXT,
    recorded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. RESULTS
CREATE TABLE IF NOT EXISTS public.results (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id   TEXT NOT NULL,
    subject_code VARCHAR NOT NULL,
    exam_type    VARCHAR NOT NULL,
    mark         NUMERIC,
    grade        VARCHAR,
    remark       VARCHAR,
    recorded_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. TIMETABLE
CREATE TABLE IF NOT EXISTS public.timetable (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_name    VARCHAR NOT NULL,
    section       VARCHAR NOT NULL,
    subject_code  VARCHAR NOT NULL,
    subject_name  VARCHAR NOT NULL,
    day           VARCHAR NOT NULL,
    start_time    TIME,
    end_time      TIME,
    room_number   VARCHAR,
    academic_year VARCHAR NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. BOOKS
CREATE TABLE IF NOT EXISTS public.books (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    book_code  VARCHAR NOT NULL UNIQUE,
    title      VARCHAR NOT NULL,
    author     VARCHAR,
    publisher  VARCHAR,
    category   VARCHAR,
    available  INTEGER NOT NULL DEFAULT 1,
    book_file  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. BOOK LOANS
CREATE TABLE IF NOT EXISTS public.book_loans (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id  BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    book_id     BIGINT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_date DATE,
    status      TEXT NOT NULL DEFAULT 'borrowed'
                CHECK (status IN ('borrowed','returned')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. FEES
CREATE TABLE IF NOT EXISTS public.fees (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id     BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount         NUMERIC NOT NULL DEFAULT 0,
    paid_amount    NUMERIC NOT NULL DEFAULT 0,
    payment_date   DATE,
    payment_method VARCHAR,
    status         VARCHAR NOT NULL DEFAULT 'Unpaid',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. EVENTS
CREATE TABLE IF NOT EXISTS public.events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_name  VARCHAR NOT NULL,
    event_type  VARCHAR,
    event_date  DATE NOT NULL,
    start_time  TIME,
    end_time    TIME,
    location    VARCHAR,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. NOTICES
CREATE TABLE IF NOT EXISTS public.notices (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        VARCHAR NOT NULL,
    message      TEXT NOT NULL,
    audience     VARCHAR NOT NULL DEFAULT 'all',
    publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date  DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. EXAMS
CREATE TABLE IF NOT EXISTS public.exams (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_name   VARCHAR NOT NULL,
    exam_type   VARCHAR NOT NULL,
    grade_level VARCHAR NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['teachers','classes','subjects','students',
    'parents','profiles','timetable','books','fees','events','notices','exams']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON public.%I;
       CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END; $$;

-- ================================================================
-- DEFAULT CLASSES (Grade 9-12 sections A and B)
-- ================================================================
INSERT INTO public.classes (class_name, section, academic_year, status) VALUES
('Grade 9',  'A', '2025/2026', 'active'),
('Grade 9',  'B', '2025/2026', 'active'),
('Grade 10', 'A', '2025/2026', 'active'),
('Grade 10', 'B', '2025/2026', 'active'),
('Grade 11', 'A', '2025/2026', 'active'),
('Grade 11', 'B', '2025/2026', 'active'),
('Grade 12', 'A', '2025/2026', 'active'),
('Grade 12', 'B', '2025/2026', 'active')
ON CONFLICT DO NOTHING;

-- ================================================================
-- CREATE ADMIN PROFILE (runs after you create the auth user below)
-- Replace the UUID with the one from Authentication > Users
-- ================================================================
-- INSERT INTO public.profiles (id, first_name, last_name, full_name, email, role, status)
-- VALUES ('PASTE-UUID-HERE','Admin','User','Admin User','admin@school.com','admin','active');

-- ================================================================
-- RELOAD SCHEMA CACHE
-- ================================================================
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- VERIFY: Shows row counts for all 15 tables
-- ================================================================
SELECT tbl, cnt FROM (
    SELECT 'profiles'   tbl, COUNT(*) cnt FROM public.profiles   UNION ALL
    SELECT 'students'        , COUNT(*)    FROM public.students   UNION ALL
    SELECT 'teachers'        , COUNT(*)    FROM public.teachers   UNION ALL
    SELECT 'classes'         , COUNT(*)    FROM public.classes    UNION ALL
    SELECT 'parents'         , COUNT(*)    FROM public.parents    UNION ALL
    SELECT 'subjects'        , COUNT(*)    FROM public.subjects   UNION ALL
    SELECT 'fees'            , COUNT(*)    FROM public.fees       UNION ALL
    SELECT 'events'          , COUNT(*)    FROM public.events     UNION ALL
    SELECT 'notices'         , COUNT(*)    FROM public.notices    UNION ALL
    SELECT 'exams'           , COUNT(*)    FROM public.exams      UNION ALL
    SELECT 'results'         , COUNT(*)    FROM public.results    UNION ALL
    SELECT 'attendance'      , COUNT(*)    FROM public.attendance UNION ALL
    SELECT 'timetable'       , COUNT(*)    FROM public.timetable  UNION ALL
    SELECT 'books'           , COUNT(*)    FROM public.books      UNION ALL
    SELECT 'book_loans'      , COUNT(*)    FROM public.book_loans
) x ORDER BY tbl;
