-- Phase B (Performance, ATS Intelligence, and Job Search Reliability V1):
-- "work authorization" and "travel willingness" are two of the explicitly
-- required-for-application questions Kairela must be able to ask and store,
-- and had no column to persist to. Added as plain nullable text columns
-- (small, bounded value sets — not enums — so new authorization/travel
-- categories never require another migration).
--
-- FORWARD-ONLY. Does not modify any previously applied migration.
-- NOT applied to any remote database by this change.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS work_authorization TEXT,
  ADD COLUMN IF NOT EXISTS travel_willingness TEXT;
