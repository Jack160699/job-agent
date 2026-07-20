const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

const SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "React",
  "Node.js",
  "Next.js",
  "AWS",
  "Docker",
  "Kubernetes",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "Git",
  "Java",
  "Go",
  "Rust",
  "C++",
  "Machine Learning",
  "AI",
  "DevOps",
  "GraphQL",
  "REST",
  "Redis",
  "Terraform",
  "CI/CD",
  "Agile",
  "Scrum",
  "HTML",
  "CSS",
  "Tailwind",
  "Vue",
  "Angular",
  "Express",
  "FastAPI",
  "Django",
  "Flask",
  "Spring",
  "Microservices",
  "System Design",
  "Excel",
  "Power BI",
  "Tableau",
  "SAP",
  "Jira",
  "Selenium",
];

const SECTION_HEADINGS = new Set([
  "summary",
  "profile",
  "experience",
  "work experience",
  "employment",
  "education",
  "skills",
  "technical skills",
  "projects",
  "certifications",
  "awards",
  "publications",
  "volunteering",
]);

export interface ParsedResume {
  rawText: string;
  skills: string[];
  content: {
    sections: Array<{ heading: string; text: string }>;
    source: {
      fileName?: string;
      mediaType: string;
      parser: string;
    };
  };
}

type PdfTextItemLike = {
  str?: unknown;
  hasEOL?: unknown;
  transform?: unknown;
};

/**
 * PDF.js exposes the line-ending signal on each text item, but unpdf's
 * high-level extractText helper joins those items with spaces. Resumes depend
 * on line and section boundaries for safe, deterministic extraction, so keep
 * PDF.js's explicit EOL markers and use vertical movement as a fallback for
 * PDFs whose producers omit hasEOL.
 */
export function reconstructPdfTextItems(items: readonly unknown[]): string {
  let output = "";
  let previousY: number | null = null;

  for (const candidate of items) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as PdfTextItemLike;
    if (typeof item.str !== "string" || item.str.length === 0) continue;

    const transform = Array.isArray(item.transform) ? item.transform : null;
    const y =
      transform && typeof transform[5] === "number" ? transform[5] : null;
    const movedToNewLine =
      previousY != null && y != null && Math.abs(y - previousY) > 2;

    if (output && movedToNewLine && !output.endsWith("\n")) {
      output = `${output.trimEnd()}\n`;
    }
    output += item.str;
    if (item.hasEOL === true) {
      output = `${output.trimEnd()}\n`;
    } else if (!output.endsWith(" ")) {
      output += " ";
    }
    previousY = y;
  }

  return output.trim();
}

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILLS.filter((skill) => lower.includes(skill.toLowerCase()));
}

export function parseResumeStructure(
  rawText: string,
  source: ParsedResume["content"]["source"]
): ParsedResume {
  const normalized = normalizeText(rawText);
  if (normalized.length < 80) {
    throw new Error(
      "The document did not contain enough readable text. Scanned PDFs require OCR before upload."
    );
  }

  const sections: Array<{ heading: string; text: string }> = [];
  let heading = "Profile";
  let lines: string[] = [];
  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) sections.push({ heading, text });
    lines = [];
  };

  for (const line of normalized.split("\n")) {
    const candidate = line.trim().toLowerCase().replace(/:$/, "");
    if (
      SECTION_HEADINGS.has(candidate) &&
      line.trim().length <= 40
    ) {
      flush();
      heading = line.trim().replace(/:$/, "");
    } else {
      lines.push(line);
    }
  }
  flush();

  return {
    rawText: normalized,
    skills: extractSkills(normalized),
    content: { sections, source },
  };
}

export async function parseResumeFile(input: {
  name: string;
  type: string;
  bytes: Uint8Array;
}): Promise<ParsedResume> {
  if (input.bytes.byteLength === 0) throw new Error("The selected file is empty.");
  if (input.bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error("Resume files must be 5 MB or smaller.");
  }

  const extension = input.name.toLowerCase().split(".").pop();
  let text = "";
  let parser = "";
  let mediaType = input.type || "application/octet-stream";

  if (
    extension === "pdf" &&
    new TextDecoder().decode(input.bytes.slice(0, 5)) === "%PDF-"
  ) {
    const { getDocumentProxy } = await import("unpdf");
    const document = await getDocumentProxy(input.bytes);
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(reconstructPdfTextItems(content.items));
    }
    text = pages.filter(Boolean).join("\n\n");
    parser = "unpdf";
    mediaType = "application/pdf";
  } else if (
    extension === "docx" &&
    input.bytes[0] === 0x50 &&
    input.bytes[1] === 0x4b
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(input.bytes),
    });
    text = result.value;
    parser = "mammoth";
    mediaType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (
    extension === "txt" &&
    (!input.type || input.type === "text/plain")
  ) {
    text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    parser = "utf8";
    mediaType = "text/plain";
  } else {
    throw new Error("Upload a valid PDF, DOCX, or plain-text resume.");
  }

  return parseResumeStructure(text, {
    fileName: input.name,
    mediaType,
    parser,
  });
}
