import { Prisma } from "@prisma/client";
import type {
  ExtractedField,
  ParsedCareerProfile,
} from "@/lib/resumes/career-profile";

type TransactionClient = Prisma.TransactionClient;

function nullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function splitCandidateLocation(value: string | null | undefined): {
  city: string | null;
  state: string | null;
  country: string;
} {
  const parts = (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      city: parts[0],
      state: parts.slice(1, -1).join(", "),
      country: parts.at(-1) || "India",
    };
  }
  return {
    city: parts[0] ?? null,
    state: parts[1] ?? null,
    country: "India",
  };
}

export function normalizeProfileDate(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  if (!cleaned || /present|current|now/i.test(cleaned)) return null;
  if (/^\d{4}$/.test(cleaned)) return `${cleaned}-01-01`;
  if (/^\d{4}-\d{2}$/.test(cleaned)) return `${cleaned}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const parsed = new Date(`1 ${cleaned}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
}

function sourceType(field: ExtractedField<unknown>): string {
  if (field.source === "user_edit") return "user_edit";
  if (field.source === "user_confirmed") return "user_confirmed";
  if (field.source === "onboarding") return "onboarding";
  if (field.source === "answer_bank") return "answer_bank";
  if (field.source === "ai_inferred") return "ai_inferred";
  return field.directlyFound ? "resume_extracted" : "system_generated";
}

function reviewStatus(field: ExtractedField<unknown>): string {
  return field.needsReview ? "needs_review" : "reviewed";
}

function confirmationState(field: ExtractedField<unknown>): string {
  return field.source === "user_edit" ||
    field.source === "user_confirmed" ||
    field.source === "onboarding" ||
    field.source === "answer_bank"
    ? "confirmed"
    : "unconfirmed";
}

/**
 * Compatibility writer for the normalized Career OS model. Legacy
 * MasterResume JSON remains the read path during rollout, while every save is
 * mirrored transactionally into normalized owner-scoped tables.
 */
