/** Kairela brand constants — single source of truth for product identity. */
export const BRAND = {
  name: "Kairela",
  tagline: "Your AI career and hiring operating system",
  promise: "Kairela manages your job search with honesty, clarity, and care.",
  domain: "kairela.com",
  supportEmail: "hello@kairela.com",
} as const;

export const BRAND_VOICE = {
  tone: ["human", "professional", "optimistic", "calm", "trustworthy", "intelligent"],
  avoid: ["hype", "generic AI gradients", "fabricated claims", "spam language"],
} as const;

/** Temporary production fallback while kairela.com DNS is verified. */
export const FALLBACK_PRODUCTION_URL = "https://job-agent-mu-steel.vercel.app";
