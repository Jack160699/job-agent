# Document Intelligence

## Master resume intake

Supported uploads:

- PDF text documents via `unpdf`
- DOCX via `mammoth`
- UTF-8 plain text
- Manual paste as a fallback

Guardrails:

- Maximum upload size: 5 MB
- Empty and spoofed files are rejected
- Scanned PDFs without extractable text are rejected with an OCR guidance message
- Skill and section detection use only the uploaded text

## Versioning

Each replacement of the master resume archives the previous version in `master_resume_versions`. Users can list and restore prior versions without inventing missing content.

## Tailoring and cover letters

Resume tailoring and cover-letter generation keep the existing no-invention policy: only facts present in the master resume and job posting may be used.

Tailored resumes can be downloaded as PDFs through ownership-checked `/api/resumes/[id]/pdf`.

## User control

- Edit or replace the master resume
- Delete the master resume
- Restore a prior version
- Download tailored resume PDFs
