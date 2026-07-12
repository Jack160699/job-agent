import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { getCanonicalOrigin } from "@/lib/brand/urls";

export default function manifest(): MetadataRoute.Manifest {
  const origin = getCanonicalOrigin();

  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.promise,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#0d7c66",
    icons: [
      {
        src: "/icons/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/apple-touch-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
    id: origin,
  };
}
