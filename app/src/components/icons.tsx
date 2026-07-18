import { SVGProps } from "react";

/**
 * One consistent icon set for the whole app: 1.75px stroke, 20x20 viewBox,
 * currentColor — never mix stroke widths or add emoji as structural icons.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function RosterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9H21" />
      <path d="M8 13H16M8 17H13" />
    </Icon>
  );
}

export function SignOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 21H5C4.4 21 4 20.6 4 20V4C4 3.4 4.4 3 5 3H9" />
      <path d="M16 17L21 12L16 7" />
      <path d="M21 12H9" />
    </Icon>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 5V19M5 12H19" />
    </Icon>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3V15M12 15L7 10M12 15L17 10" />
      <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" />
    </Icon>
  );
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 15V3M12 3L7 8M12 3L17 8" />
      <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="M11 18L5 12L11 6" />
    </Icon>
  );
}

export function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 3H14L19 8V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V5C5 3.9 5.9 3 7 3Z" />
      <path d="M14 3V8H19" />
    </Icon>
  );
}

export function ShieldCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 2L4 5V11C4 16.5 7.4 20.7 12 22C16.6 20.7 20 16.5 20 11V5L12 2Z" />
      <path d="M9 12L11 14L15.5 9.5" />
    </Icon>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7L12 13L21 7" />
    </Icon>
  );
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20C3.5 16.5 6 14 9 14C12 14 14.5 16.5 14.5 20" />
      <path d="M16 8.5C17.1 8.5 18 7.6 18 6.5C18 5.4 17.1 4.5 16 4.5" />
      <path d="M15 14.2C17.5 14.7 19.5 16.9 19.5 20" />
    </Icon>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 12L9.5 17.5L20 6" />
    </Icon>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 6L18 18M18 6L6 18" />
    </Icon>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15A1.65 1.65 0 0 0 20.5 13.4L19.9 12L20.5 10.6A1.65 1.65 0 0 0 19.4 9L17.7 8.6A1.65 1.65 0 0 1 16.6 7.5L16.2 5.8A1.65 1.65 0 0 0 14.6 4.7L13 5A1.65 1.65 0 0 1 11 5L9.4 4.7A1.65 1.65 0 0 0 7.8 5.8L7.4 7.5A1.65 1.65 0 0 1 6.3 8.6L4.6 9A1.65 1.65 0 0 0 3.5 10.6L4.1 12L3.5 13.4A1.65 1.65 0 0 0 4.6 15L6.3 15.4A1.65 1.65 0 0 1 7.4 16.5L7.8 18.2A1.65 1.65 0 0 0 9.4 19.3L11 19A1.65 1.65 0 0 1 13 19L14.6 19.3A1.65 1.65 0 0 0 16.2 18.2L16.6 16.5A1.65 1.65 0 0 1 17.7 15.4L19.4 15Z" />
    </Icon>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7V12L15.5 14.5" />
    </Icon>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 7H20" />
      <path d="M9 7V4.5C9 3.7 9.7 3 10.5 3H13.5C14.3 3 15 3.7 15 4.5V7" />
      <path d="M6 7L7 19.5C7.05 20.35 7.75 21 8.6 21H15.4C16.25 21 16.95 20.35 17 19.5L18 7" />
    </Icon>
  );
}

