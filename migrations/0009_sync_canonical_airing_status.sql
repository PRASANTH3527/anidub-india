-- Migration 0009: Reconcile legacy `status` and `airing_status` columns into one canonical lifecycle status
-- Canonical values for published anime: 'Airing', 'Completed', 'Upcoming'
-- Pending moderation submissions (`status = 'pending'`) are preserved untouched.

UPDATE anime
SET status = 'Airing',
    airing_status = 'Airing'
WHERE LOWER(COALESCE(status, '')) != 'pending'
  AND (
    LOWER(COALESCE(airing_status, '')) IN ('airing', 'ongoing', 'simulcast')
    OR LOWER(COALESCE(airing_status, '')) LIKE '%airing%'
    OR LOWER(COALESCE(airing_status, '')) LIKE '%ongoing%'
    OR LOWER(COALESCE(airing_status, '')) LIKE '%simulcast%'
  );

UPDATE anime
SET status = 'Upcoming',
    airing_status = 'Upcoming'
WHERE LOWER(COALESCE(status, '')) != 'pending'
  AND LOWER(COALESCE(airing_status, '')) LIKE '%upcoming%';

UPDATE anime
SET status = 'Airing',
    airing_status = 'Airing'
WHERE LOWER(COALESCE(status, '')) != 'pending'
  AND TRIM(COALESCE(airing_status, '')) = ''
  AND (
    LOWER(COALESCE(status, '')) IN ('airing', 'ongoing', 'simulcast')
    OR LOWER(COALESCE(status, '')) LIKE '%airing%'
    OR LOWER(COALESCE(status, '')) LIKE '%ongoing%'
    OR LOWER(COALESCE(status, '')) LIKE '%simulcast%'
  );

UPDATE anime
SET status = 'Upcoming',
    airing_status = 'Upcoming'
WHERE LOWER(COALESCE(status, '')) != 'pending'
  AND TRIM(COALESCE(airing_status, '')) = ''
  AND LOWER(COALESCE(status, '')) LIKE '%upcoming%';

UPDATE anime
SET status = 'Completed',
    airing_status = 'Completed'
WHERE LOWER(COALESCE(status, '')) != 'pending'
  AND LOWER(COALESCE(airing_status, '')) NOT IN ('airing', 'upcoming')
  AND LOWER(COALESCE(status, '')) NOT IN ('airing', 'upcoming');
