-- Run this once in the Supabase SQL Editor for a new project.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  username character varying UNIQUE,
  role character varying NOT NULL DEFAULT 'student'::character varying,
  phone character varying,
  photo_url text,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  update_at timestamp with time zone NOT NULL DEFAULT now(),
  student_id bigint,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.students (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id character varying NOT NULL UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  gender character varying,
  date_of_birth date,
  class character varying,
  section character varying,
  phone character varying,
  email character varying,
  address text,
  parent_name character varying,
  parent_phone character varying,
  photo_url text,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  photo text,
  class_id bigint,
  CONSTRAINT students_pkey PRIMARY KEY (id)
);
CREATE TABLE public.teachers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  teacher_id character varying NOT NULL UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  gender character varying,
  phone character varying,
  email character varying,
  address text,
  qualification character varying,
  photo_url text,
  user_id uuid,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.parents (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  parent_id character varying UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  gender character varying,
  relationship character varying,
  phone character varying NOT NULL,
  email character varying,
  address text,
  occupation character varying,
  user_id uuid,
  student_id bigint,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  photo_url text,
  CONSTRAINT parents_pkey PRIMARY KEY (id),
  CONSTRAINT parents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT parents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.classes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  class_name character varying NOT NULL,
  section character varying NOT NULL,
  room_number character varying,
  class_teacher bigint,
  academic_year character varying,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_class_teacher_fkey FOREIGN KEY (class_teacher) REFERENCES public.teachers(id)
);
CREATE TABLE public.subjects (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  subject_code character varying NOT NULL UNIQUE,
  subject_name character varying NOT NULL,
  grade_level character varying,
  credit numeric,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.attendance (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id bigint NOT NULL,
  attendance_date date NOT NULL,
  status character varying NOT NULL,
  remark text,
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id)
);
CREATE TABLE public.results (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id text NOT NULL,
  subject_code character varying NOT NULL,
  exam_type character varying NOT NULL,
  mark numeric,
  grade character varying,
  remark character varying,
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT results_pkey PRIMARY KEY (id),
  CONSTRAINT results_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id)
);
CREATE TABLE public.timetable (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  class_name character varying NOT NULL,
  section character varying,
  subject_code character varying,
  subject_name character varying,
  day character varying NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  room_number character varying,
  academic_year character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT timetable_pkey PRIMARY KEY (id)
);
CREATE TABLE public.books (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  book_code character varying NOT NULL UNIQUE,
  title character varying NOT NULL,
  author character varying,
  publisher character varying,
  category character varying,
  available integer NOT NULL DEFAULT 0,
  book_file text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT books_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fees (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id bigint NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  payment_method character varying,
  status character varying NOT NULL DEFAULT 'unpaid'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fees_pkey PRIMARY KEY (id),
  CONSTRAINT fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  event_name character varying NOT NULL,
  event_type character varying,
  event_date date NOT NULL,
  event_time time without time zone,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  location character varying,
  start_time time without time zone,
  end_time time without time zone,
  CONSTRAINT events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notices (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title character varying NOT NULL,
  message text NOT NULL,
  audience character varying NOT NULL DEFAULT 'all'::character varying,
  publish_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expiry_date date,
  CONSTRAINT notices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.exams (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  exam_name character varying NOT NULL,
  exam_type character varying NOT NULL,
  grade_level character varying NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.book_loans (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id bigint NOT NULL,
  book_id bigint NOT NULL,
  borrow_date date NOT NULL DEFAULT CURRENT_DATE,
  return_date date,
  status text NOT NULL DEFAULT 'borrowed'::text CHECK (status = ANY (ARRAY['borrowed'::text, 'returned'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT book_loans_pkey PRIMARY KEY (id),
  CONSTRAINT book_loans_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT book_loans_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);

ALTER TABLE public.students
  ADD CONSTRAINT students_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES public.classes(id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id);