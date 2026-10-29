BEGIN;

ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS student_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_student_id_fkey'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_student_id_fkey
            FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'students_user_id_fkey'
          AND conrelid = 'public.students'::regclass
    ) THEN
        ALTER TABLE public.students
            ADD CONSTRAINT students_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT student_id
        FROM public.profiles
        WHERE student_id IS NOT NULL
        GROUP BY student_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Resolve duplicate profiles.student_id links before enabling student ownership policies.';
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_unique
    ON public.students (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teachers_user_id_unique
    ON public.teachers (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_unique
    ON public.profiles (student_id);
CREATE INDEX IF NOT EXISTS students_class_id_idx
    ON public.students (class_id);
CREATE INDEX IF NOT EXISTS attendance_student_id_idx
    ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS results_student_id_idx
    ON public.results (student_id);
CREATE INDEX IF NOT EXISTS timetable_class_subject_idx
    ON public.timetable (class_name, section, subject_code);
CREATE INDEX IF NOT EXISTS classes_class_teacher_idx
    ON public.classes (class_teacher);

UPDATE public.students s
SET user_id = p.id
FROM public.profiles p
WHERE p.student_id = s.id
  AND s.user_id IS NULL;

CREATE TABLE IF NOT EXISTS public.class_subjects (
    class_id bigint NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_code varchar NOT NULL REFERENCES public.subjects(subject_code) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (class_id, subject_code)
);

CREATE TABLE IF NOT EXISTS public.teacher_subject_assignments (
    teacher_id bigint NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    class_id bigint NOT NULL,
    subject_code varchar NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (teacher_id, class_id, subject_code),
    FOREIGN KEY (class_id, subject_code)
        REFERENCES public.class_subjects(class_id, subject_code)
        ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_subject_class_single_owner
    ON public.teacher_subject_assignments (class_id, subject_code);

INSERT INTO public.class_subjects (class_id, subject_code)
SELECT DISTINCT c.id, t.subject_code
FROM public.timetable t
JOIN public.classes c
  ON lower(btrim(c.class_name)) = lower(btrim(t.class_name))
 AND lower(btrim(c.section)) = lower(btrim(t.section))
JOIN public.subjects s ON s.subject_code = t.subject_code
WHERE t.subject_code IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_timetable_class_subject()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.class_subjects (class_id, subject_code)
    SELECT c.id, NEW.subject_code
    FROM public.classes c
    JOIN public.subjects s ON s.subject_code = NEW.subject_code
    WHERE lower(btrim(c.class_name)) = lower(btrim(NEW.class_name))
      AND lower(btrim(c.section)) = lower(btrim(NEW.section))
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_timetable_class_subject() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS timetable_sync_class_subject ON public.timetable;
CREATE TRIGGER timetable_sync_class_subject
AFTER INSERT OR UPDATE OF class_name, section, subject_code
ON public.timetable
FOR EACH ROW EXECUTE FUNCTION public.sync_timetable_class_subject();

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT lower(p.role)
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.status) = 'active'
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT coalesce(public.current_app_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_student_owner(target_student_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.current_app_role() = 'student' AND EXISTS (
        SELECT 1
        FROM public.students s
        LEFT JOIN public.profiles p ON p.id = auth.uid()
        WHERE s.id = target_student_id
          AND (
              s.user_id = auth.uid()
              OR p.student_id = s.id
          )
    )
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_class(target_class_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.current_app_role() = 'teacher' AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = target_class_id
          AND (
              EXISTS (
                  SELECT 1
                  FROM public.teachers t
                  WHERE t.id = c.class_teacher
                    AND t.user_id = auth.uid()
                    AND lower(t.status) = 'active'
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.teacher_subject_assignments a
                  JOIN public.teachers t ON t.id = a.teacher_id
                  WHERE a.class_id = c.id
                    AND t.user_id = auth.uid()
                    AND lower(t.status) = 'active'
              )
          )
    )
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_subject(
    target_class_id bigint,
    target_subject_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.current_app_role() = 'teacher' AND EXISTS (
        SELECT 1
        FROM public.teacher_subject_assignments a
        JOIN public.teachers t ON t.id = a.teacher_id
        WHERE a.class_id = target_class_id
          AND a.subject_code = target_subject_code
          AND t.user_id = auth.uid()
          AND lower(t.status) = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION public.is_student_in_class(target_class_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.current_app_role() = 'student' AND EXISTS (
        SELECT 1
        FROM public.students s
        LEFT JOIN public.profiles p ON p.id = auth.uid()
        WHERE s.class_id = target_class_id
          AND (
              s.user_id = auth.uid()
              OR p.student_id = s.id
          )
    )
$$;

CREATE OR REPLACE FUNCTION public.guard_student_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.role() <> 'service_role'
       AND NOT public.is_school_admin()
       AND (
        NEW.id IS DISTINCT FROM OLD.id
        OR NEW.student_id IS DISTINCT FROM OLD.student_id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.class_id IS DISTINCT FROM OLD.class_id
        OR NEW.class IS DISTINCT FROM OLD.class
        OR NEW.section IS DISTINCT FROM OLD.section
        OR NEW.status IS DISTINCT FROM OLD.status
        OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
        OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
        OR NEW.parent_name IS DISTINCT FROM OLD.parent_name
        OR NEW.parent_phone IS DISTINCT FROM OLD.parent_phone
    ) THEN
        RAISE EXCEPTION 'Students may only update permitted personal information.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_student_self_update ON public.students;
CREATE TRIGGER guard_student_self_update
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.guard_student_self_update();

CREATE OR REPLACE FUNCTION public.teacher_can_access_result(
    target_student_key text,
    target_subject_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.students s
        WHERE (
            s.id::text = target_student_key
            OR s.student_id = target_student_key
        )
          AND public.teacher_can_access_subject(s.class_id, target_subject_code)
    )
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_school_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_student_owner(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_can_access_class(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_can_access_subject(bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_student_in_class(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_can_access_result(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_owner(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_class(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_subject(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_in_class(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_result(text, text) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    existing_policy record;
BEGIN
    FOR existing_policy IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY (ARRAY[
              'profiles', 'students', 'teachers', 'parents', 'classes',
              'subjects', 'class_subjects', 'teacher_subject_assignments',
              'attendance', 'results', 'timetable', 'books', 'book_loans',
              'fees', 'events', 'notices', 'exams'
          ])
    LOOP
        EXECUTE format(
            'DROP POLICY %I ON %I.%I',
            existing_policy.policyname,
            existing_policy.schemaname,
            existing_policy.tablename
        );
    END LOOP;
END
$$;

REVOKE ALL ON TABLE public.profiles, public.students, public.teachers,
    public.parents, public.classes, public.subjects, public.class_subjects,
    public.teacher_subject_assignments, public.attendance, public.results,
    public.timetable, public.books, public.book_loans, public.fees,
    public.events, public.notices, public.exams
FROM anon, authenticated;

GRANT SELECT ON TABLE public.profiles, public.students, public.teachers,
    public.parents, public.classes, public.subjects, public.class_subjects,
    public.teacher_subject_assignments, public.attendance, public.results,
    public.timetable, public.books, public.book_loans, public.fees,
    public.events, public.notices, public.exams
TO authenticated;

GRANT UPDATE (first_name, last_name, phone, photo_url, updated_at)
    ON public.profiles TO authenticated;
GRANT UPDATE (first_name, last_name, gender, phone, address, photo_url, updated_at)
    ON public.students TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE
    public.students, public.teachers, public.parents, public.classes,
    public.subjects, public.class_subjects, public.teacher_subject_assignments,
    public.attendance, public.results, public.timetable, public.books,
    public.book_loans, public.fees, public.events, public.notices, public.exams
TO authenticated;
GRANT UPDATE (first_name, last_name, phone, photo_url, status, updated_at)
    ON public.profiles TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_school_admin());
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_school_admin())
WITH CHECK (
    (
        id = auth.uid()
        AND lower(role) = public.current_app_role()
        AND lower(status) = 'active'
    )
    OR (public.is_school_admin() AND (id <> auth.uid() OR lower(status) = 'active'))
);

DROP POLICY IF EXISTS students_read ON public.students;
CREATE POLICY students_read ON public.students FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR public.is_student_owner(id)
    OR (class_id IS NOT NULL AND public.teacher_can_access_class(class_id))
);
DROP POLICY IF EXISTS students_update ON public.students;
CREATE POLICY students_update ON public.students FOR UPDATE TO authenticated
USING (public.is_school_admin() OR public.is_student_owner(id))
WITH CHECK (public.is_school_admin() OR public.is_student_owner(id));
DROP POLICY IF EXISTS students_admin_insert ON public.students;
CREATE POLICY students_admin_insert ON public.students FOR INSERT TO authenticated
WITH CHECK (public.is_school_admin());
DROP POLICY IF EXISTS students_admin_delete ON public.students;
CREATE POLICY students_admin_delete ON public.students FOR DELETE TO authenticated
USING (public.is_school_admin());

DROP POLICY IF EXISTS teachers_read ON public.teachers;
CREATE POLICY teachers_read ON public.teachers FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR (user_id = auth.uid() AND public.current_app_role() = 'teacher')
);
DROP POLICY IF EXISTS teachers_admin_write ON public.teachers;
CREATE POLICY teachers_admin_write ON public.teachers FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());
DROP POLICY IF EXISTS teachers_self_update ON public.teachers;
CREATE POLICY teachers_self_update ON public.teachers FOR UPDATE TO authenticated
USING (
    public.is_school_admin()
    OR (user_id = auth.uid() AND public.current_app_role() = 'teacher')
)
WITH CHECK (
    public.is_school_admin()
    OR (user_id = auth.uid() AND public.current_app_role() = 'teacher')
);

DROP POLICY IF EXISTS parents_admin_only ON public.parents;
CREATE POLICY parents_admin_only ON public.parents FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS classes_read ON public.classes;
CREATE POLICY classes_read ON public.classes FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR public.teacher_can_access_class(id)
    OR public.is_student_in_class(id)
);
DROP POLICY IF EXISTS classes_admin_write ON public.classes;
CREATE POLICY classes_admin_write ON public.classes FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS subjects_read ON public.subjects;
CREATE POLICY subjects_read ON public.subjects FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR EXISTS (
        SELECT 1 FROM public.teacher_subject_assignments a
        WHERE a.subject_code = subjects.subject_code
          AND public.teacher_can_access_subject(a.class_id, a.subject_code)
    )
    OR EXISTS (
        SELECT 1 FROM public.class_subjects cs
        JOIN public.students s ON s.class_id = cs.class_id
        WHERE cs.subject_code = subjects.subject_code
          AND public.is_student_owner(s.id)
    )
);
DROP POLICY IF EXISTS subjects_admin_write ON public.subjects;
CREATE POLICY subjects_admin_write ON public.subjects FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS class_subjects_read ON public.class_subjects;
CREATE POLICY class_subjects_read ON public.class_subjects FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR public.teacher_can_access_class(class_id)
    OR public.is_student_in_class(class_id)
);
DROP POLICY IF EXISTS class_subjects_admin_write ON public.class_subjects;
CREATE POLICY class_subjects_admin_write ON public.class_subjects FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS teacher_subject_assignments_read ON public.teacher_subject_assignments;
CREATE POLICY teacher_subject_assignments_read ON public.teacher_subject_assignments
FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR public.teacher_can_access_subject(class_id, subject_code)
);
DROP POLICY IF EXISTS teacher_subject_assignments_admin_write ON public.teacher_subject_assignments;
CREATE POLICY teacher_subject_assignments_admin_write ON public.teacher_subject_assignments
FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS attendance_read ON public.attendance;
CREATE POLICY attendance_read ON public.attendance FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR public.is_student_owner(student_id)
    OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = attendance.student_id
          AND s.class_id IS NOT NULL
          AND public.teacher_can_access_class(s.class_id)
    )
);
DROP POLICY IF EXISTS attendance_teacher_write ON public.attendance;
CREATE POLICY attendance_teacher_write ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
    public.is_school_admin()
    OR (
        recorded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = attendance.student_id
              AND s.class_id IS NOT NULL
              AND public.teacher_can_access_class(s.class_id)
        )
    )
);
DROP POLICY IF EXISTS attendance_teacher_update ON public.attendance;
CREATE POLICY attendance_teacher_update ON public.attendance FOR UPDATE TO authenticated
USING (
    public.is_school_admin()
    OR (
        recorded_by = auth.uid()
        AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = attendance.student_id
          AND s.class_id IS NOT NULL
          AND public.teacher_can_access_class(s.class_id)
        )
    )
)
WITH CHECK (
    public.is_school_admin()
    OR (
        recorded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = attendance.student_id
              AND s.class_id IS NOT NULL
              AND public.teacher_can_access_class(s.class_id)
        )
    )
);
DROP POLICY IF EXISTS attendance_admin_delete ON public.attendance;
CREATE POLICY attendance_admin_delete ON public.attendance FOR DELETE TO authenticated
USING (public.is_school_admin());

ALTER TABLE public.results
    ADD COLUMN IF NOT EXISTS subject_code varchar;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'results_mark_range_check'
          AND conrelid = 'public.results'::regclass
    ) THEN
        ALTER TABLE public.results
            ADD CONSTRAINT results_mark_range_check
            CHECK (mark IS NULL OR (mark >= 0 AND mark <= 100)) NOT VALID;
    END IF;
