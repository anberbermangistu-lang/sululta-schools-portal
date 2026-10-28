-- Apply this once in the Supabase SQL Editor to align existing databases
-- with the student and teacher registration forms.

ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS admission_date DATE,
    ADD COLUMN IF NOT EXISTS parent_id BIGINT;

ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS employee_id VARCHAR,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS department VARCHAR,
    ADD COLUMN IF NOT EXISTS experience INTEGER,
    ADD COLUMN IF NOT EXISTS joining_date DATE;

UPDATE public.teachers
SET employee_id = teacher_id
WHERE employee_id IS NULL;

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
