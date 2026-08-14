import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/auth`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/simulador`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
