import type { UserSettings } from "@prisma/client";

/**
 * Safe synthetic WS7 profiles. Do not store or reuse real private user data.
 */
export const WS7_SYNTHETIC_PROFILES: Array<{
  id: string;
  label: string;
  settings: Partial<UserSettings>;
}> = [
  {
    id: "mca-fresher-pune",
    label: "MCA fresher seeking junior developer roles in Pune",
    settings: {
      jobTitles: ["Junior Software Developer"],
      experienceYears: 0,
      requiredSkills: ["Java", "SQL"],
      locations: ["Pune"],
      workModes: ["ONSITE", "HYBRID"],
      salaryCurrency: "INR",
      matchThreshold: 60,
    },
  },
  {
    id: "frontend-bengaluru",
    label: "Frontend developer with two years in Bengaluru",
    settings: {
      jobTitles: ["Frontend Developer"],
      experienceYears: 2,
      requiredSkills: ["React", "TypeScript"],
      locations: ["Bengaluru"],
      workModes: ["HYBRID"],
      salaryCurrency: "INR",
    },
  },
  {
    id: "operations-pune-remote",
    label: "Operations analyst seeking Pune or remote work",
    settings: {
      jobTitles: ["Operations Analyst"],
      experienceYears: 3,
      requiredSkills: ["Excel", "SQL"],
      locations: ["Pune"],
      workModes: ["REMOTE", "HYBRID"],
    },
  },
  {
    id: "mechanical-pune",
    label: "Mechanical engineer seeking manufacturing roles in Pune",
    settings: {
      jobTitles: ["Mechanical Engineer"],
      experienceYears: 4,
      requiredSkills: ["AutoCAD", "Manufacturing"],
      industries: ["Manufacturing"],
      locations: ["Pune"],
      workModes: ["ONSITE"],
    },
  },
  {
    id: "hr-mumbai",
    label: "HR executive seeking Mumbai roles",
    settings: {
      jobTitles: ["HR Executive"],
      experienceYears: 3,
      requiredSkills: ["Recruitment"],
      locations: ["Mumbai"],
      workModes: ["ONSITE", "HYBRID"],
    },
  },
  {
    id: "finance-delhi-ncr",
    label: "Finance analyst seeking Delhi NCR roles",
    settings: {
      jobTitles: ["Finance Analyst"],
      experienceYears: 3,
      requiredSkills: ["Financial modelling"],
      locations: ["Delhi NCR"],
      workModes: ["HYBRID", "ONSITE"],
    },
  },
  {
    id: "tier2-india-remote",
    label: "Tier-2 city user seeking India-remote roles",
    settings: {
      jobTitles: ["Software Developer"],
      experienceYears: 2,
      requiredSkills: ["JavaScript"],
      locations: ["Indore", "India"],
      workModes: ["REMOTE"],
    },
  },
  {
    id: "backend-hybrid",
    label: "Experienced backend engineer seeking hybrid roles",
    settings: {
      jobTitles: ["Backend Engineer"],
      experienceYears: 7,
      requiredSkills: ["Node.js", "PostgreSQL"],
      locations: ["Hyderabad"],
      workModes: ["HYBRID"],
    },
  },
  {
    id: "strict-salary",
    label: "User with strict salary requirements",
    settings: {
      jobTitles: ["Software Engineer"],
      experienceYears: 5,
      requiredSkills: ["Java"],
      locations: ["Pune"],
      salaryMin: 1_800_000,
      salaryMax: 2_400_000,
      salaryCurrency: "INR",
      workModes: ["HYBRID", "REMOTE"],
    },
  },
  {
    id: "excluded-companies",
    label: "User excluding specific companies",
    settings: {
      jobTitles: ["Software Engineer"],
      experienceYears: 4,
      requiredSkills: ["Python"],
      locations: ["Bengaluru"],
      targetCompanies: ["Acme"],
      excludedCompanies: ["Bad Corp"],
      workModes: ["HYBRID"],
    },
  },
];
