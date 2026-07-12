import { writeFile } from "fs/promises";
import { join } from "path";
import type { ApplicationDocuments, BrowserAutomationClient } from "@/lib/browser/types";
import { findElementWithFallbacks } from "./resilient";

export async function uploadDocuments(
  browser: BrowserAutomationClient,
  documents: ApplicationDocuments,
  tmpDir: string
) {
  const snap = await browser.snapshot();

  if (documents.resumePdf) {
    const fileField = findElementWithFallbacks(
      snap,
      [/resume/i, /cv/i, /upload/i],
      [/file/i, /type="file"/i]
    );
    if (fileField) {
      const pdfPath = join(tmpDir, `resume-upload-${Date.now()}.pdf`);
      await writeFile(pdfPath, documents.resumePdf);
      try {
        await browser.upload(fileField.ref, pdfPath);
      } catch {
        // Fall back to text paste below
      }
    }
  }

  if (documents.resumeText) {
    const resumeField = findElementWithFallbacks(snap, [
      /resume/i,
      /cv/i,
      /paste/i,
      /experience/i,
    ]);
    if (resumeField) {
      await browser.type(resumeField.ref, documents.resumeText.slice(0, 8000));
    }
  }

  if (documents.coverLetterText) {
    const clField = findElementWithFallbacks(snap, [
      /cover letter/i,
      /motivation/i,
      /why do you want/i,
      /additional information/i,
    ]);
    if (clField) {
      await browser.type(clField.ref, documents.coverLetterText.slice(0, 5000));
    }
  }

  if (documents.coverLetterPdf) {
    const clFile = findElementWithFallbacks(snap, [/cover letter/i, /attachment/i], [/file/i]);
    if (clFile) {
      const clPath = join(tmpDir, `cover-letter-${Date.now()}.pdf`);
      await writeFile(clPath, documents.coverLetterPdf);
      try {
        await browser.upload(clFile.ref, clPath);
      } catch {
        // optional
      }
    }
  }
}
