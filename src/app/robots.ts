import type { MetadataRoute } from "next";

import { getPublicAppUrlFromEnv } from "@/lib/site-url";

/** Public crawl rules — portal marketing pages indexable; private app paths blocked. */
export default function robots(): MetadataRoute.Robots {
  const share = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || "").replace(/\/$/, "");
  const app = (getPublicAppUrlFromEnv() || "").replace(/\/$/, "");
  const host = share || app || "https://share.honiccompany.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/portal", "/portal/packs", "/portal/titles", "/portal/jobs", "/about", "/share-portal"],
        disallow: [
          "/portal/home",
          "/portal/print",
          "/api/",
          "/login",
          "/students",
          "/projects",
          "/users",
          "/drive",
          "/supervisor",
          "/share/",
        ],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  };
}
