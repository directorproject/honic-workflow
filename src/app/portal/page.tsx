import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { TitlePortalSample } from "@/components/portal/title-portal-sample";

export const metadata = {
  title: "Project title selection · Honic Company Limited",
};

export default function TitlePortalPage() {
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <TitlePortalSample />
    </main>
  );
}
