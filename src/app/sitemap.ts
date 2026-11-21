import type { MetadataRoute } from "next";

/** Indexable public Honic Nexis / company pages for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const share = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || "https://share.honiccompany.com").replace(/\/$/, "");
  const now = new Date();

  // Student share host only — never list the staff (Inova) host.
  return [
    { url: `${share}/portal`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${share}/portal/packs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${share}/portal/titles`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${share}/portal/jobs`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${share}/portal/zimamoto`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${share}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${share}/share-portal`, lastModified: now, changeFrequency: "monthly", priority: 0.55 },
  ];
}
