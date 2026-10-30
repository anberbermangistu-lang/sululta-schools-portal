ALTER TABLE public.results
    ADD COLUMN IF NOT EXISTS max_mark numeric(6, 2);

UPDATE public.results
SET max_mark = CASE
    WHEN exam_type ~* '^[[:space:]]*assignment([[:space:]]*[—–-]|$)' THEN 10
    WHEN exam_type ~* '^[[:space:]]*classwork([[:space:]]*[—–-]|$)' THEN 10
    WHEN exam_type ~* '^[[:space:]]*quiz(zes)?([[:space:]]*[—–-]|$)' THEN 10
    WHEN exam_type ~* '^[[:space:]]*test([[:space:]]*[—–-]|$)' THEN 20
    WHEN exam_type ~* '^[[:space:]]*mid[[:space:]-]*term([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 25
    WHEN exam_type ~* '^[[:space:]]*final([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 35
    ELSE 100
END
WHERE max_mark IS NULL;

ALTER TABLE public.results
    ALTER COLUMN max_mark SET DEFAULT 100,
    ALTER COLUMN max_mark SET NOT NULL;

ALTER TABLE public.results
    DROP CONSTRAINT IF EXISTS results_max_mark_positive_check;

ALTER TABLE public.results
    ADD CONSTRAINT results_max_mark_positive_check
    CHECK (max_mark > 0) NOT VALID;

