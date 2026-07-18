/**
 * Curated job-title suggestions for autocomplete fields (target job title,
 * current role, excluded titles). Broad coverage across engineering,
 * product, data, design, operations, business, and support functions —
 * not exhaustive, but a real, representative set rather than a handful of
 * placeholders.
 */
export const JOB_TITLES: string[] = [
  // Engineering
  "Software Engineer",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Junior Software Developer",
  "Backend Developer",
  "Frontend Developer",
  "Full Stack Developer",
  "Mobile Developer",
  "iOS Developer",
  "Android Developer",
  "DevOps Engineer",
  "Site Reliability Engineer",
  "Cloud Engineer",
  "Platform Engineer",
  "Infrastructure Engineer",
  "QA Engineer",
  "Test Automation Engineer",
  "Embedded Systems Engineer",
  "Security Engineer",
  "AI Automation Engineer",
  "Machine Learning Engineer",
  "AI Engineer",
  "Data Engineer",
  "Solutions Architect",
  "Engineering Manager",
  "Technical Lead",
  "Principal Engineer",
  // Data & Analytics
  "Data Analyst",
  "Data Scientist",
  "Business Analyst",
  "Business Intelligence Analyst",
  "Analytics Engineer",
  "Research Analyst",
  // Product & Design
  "Product Manager",
  "Associate Product Manager",
  "Senior Product Manager",
  "Product Owner",
  "Product Operations Associate",
  "UX Designer",
  "UI Designer",
  "Product Designer",
  "UX Researcher",
  "Graphic Designer",
  // Operations
  "Operations Analyst",
  "Technical Operations Analyst",
  "Implementation Analyst",
  "Operations Manager",
  "Business Operations Manager",
  "Program Manager",
  "Project Manager",
  "Supply Chain Analyst",
  "Logistics Coordinator",
  "Process Analyst",
  // Sales & Marketing
  "Sales Executive",
  "Account Executive",
  "Business Development Manager",
  "Business Development Executive",
  "Sales Manager",
  "Customer Success Manager",
  "Marketing Manager",
  "Digital Marketing Manager",
  "Content Marketing Manager",
  "SEO Specialist",
  "Growth Marketing Manager",
  "Brand Manager",
  // Finance
  "Financial Analyst",
  "Accountant",
  "Chartered Accountant",
  "Finance Manager",
  "Investment Analyst",
  "Risk Analyst",
  "Audit Associate",
  // HR & People
  "HR Generalist",
  "HR Business Partner",
  "Talent Acquisition Specialist",
  "Recruiter",
  "People Operations Manager",
  "Learning and Development Specialist",
  // Customer Support
  "Customer Support Executive",
  "Customer Support Specialist",
  "Technical Support Engineer",
  "Support Team Lead",
  // Consulting & Strategy
  "Management Consultant",
  "Business Consultant",
  "Strategy Analyst",
  // Leadership
  "Chief Technology Officer",
  "Chief Product Officer",
  "VP of Engineering",
  "Director of Engineering",
  "Head of Product",
  "Head of Operations",
  // Early career
  "Software Engineering Intern",
  "Graduate Trainee",
  "Management Trainee",
  "Associate Software Engineer",
];

/** Case-insensitive prefix + substring match. */
export function searchJobTitles(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const title of JOB_TITLES) {
    const t = title.toLowerCase();
    if (t.startsWith(q)) {
      starts.push(title);
    } else if (t.includes(q)) {
      contains.push(title);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
