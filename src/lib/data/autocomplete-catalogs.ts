import { INDIA_COMPANY_BOARD_REGISTRY } from "@/lib/jobs/company-board-registry";

export type AutocompleteCatalog =
  | "skills"
  | "degrees"
  | "specializations"
  | "institutions"
  | "companies"
  | "industries"
  | "certifications"
  | "languages"
  | "government_departments"
  | "government_categories"
  | "public_sector_organizations"
  | "employment_types"
  | "currencies"
  | "states"
  | "countries";

const CATALOGS: Record<AutocompleteCatalog, string[]> = {
  skills: [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python",
    "Java", "C++", "C#", "Go", "SQL", "PostgreSQL", "MySQL", "MongoDB",
    "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Git",
    "REST APIs", "GraphQL", "Machine Learning", "Generative AI", "LLM",
    "Prompt Engineering", "Data Analysis", "Power BI", "Tableau", "Excel",
    "Project Management", "Process Improvement", "Customer Success",
    "Sales", "Digital Marketing", "SEO", "Content Marketing", "Recruitment",
    "Nursing", "Patient Care", "Teaching", "Curriculum Design", "AutoCAD",
    "SolidWorks", "PLC", "Quality Assurance", "Banking Operations",
  ],
  degrees: [
    "B.Tech", "B.E.", "B.Sc", "B.Com", "B.A.", "BBA", "BCA", "M.Tech",
    "M.E.", "M.Sc", "M.Com", "M.A.", "MBA", "MCA", "Diploma", "Ph.D.",
    "MBBS", "BDS", "B.Pharm", "M.Pharm", "B.Sc Nursing", "GNM", "ANM",
    "B.Ed", "M.Ed", "LLB", "LLM",
  ],
  specializations: [
    "Computer Science", "Information Technology", "Artificial Intelligence",
    "Data Science", "Electronics and Communication", "Electrical Engineering",
    "Mechanical Engineering", "Civil Engineering", "Chemical Engineering",
    "Finance", "Marketing", "Human Resources", "Operations", "Nursing",
    "Education", "Mathematics", "Physics", "Chemistry", "Commerce",
  ],
  institutions: [
    "Indian Institute of Technology", "National Institute of Technology",
    "Indian Institute of Information Technology", "University of Delhi",
    "University of Mumbai", "Savitribai Phule Pune University",
    "Anna University", "Jadavpur University", "Banaras Hindu University",
    "Visvesvaraya Technological University", "AIIMS", "IGNOU",
  ],
  companies: [
    ...new Set(INDIA_COMPANY_BOARD_REGISTRY.map((item) => item.company)),
    "Tata Consultancy Services", "Infosys", "Wipro", "HCLTech", "Tech Mahindra",
    "Accenture", "Cognizant", "IBM", "Microsoft", "Google", "Amazon",
    "Flipkart", "Swiggy", "Zomato", "Razorpay", "Meesho",
  ],
  industries: [
    "Software", "Information Technology", "Artificial Intelligence", "Fintech",
    "Banking", "Financial Services", "Healthcare", "Pharmaceuticals",
    "Education", "EdTech", "Manufacturing", "Automotive", "Engineering",
    "Telecommunications", "Retail", "E-commerce", "Logistics", "Consulting",
    "Media", "Marketing", "Hospitality", "Energy", "Public Sector",
  ],
  certifications: [
    "AWS Certified Cloud Practitioner", "AWS Solutions Architect",
    "Microsoft Azure Fundamentals", "Google Cloud Professional",
    "PMP", "PRINCE2", "Scrum Master", "ITIL", "CCNA", "CompTIA Security+",
    "Google Data Analytics", "Microsoft Power BI Data Analyst",
    "Chartered Accountant", "CFA", "NISM", "BLS", "ACLS",
  ],
  languages: [
    "English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil", "Urdu",
    "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi", "Assamese",
    "Maithili", "Sanskrit", "Konkani", "Nepali",
  ],
  government_departments: [
    "Staff Selection Commission", "Union Public Service Commission",
    "Railway Recruitment Board", "Department of Posts", "Ministry of Defence",
    "Ministry of Home Affairs", "Ministry of Health and Family Welfare",
    "Ministry of Education", "Department of Telecommunications",
    "State Public Service Commission",
  ],
  government_categories: [
    "General", "EWS", "OBC-NCL", "SC", "ST", "PwBD", "Ex-Serviceman",
    "Banking", "Railways", "Defence", "Teaching", "Healthcare", "PSU",
    "Apprenticeship",
  ],
  public_sector_organizations: [
    "ISRO", "DRDO", "NTPC", "BEL", "BHEL", "ONGC", "GAIL", "SAIL",
    "Coal India", "Power Grid", "Indian Oil", "State Bank of India",
    "Reserve Bank of India", "AIIMS", "Indian Railways",
  ],
  employment_types: [
    "Full time", "Part time", "Contract", "Internship", "Apprenticeship",
    "Freelance", "Temporary", "Graduate trainee",
  ],
  currencies: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"],
  states: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh",
  ],
  countries: [
    "India", "United Arab Emirates", "Singapore", "United Kingdom",
    "United States", "Canada", "Australia", "Germany", "France",
    "Netherlands", "Ireland", "Japan",
  ],
};

export function searchAutocompleteCatalog(
  catalog: AutocompleteCatalog,
  query: string,
  limit = 12
): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return CATALOGS[catalog]
    .filter((value) => value.toLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftStarts = left.toLowerCase().startsWith(normalized);
      const rightStarts = right.toLowerCase().startsWith(normalized);
      return Number(rightStarts) - Number(leftStarts) || left.localeCompare(right);
    })
    .slice(0, limit);
}
