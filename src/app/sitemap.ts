import type { MetadataRoute } from "next";
import { getCanonicalOrigin } from "@/lib/brand/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getCanonicalOrigin();
  const lastModified = new Date();

  return [
    { url: origin, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/login`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/signup`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
