import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { LoginForm } from "@/components/auth/login-form";
import {
  AUTH_OPERATOR_EMAIL_DOMAIN,
  AUTH_OPERATOR_USERNAME,
  defaultOperatorEmail,
} from "@/lib/auth-credentials";
import { internalAppHostname } from "@/lib/auth-internal-host";

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
          <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
            Internal workflow on{" "}
            <span className="text-dash-foreground font-medium">{internalAppHostname() ?? "this host"}</span> only.
            Client share links stay public without login.
          </p>
          <div className="mt-6">
            <LoginForm nextPath={nextPath} />
          </div>
          <p className="text-dash-muted-foreground mt-6 text-xs leading-relaxed">
            First deploy: create the operator in Supabase (Auth → Users) or run{" "}
            <code className="text-dash-foreground">npm run auth:ensure-operator</code> with{" "}
            <code className="text-dash-foreground">SUPABASE_SERVICE_ROLE_KEY</code> set. Email domain:{" "}
            <code className="text-dash-foreground">{AUTH_OPERATOR_EMAIL_DOMAIN}</code>.
          </p>
        </div>
      </div>
    </main>
  );
}
