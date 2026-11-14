import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { getPublicAppUrlFromEnv } from "@/lib/site-url";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function metadataBaseFromEnv(): URL | undefined {
  const u = getPublicAppUrlFromEnv();
  if (!u) return undefined;
  try {
    return new URL(u.endsWith("/") ? u : `${u}/`);
  } catch {
    return undefined;
  }
}

const metadataBase = metadataBaseFromEnv();

export const metadata: Metadata = {
  title: "Honic · Project workflow",
  description: "Workflow checklist and project pipeline per registered client.",
  ...(metadataBase ? { metadataBase } : {}),
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Extensions often inject attributes on <body>; suppressHydrationWarning avoids noisy mismatches. */}
      <body suppressHydrationWarning className="bg-background text-foreground flex min-h-full min-w-0 flex-col overflow-x-hidden">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
