-- Keep tailored resumes after master resume deletion.
-- Version history still cascades with the master resume.

ALTER TABLE public.tailored_resumes
  ALTER COLUMN master_resume_id DROP NOT NULL;

ALTER TABLE public.tailored_resumes
  DROP CONSTRAINT IF EXISTS tailored_resumes_master_resume_id_fkey;

ALTER TABLE public.tailored_resumes
  ADD CONSTRAINT tailored_resumes_master_resume_id_fkey
  FOREIGN KEY (master_resume_id)
  REFERENCES public.master_resume(id)
  ON DELETE SET NULL;
