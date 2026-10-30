BEGIN;

CREATE OR REPLACE FUNCTION public.student_class_teachers()
RETURNS TABLE (
    id bigint,
    teacher_id varchar,
    first_name varchar,
    last_name varchar
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT DISTINCT t.id, t.teacher_id, t.first_name, t.last_name
    FROM public.teachers t
    WHERE lower(t.status) = 'active'
      AND public.current_app_role() = 'student'
      AND EXISTS (
          SELECT 1
          FROM public.students s
          JOIN public.classes c ON c.id = s.class_id
          WHERE public.is_student_owner(s.id)
            AND (
                c.class_teacher = t.id
                OR EXISTS (
                    SELECT 1
                    FROM public.teacher_subject_assignments a
                    WHERE a.class_id = c.id
                      AND a.teacher_id = t.id
                )
            )
      );
$$;

REVOKE ALL ON FUNCTION public.student_class_teachers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_class_teachers() TO authenticated;

COMMIT;