END
$$;
DROP POLICY IF EXISTS results_read ON public.results;
CREATE POLICY results_read ON public.results FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR public.teacher_can_access_result(student_id, subject_code)
    OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE (s.id::text = results.student_id OR s.student_id = results.student_id)
          AND public.is_student_owner(s.id)
    )
);
DROP POLICY IF EXISTS results_teacher_insert ON public.results;
CREATE POLICY results_teacher_insert ON public.results FOR INSERT TO authenticated
WITH CHECK (
    public.is_school_admin()
    OR (
        recorded_by = auth.uid()
        AND public.teacher_can_access_result(student_id, subject_code)
    )
);
DROP POLICY IF EXISTS results_teacher_update ON public.results;
CREATE POLICY results_teacher_update ON public.results FOR UPDATE TO authenticated
USING (
    public.is_school_admin()
    OR (
        recorded_by = auth.uid()
        AND public.teacher_can_access_result(student_id, subject_code)
    )
)
WITH CHECK (
    public.is_school_admin()
    OR (
        recorded_by = auth.uid()
        AND public.teacher_can_access_result(student_id, subject_code)
    )
);
DROP POLICY IF EXISTS results_admin_delete ON public.results;
CREATE POLICY results_admin_delete ON public.results FOR DELETE TO authenticated
USING (public.is_school_admin());
DROP POLICY IF EXISTS results_teacher_delete ON public.results;
CREATE POLICY results_teacher_delete ON public.results FOR DELETE TO authenticated
USING (
    public.is_school_admin()
    OR (
        recorded_by = auth.uid()
        AND public.teacher_can_access_result(student_id, subject_code)
    )
);

