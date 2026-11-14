import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { LoginForm } from "@/components/auth/login-form";
import { SiteFooter } from "@/components/portal/site-footer";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: { searchParams?: Promise<{ next?: string }> }) {
  const sp = props.searchParams ? await props.searchParams : {};
  const nextRaw = typeof sp.next === "string" ? sp.next.trim() : "";
  const nextPath = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="border-dash-border bg-dash-card w-full max-w-md rounded-2xl border p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <div className="mt-6">
            <LoginForm nextPath={nextPath} />
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
