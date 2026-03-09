-- Seed service for PayKeeper tariff "course" → enrollment on payment
-- Links first course to tariff_id "course" for webhook enrollment flow.
INSERT INTO public.services (slug, name, price, paykeeper_tariff_id, course_id, is_active)
SELECT 'course-avaterra', 'Курс AVATERRA', 25000, 'course', id, true
FROM public.courses
WHERE status IN ('published', 'draft')
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET
  paykeeper_tariff_id = EXCLUDED.paykeeper_tariff_id,
  course_id = EXCLUDED.course_id,
  updated_at = now();
