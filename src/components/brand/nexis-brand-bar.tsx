import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NexisWordmark } from "@/components/brand/nexis-wordmark";

/** Honic Nexis product identity for portal / supervisor auth and marketing chrome. */
export function NexisBrandBar({
  href = "/portal",
  showThemeToggle = true,
  subtitle,
}: {
  href?: string;
  showThemeToggle?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="border-dash-border bg-dash-canvas/85 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3 lg:px-8">
        <NexisWordmark href={href} size="md" subtitle={subtitle} />
        {showThemeToggle ? <ThemeToggle /> : null}
      </div>
    </div>
  );
}
