import type { Metadata, Viewport } from "next";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { ShareIntroTitles } from "@/components/share/share-intro-titles";
import { ShareSiteFooter } from "@/components/share/share-site-footer";
import { ShareStickyNav } from "@/components/share/share-sticky-nav";

export const metadata: Metadata = {
  title: "Shared project · Honic",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function ShareTokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-dash-canvas dash-grid-bg text-dash-foreground relative min-h-screen">
      <div className="border-dash-border bg-dash-canvas/95 supports-[backdrop-filter]:bg-dash-canvas/85 sticky top-0 z-30 shrink-0 border-b shadow-sm backdrop-blur-md">
        <CompanyBrandBar variant="full" endContent={<ShareIntroTitles variant="header" />} />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-6 pt-4 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8 lg:pt-10">
        <div className="mb-6 sm:hidden">
          <ShareIntroTitles variant="content" />
        </div>
        {children}
      </div>

      <ShareSiteFooter />

      <ShareStickyNav />
    </div>
  );
}