export async function syncNormalizedCandidateProfile(
  tx: TransactionClient,
  input: {
    userId: string;
    masterResumeId: string;
    profile: ParsedCareerProfile;
  }
): Promise<void> {
  const { userId, masterResumeId, profile } = input;
  const reviewRequiredCount = Object.values(profile).filter(
    (value) =>
      value &&
      typeof value === "object" &&
      "needsReview" in value &&
      value.needsReview === true
  ).length;
  const profileRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO public.candidate_profiles (
      user_id, professional_headline, professional_summary, current_job_role,
      years_of_experience, review_required_count, legacy_master_resume_id,
      updated_at
    )
    VALUES (
      ${userId}::uuid,
      ${nullable(profile.currentRole.value)},
      ${nullable(profile.professionalSummary.value)},
      ${nullable(profile.currentRole.value)},
      ${profile.experienceYears.value},
      ${reviewRequiredCount},
      ${masterResumeId}::uuid,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      professional_headline = EXCLUDED.professional_headline,
      professional_summary = EXCLUDED.professional_summary,
      current_job_role = EXCLUDED.current_job_role,
      years_of_experience = EXCLUDED.years_of_experience,
      review_required_count = EXCLUDED.review_required_count,
      legacy_master_resume_id = EXCLUDED.legacy_master_resume_id,
      updated_at = now()
    RETURNING id
  `);
  const candidateProfileId = profileRows[0]?.id;
  if (!candidateProfileId) throw new Error("NORMALIZED_PROFILE_SYNC_FAILED");

  const location = splitCandidateLocation(profile.currentLocation.value);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO public.candidate_contact_details (
      user_id, candidate_profile_id, full_name, email, phone, city, state,
      country, updated_at
    )
    VALUES (
      ${userId}::uuid, ${candidateProfileId}::uuid,
      ${nullable(profile.fullName.value)}, ${nullable(profile.email.value)},
      ${nullable(profile.phone.value)}, ${location.city}, ${location.state},
      ${location.country}, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      candidate_profile_id = EXCLUDED.candidate_profile_id,
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      country = EXCLUDED.country,
      updated_at = now()
  `);

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_experiences WHERE user_id = ${userId}::uuid
  `);
  for (const [position, entry] of profile.experience.value.entries()) {
    const startDate = normalizeProfileDate(entry.startDate);
    const endDate = entry.current ? null : normalizeProfileDate(entry.endDate);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_experiences (
        user_id, candidate_profile_id, position, job_title, employer, location,
        start_date, end_date, is_current, responsibilities, source_text
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${position},
        ${nullable(entry.title)}, ${nullable(entry.company)},
        ${nullable(entry.location)},
        CAST(${startDate} AS date), CAST(${endDate} AS date), ${entry.current},
        ${entry.description ? [entry.description] : []}::text[],
        ${nullable(entry.evidence)}
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_education WHERE user_id = ${userId}::uuid
  `);
  for (const [position, entry] of profile.education.value.entries()) {
    const startYear = entry.startDate?.match(/\b(19|20)\d{2}\b/)?.[0];
    const endYear = entry.endDate?.match(/\b(19|20)\d{2}\b/)?.[0];
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_education (
        user_id, candidate_profile_id, position, degree, specialization,
        institution, start_year, end_year, source_text
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${position},
        ${nullable(entry.degree)}, ${nullable(entry.field)},
        ${nullable(entry.institution)}, ${startYear ? Number(startYear) : null},
        ${endYear ? Number(endYear) : null}, ${nullable(entry.evidence)}
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_projects WHERE user_id = ${userId}::uuid
  `);
  for (const [position, entry] of profile.projects.value.entries()) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_projects (
        user_id, candidate_profile_id, position, name, description,
        technologies, source_text
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${position},
        ${nullable(entry.name)}, ${nullable(entry.description)},
        ${entry.technologies}::text[], ${nullable(entry.evidence)}
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_skills WHERE user_id = ${userId}::uuid
  `);
  const seenSkills = new Set<string>();
  for (const [position, skill] of profile.skills.value.entries()) {
    const normalized = skill.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized || seenSkills.has(normalized)) continue;
    seenSkills.add(normalized);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_skills (
        user_id, candidate_profile_id, name, normalized_name, category, position
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${skill.trim()},
        ${normalized}, 'core', ${position}
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_certifications WHERE user_id = ${userId}::uuid
  `);
  for (const [position, certification] of profile.certifications.value.entries()) {
    if (!certification.trim()) continue;
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_certifications (
        user_id, candidate_profile_id, position, name
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${position},
        ${certification.trim()}
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_languages WHERE user_id = ${userId}::uuid
  `);
  for (const [position, language] of profile.languages.value.entries()) {
    if (!language.trim()) continue;
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_languages (
        user_id, candidate_profile_id, language, position
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${language.trim()}, ${position}
      )
      ON CONFLICT (candidate_profile_id, language) DO NOTHING
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_links WHERE user_id = ${userId}::uuid
  `);
  const links = [
    ["linkedin", profile.linkedinUrl.value],
    ["github", profile.githubUrl.value],
    ["portfolio", profile.portfolioUrl.value],
  ] as const;
  for (const [position, [linkType, url]] of links.entries()) {
    if (!url) continue;
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_links (
        user_id, candidate_profile_id, link_type, url, position
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${linkType}, ${url}, ${position}
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.candidate_job_targets WHERE user_id = ${userId}::uuid
  `);
  const seenTitles = new Set<string>();
  for (const [priority, title] of profile.jobTitles.value.entries()) {
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalizedTitle || seenTitles.has(normalizedTitle)) continue;
    seenTitles.add(normalizedTitle);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.candidate_job_targets (
        user_id, candidate_profile_id, title, normalized_title, priority,
        is_primary
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, ${title.trim()},
        ${normalizedTitle}, ${priority}, ${priority === 0}
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM public.profile_field_sources
    WHERE user_id = ${userId}::uuid AND entity_type = 'candidate_profile'
  `);
  const trackedFields = [
    ["full_name", profile.fullName],
    ["email", profile.email],
    ["phone", profile.phone],
    ["current_location", profile.currentLocation],
    ["professional_summary", profile.professionalSummary],
    ["current_role", profile.currentRole],
    ["job_titles", profile.jobTitles],
    ["skills", profile.skills],
    ["experience", profile.experience],
    ["education", profile.education],
    ["projects", profile.projects],
    ["certifications", profile.certifications],
    ["languages", profile.languages],
    ["linkedin_url", profile.linkedinUrl],
    ["github_url", profile.githubUrl],
    ["portfolio_url", profile.portfolioUrl],
  ] as const;
  for (const [fieldName, field] of trackedFields) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.profile_field_sources (
        user_id, candidate_profile_id, entity_type, field_name, source_type,
        source_section, confidence, review_status, confirmation_state,
        modified_by
      )
      VALUES (
        ${userId}::uuid, ${candidateProfileId}::uuid, 'candidate_profile',
        ${fieldName}, ${sourceType(field)}, ${field.source}, ${field.confidence},
        ${reviewStatus(field)}, ${confirmationState(field)},
        ${confirmationState(field) === "confirmed" ? "user" : "system"}
      )
    `);
  }
}
