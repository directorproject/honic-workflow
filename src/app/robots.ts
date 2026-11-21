import type { MetadataRoute } from "next";

/** Public crawl rules — student share host only; never advertise the staff (Inova) host. */
export default function robots(): MetadataRoute.Robots {
  const host = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || "https://share.honiccompany.com").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/portal", "/portal/packs", "/portal/titles", "/portal/jobs", "/portal/zimamoto", "/about", "/share-portal"],
        disallow: [
          "/portal/home",
          "/portal/print",
          "/api/",
          "/login",
          "/students",
          "/projects",
          "/users",
          "/drive",
          "/finance",
          "/analytics",
          "/clients",
          "/plans",
          "/poster",
          "/client-side",
          "/titles",
          "/supervisor",
          "/share/",
        ],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  };
}
