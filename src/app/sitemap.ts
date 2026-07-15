import type { MetadataRoute } from "next";
import { getCanonicalOrigin } from "@/lib/brand/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getCanonicalOrigin();
  const lastModified = new Date();

  return [
    { url: origin, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/login`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/signup`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/cookies`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/ai-disclosure`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/data-deletion`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