CREATE OR REPLACE FUNCTION public.get_student_class_rank()
RETURNS TABLE(class_rank bigint, class_size bigint, student_average numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_student_id bigint;
    target_class_id bigint;
BEGIN
    IF auth.uid() IS NULL OR coalesce(public.current_app_role(), '') <> 'student' THEN
        RAISE EXCEPTION 'An active student account is required to view class rank.';
    END IF;

    SELECT s.id, s.class_id
    INTO target_student_id, target_class_id
    FROM public.students s
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE (s.user_id = auth.uid() OR p.student_id = s.id)
      AND s.class_id IS NOT NULL
    LIMIT 1;

    IF target_student_id IS NULL THEN
        RETURN QUERY SELECT NULL::bigint, 0::bigint, NULL::numeric;
        RETURN;
    END IF;

    RETURN QUERY
    WITH cohort AS (
        SELECT s.id
        FROM public.students s
        WHERE s.class_id = target_class_id
          AND lower(coalesce(s.status, 'active')) NOT IN ('inactive', 'transferred', 'deleted')
    ),
    categorized AS (
        SELECT
            s.id AS student_id,
            r.subject_code,
            r.exam_type,
            r.id AS result_id,
            r.created_at,
            CASE
                WHEN r.exam_type ~* '^[[:space:]]*assignment([[:space:]]*[—–-]|$)' THEN 'assignment'
                WHEN r.exam_type ~* '^[[:space:]]*classwork([[:space:]]*[—–-]|$)' THEN 'classwork'
                WHEN r.exam_type ~* '^[[:space:]]*quiz(zes)?([[:space:]]*[—–-]|$)' THEN 'quiz'
                WHEN r.exam_type ~* '^[[:space:]]*test([[:space:]]*[—–-]|$)' THEN 'test'
                WHEN r.exam_type ~* '^[[:space:]]*mid[[:space:]-]*term([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 'midterm'
                WHEN r.exam_type ~* '^[[:space:]]*final([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 'final'
                ELSE 'legacy'
            END AS category,
            CASE
                WHEN r.exam_type ~* '^[[:space:]]*assignment([[:space:]]*[—–-]|$)' THEN 10
                WHEN r.exam_type ~* '^[[:space:]]*classwork([[:space:]]*[—–-]|$)' THEN 10
                WHEN r.exam_type ~* '^[[:space:]]*quiz(zes)?([[:space:]]*[—–-]|$)' THEN 20
                WHEN r.exam_type ~* '^[[:space:]]*test([[:space:]]*[—–-]|$)' THEN 20
                WHEN r.exam_type ~* '^[[:space:]]*mid[[:space:]-]*term([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 20
                WHEN r.exam_type ~* '^[[:space:]]*final([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 20
                ELSE 100
            END AS current_max,
            coalesce(nullif(r.max_mark, 0), CASE
                WHEN r.exam_type ~* '^[[:space:]]*assignment([[:space:]]*[—–-]|$)' THEN 10
                WHEN r.exam_type ~* '^[[:space:]]*classwork([[:space:]]*[—–-]|$)' THEN 10
                WHEN r.exam_type ~* '^[[:space:]]*quiz(zes)?([[:space:]]*[—–-]|$)' THEN 10
                WHEN r.exam_type ~* '^[[:space:]]*test([[:space:]]*[—–-]|$)' THEN 20
                WHEN r.exam_type ~* '^[[:space:]]*mid[[:space:]-]*term([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 25
                WHEN r.exam_type ~* '^[[:space:]]*final([[:space:]]+exam)?([[:space:]]*[—–-]|$)' THEN 35
                ELSE 100
            END) AS source_max
        FROM public.results r
        JOIN public.students s
          ON r.student_id = s.id::text
          OR r.student_id = s.student_id
        JOIN cohort c ON c.id = s.id
        WHERE r.subject_code IS NOT NULL
          AND r.mark IS NOT NULL
    ),
    scaled AS (
        SELECT
            c.student_id,
            c.subject_code,
            c.exam_type,
            c.result_id,
            c.created_at,
            c.category,
            CASE
                WHEN c.category = 'legacy' THEN 'legacy:' || c.exam_type
                ELSE coalesce(
                    nullif(
                        btrim(regexp_replace(
                            c.exam_type,
                            '^[[:space:]]*(Assignment|Classwork|Quizzes?|Test|Mid[[:space:]-]*term([[:space:]]+Exam)?|Final([[:space:]]+Exam)?)[[:space:]]*[—–-][[:space:]]*',
                            '',
                            'i'
                        )),
                        ''
                    ),
                    'unspecified'
                )
            END AS session_key,
            CASE
                WHEN c.category = 'legacy'
                    THEN least(100::numeric, greatest(0::numeric, r.mark / c.source_max * 100))
                ELSE least(
                    c.current_max,
                    greatest(0::numeric, r.mark / c.source_max * c.current_max)
                )
            END AS normalized_mark
        FROM categorized c
        JOIN public.results r ON r.id = c.result_id
    ),
    latest_assessment AS (
        SELECT
            scaled.*,
            row_number() OVER (
                PARTITION BY student_id, subject_code, session_key, category
                ORDER BY created_at DESC NULLS LAST, result_id DESC
            ) AS record_order
        FROM scaled
    ),
    subject_sessions AS (
        SELECT
            student_id,
            subject_code,
            session_key,
            CASE
                WHEN bool_or(category <> 'legacy')
                    THEN coalesce(sum(normalized_mark) FILTER (WHERE category <> 'legacy'), 0)
                ELSE max(normalized_mark) FILTER (WHERE category = 'legacy')
            END AS subject_mark,
            max(created_at) AS latest_result_at
        FROM latest_assessment
        WHERE record_order = 1
        GROUP BY student_id, subject_code, session_key
    ),
    latest_subjects AS (
        SELECT DISTINCT ON (student_id, subject_code)
            student_id,
            subject_code,
            subject_mark
        FROM subject_sessions
        ORDER BY student_id, subject_code, latest_result_at DESC NULLS LAST, session_key DESC
    ),
    student_averages AS (
        SELECT
            c.id AS student_id,
            avg(ls.subject_mark)::numeric AS average
        FROM cohort c
        LEFT JOIN latest_subjects ls ON ls.student_id = c.id
        GROUP BY c.id
    ),
    ranked_students AS (
        SELECT
            student_id,
            average,
            rank() OVER (ORDER BY average DESC NULLS LAST) AS position,
            count(*) OVER () AS cohort_size
        FROM student_averages
    )
    SELECT
        CASE WHEN r.average IS NULL THEN NULL ELSE r.position END,
        r.cohort_size,
        r.average
    FROM ranked_students r
    WHERE r.student_id = target_student_id;
END
$$;

REVOKE ALL ON FUNCTION public.get_student_class_rank() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_class_rank() TO authenticated;

NOTIFY pgrst, 'reload schema';