DROP POLICY IF EXISTS timetable_read ON public.timetable;
CREATE POLICY timetable_read ON public.timetable FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.teacher_subject_assignments a
          ON a.class_id = c.id
         AND a.subject_code = timetable.subject_code
        WHERE lower(btrim(c.class_name)) = lower(btrim(timetable.class_name))
          AND lower(btrim(c.section)) = lower(btrim(timetable.section))
          AND public.teacher_can_access_subject(a.class_id, a.subject_code)
    )
    OR EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.classes c ON c.id = s.class_id
        WHERE public.is_student_owner(s.id)
          AND lower(btrim(c.class_name)) = lower(btrim(timetable.class_name))
          AND lower(btrim(c.section)) = lower(btrim(timetable.section))
    )
);
DROP POLICY IF EXISTS timetable_admin_write ON public.timetable;
CREATE POLICY timetable_admin_write ON public.timetable FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS books_read ON public.books;
CREATE POLICY books_read ON public.books FOR SELECT TO authenticated
USING (public.current_app_role() IN ('admin', 'teacher', 'student'));
DROP POLICY IF EXISTS books_admin_write ON public.books;
CREATE POLICY books_admin_write ON public.books FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS book_loans_read ON public.book_loans;
CREATE POLICY book_loans_read ON public.book_loans FOR SELECT TO authenticated
USING (public.is_school_admin() OR public.is_student_owner(student_id));
DROP POLICY IF EXISTS book_loans_admin_write ON public.book_loans;
CREATE POLICY book_loans_admin_write ON public.book_loans FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS fees_read ON public.fees;
CREATE POLICY fees_read ON public.fees FOR SELECT TO authenticated
USING (public.is_school_admin() OR public.is_student_owner(student_id));
DROP POLICY IF EXISTS fees_admin_write ON public.fees;
CREATE POLICY fees_admin_write ON public.fees FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS events_read ON public.events;
CREATE POLICY events_read ON public.events FOR SELECT TO authenticated
USING (public.current_app_role() IN ('admin', 'teacher', 'student'));
DROP POLICY IF EXISTS events_admin_write ON public.events;
CREATE POLICY events_admin_write ON public.events FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS notices_read ON public.notices;
CREATE POLICY notices_read ON public.notices FOR SELECT TO authenticated
USING (
    public.is_school_admin()
    OR (
        publish_date <= CURRENT_DATE
        AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
        AND (
            lower(audience) = 'all'
            OR lower(audience) = public.current_app_role()
            OR (public.current_app_role() = 'student' AND lower(audience) = 'students')
            OR (public.current_app_role() = 'teacher' AND lower(audience) = 'teachers')
        )
    )
);
DROP POLICY IF EXISTS notices_admin_write ON public.notices;
CREATE POLICY notices_admin_write ON public.notices FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

DROP POLICY IF EXISTS exams_read ON public.exams;
CREATE POLICY exams_read ON public.exams FOR SELECT TO authenticated
USING (public.current_app_role() IN ('admin', 'teacher', 'student'));
DROP POLICY IF EXISTS exams_admin_write ON public.exams;
CREATE POLICY exams_admin_write ON public.exams FOR ALL TO authenticated
USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

COMMIT;
