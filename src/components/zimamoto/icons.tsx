import type { ReactNode, SVGProps } from "react";

// Small inline icon set (stroke style, 24px grid) so Zimamoto needs no extra package.

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </Icon>
);
export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
  </Icon>
);
export const IconCompass = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);
export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
);
export const IconGlobe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" />
  </Icon>
);
export const IconSend = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 3 10 14" />
    <path d="M21 3 14.5 21l-4.5-7-7-4.5L21 3Z" />
  </Icon>
);
export const IconClip = (p: IconProps) => (
  <Icon {...p}>
    <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" />
  </Icon>
);
export const IconFile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </Icon>
);
export const IconChat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16v11H9l-5 4V5Z" />
  </Icon>
);
export const IconFolder = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2.5h7.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12Z" />
  </Icon>
);
export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3h6l-1 6 3 3v1H7v-1l3-3-1-6Z" />
    <path d="M12 13v8" />
  </Icon>
);
export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </Icon>
);
export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M4 20h16" />
  </Icon>
);
export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
  </Icon>
);
export const IconUserPlus = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3 20c.6-3.4 3.2-5.5 7-5.5" />
    <path d="M19 8v6M16 11h6" />
  </Icon>
);
export const IconBack = (p: IconProps) => (
  <Icon {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);
export const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m21 16-5-5-8 8" />
  </Icon>
);
export const IconSlides = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
);
export const IconTable = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9 4v16" />
  </Icon>
);
export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </Icon>
);
export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
export const IconWallet = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12.5v4" />
    <rect x="3.5" y="9" width="17" height="11" rx="2.5" />
    <circle cx="16.5" cy="14.5" r="1" />
  </Icon>
);
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const IconInbox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 13.5 6 5h12l3 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-5.5Z" />
    <path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" />
  </Icon>
);
export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Icon>
);
export const IconTag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9-9-9Z" />
    <circle cx="8" cy="8" r="1.5" />
  </Icon>
);
export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);
