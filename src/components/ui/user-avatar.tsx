/** Auto initials avatar — stable colour from the name, no photo upload needed. */

const GRADIENTS = [
  "from-cyan-500 to-sky-600",
  "from-teal-500 to-emerald-600",
  "from-sky-500 to-blue-600",
  "from-purple-500 to-indigo-600",
  "from-rose-500 to-red-600",
  "from-indigo-500 to-blue-700",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-pink-600",
] as const;

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) {
    const one = parts[0];
    return (one.length >= 2 ? one.slice(0, 2) : one.slice(0, 1)).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function UserAvatar({
  name,
  size = 32,
  className = "",
  title,
}: {
  name: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const label = name.trim() || "User";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ring-2 ring-white/20 dark:ring-black/20 ${gradientFor(label)} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
      title={title ?? label}
      aria-hidden
    >
      {initialsFrom(label)}
    </span>
  );
}
