import type { MetadataRoute } from "next";
import { getCanonicalOrigin } from "@/lib/brand/urls";

export default function robots(): MetadataRoute.Robots {
  const origin = getCanonicalOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
