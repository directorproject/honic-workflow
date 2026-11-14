import Link from "next/link";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { PasswordResetForm } from "@/components/portal/password-reset-form";
import { SiteFooter } from "@/components/portal/site-footer";
import { getPortalUser } from "@/lib/portal/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set a new password · Honic Company Limited",
};

export default async function PortalResetPage() {
  const user = await getPortalUser();
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        {user ? (
          <PasswordResetForm />
        ) : (
          <p className="border-dash-border bg-dash-card rounded-2xl border p-5 text-sm">
            This reset link is invalid or has expired.{" "}
            <Link href="/portal" className="text-dash-accent font-semibold">
              Request a new one
            </Link>
            .
          </p>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
