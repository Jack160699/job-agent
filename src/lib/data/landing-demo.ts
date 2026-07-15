/**
 * Synthetic, public-safe fixtures used only by the Kairela marketing experience.
 * No record in this file belongs to a real Kairela user and no application is sent.
 */

export const heroCandidate = {
  name: "Aditi Sharma",
  initials: "AS",
  targetRole: "Business Analyst",
  location: "Pune / Remote",
  salary: "₹10–14 LPA",
  match: 89,
  company: "Northstar Retail",
  status: ["Resume ready", "Application prepared", "Interview reminder"],
} as const;

export const discoverPreferences = [
  "Business Analyst",
  "Pune",
  "Bengaluru",
  "Hyderabad",
  "Remote",
  "₹10–14 LPA",
] as const;

export const discoverMatches = [
  {
    company: "Northstar Retail",
    role: "Business Analyst",
    location: "Pune · Hybrid",
    match: 89,
    reason: "Strong SQL, reporting, and stakeholder-fit signals",
    status: "Relevant",
  },
  {
    company: "BluePeak Finance",
    role: "Operations Analyst",
    location: "Remote · India",
    match: 83,
    reason: "Good process analysis overlap; domain ramp-up needed",
    status: "Relevant",
  },
  {
    company: "Cedar Systems",
    role: "Senior Product Analyst",
    location: "Mumbai · On-site",
    match: 61,
    reason: "Outside location preference and seniority range",
    status: "Excluded",
  },
] as const;

export const applicationChecks = [
  { label: "Public job link extracted", state: "Complete" },
  { label: "Profile compared with requirements", state: "Complete" },
  { label: "Resume suggestions use verified experience", state: "Checked" },
  { label: "ATS structure and keywords reviewed", state: "Ready" },
  { label: "Candidate review required before submission", state: "Required" },
] as const;

export const growthSignals = [
  {
    label: "Recruiter reply",
    detail: "Interview availability requested",
    time: "12 min ago",
  },
  {
    label: "Interview prep",
    detail: "6 role-specific questions prepared",
    time: "Today",
  },
  {
    label: "Salary context",
    detail: "Pune analyst range: ₹9.5–14.5 LPA",
    time: "Updated weekly",
  },
] as const;

export const thinkingSteps = [
  {
    title: "Job link received",
    detail: "A public role page is ready to analyse.",
    badge: "Input",
  },
  {
    title: "Role identified",
    detail: "Business Analyst at Northstar Retail, Pune hybrid.",
    badge: "Extract",
  },
  {
    title: "Profile compared",
    detail: "Experience, skills, location, and compensation preferences aligned.",
    badge: "Compare",
  },
  {
    title: "89% match explained",
    detail: "SQL, reporting, and stakeholder work are the strongest signals.",
    badge: "Match",
  },
  {
    title: "Strengths and gaps surfaced",
    detail: "Strong analysis foundation; retail metrics are a learnable gap.",
    badge: "Explain",
  },
  {
    title: "Resume changes suggested",
    detail: "Three truthful edits improve relevance without adding experience.",
    badge: "Tailor",
  },
  {
    title: "Cover letter prepared",
    detail: "A concise draft connects verified projects to the role.",
    badge: "Draft",
  },
  {
    title: "Application ready for review",
    detail: "Nothing is submitted until Aditi approves the materials.",
    badge: "Review",
  },
  {
    title: "Follow-up planned",
    detail: "Interview preparation and a reminder are scheduled.",
    badge: "Follow up",
  },
] as const;

export const roleGroups = [
  {
    eyebrow: "Technology",
    roles: [
      "Software Engineer",
      "Frontend Developer",
      "Backend Developer",
      "Data Analyst",
      "Cybersecurity Analyst",
      "Cloud Engineer",
      "QA Engineer",
      "Product Designer",
    ],
  },
  {
    eyebrow: "Business & operations",
    roles: [
      "Business Analyst",
      "Operations Executive",
      "HR Executive",
      "Customer Success",
      "Sales Executive",
      "Marketing Executive",
      "Finance Analyst",
      "Supply Chain Analyst",
    ],
  },
  {
    eyebrow: "Engineering & professional",
    roles: [
      "Mechanical Engineer",
      "Civil Engineer",
      "Electrical Engineer",
      "Chartered Accountant",
      "Nurse",
      "Pharmacist",
      "Store Manager",
      "Relationship Manager",
    ],
  },
] as const;

export const illustrativeEmployers = [
  "TCS",
  "Infosys",
  "HCLTech",
  "Accenture",
  "Deloitte",
  "Flipkart",
  "Reliance",
  "Mahindra",
  "L&T",
  "HDFC Bank",
  "ICICI Bank",
  "PhonePe",
  "Swiggy",
  "Apollo Hospitals",
  "Cipla",
  "Taj Hotels",
] as const;

export const illustrativeScenarios = [
  {
    initials: "AM",
    title: "MCA graduate in Pune",
    situation: "Finding technical roles without losing track of every application.",
    outcome: "A focused search plan, explainable matches, and review-ready materials.",
  },
  {
    initials: "RK",
    title: "Operations professional switching industries",
    situation: "Translating transferable process skills for a new domain.",
    outcome: "Clear strengths, realistic gaps, and an interview preparation plan.",
  },
  {
    initials: "SN",
    title: "Fresher preparing first applications",
    situation: "Unsure how to present projects truthfully and professionally.",
    outcome: "A consistent profile and application checklist with review controls.",
  },
  {
    initials: "PV",
    title: "Recruiter organising shortlists",
    situation: "Keeping candidate context, follow-ups, and interviews connected.",
    outcome: "A structured workspace for decisions and next actions.",
  },
] as const;

export const pricingTiers = [
  {
    name: "Free",
    price: "₹0",
    cadence: "to begin",
    description: "Understand your fit and organise an active search.",
    features: ["Preference profile", "Limited job matches", "Match explanations", "Application tracker"],
  },
  {
    name: "Pro",
    price: "₹499",
    cadence: "per month when launched",
    description: "Prepare more focused applications with Kairela's guidance.",
    features: ["Higher monthly match allowance", "Resume suggestions", "Cover letter drafts", "Interview preparation"],
  },
  {
    name: "Premium",
    price: "₹999",
    cadence: "per month when launched",
    description: "Add proactive planning and deeper career intelligence.",
    features: ["Everything in Pro", "Weekly career report", "Salary context", "Priority AI consultant access"],
  },
] as const;
