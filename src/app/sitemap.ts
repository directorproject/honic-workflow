import type { MetadataRoute } from "next";

/** Indexable public Honic Nexis / company pages for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const share = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || "https://share.honiccompany.com").replace(/\/$/, "");
  const app = (process.env.NEXT_PUBLIC_APP_URL || "https://inova.honiccompany.com").replace(/\/$/, "");
  const now = new Date();

  return [
    { url: `${share}/portal`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${share}/portal/packs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${share}/portal/titles`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${share}/portal/jobs`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${share}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${share}/share-portal`, lastModified: now, changeFrequency: "monthly", priority: 0.55 },
    // Keep app host about for internal SEO only — no login/staff paths.
    ...(app && app !== share ? [{ url: `${app}/about`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.3 }] : []),
  ];
}
