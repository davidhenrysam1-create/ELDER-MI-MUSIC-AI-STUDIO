import type { SVGProps } from "react";

const paths: Record<string, string> = {
  dashboard: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 10v1a7 7 0 0 0 14 0v-1M12 18v3M8 21h8",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M13 4v4M7 10v4M15 16v4",
  disc: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  voice: "M12 3a4 4 0 0 0-4 4v4a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Zm-7 8a7 7 0 0 0 14 0M12 17v4M9 21h6",
  download: "M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.2-1.3L15 3H9l-.4 2.5a8 8 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.2 1.3L9 21h6l.4-2.5a8 8 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  pause: "M9 5h2.5v14H9zM14 5h2.5v14H14z",
  stop: "M6 6h12v12H6z",
  upload: "M12 21V9m0 0 4.5 4.5M12 9 7.5 13.5M4 6V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1",
  sparkles:
    "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Zm6 10 1 2.4 2.5 1-2.5 1L18 20l-1-2.6-2.5-1 2.5-1 1-2.4ZM5.5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z",
  check: "m4.5 12.5 5 5 10-11",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6M14 11v6",
  copy: "M8 8V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3M4 9h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z",
  undo: "M4 9h9a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4",
  chevron: "m9 6 6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  save: "M5 4h11l3 3v13H5V4Zm3 0v6h8V4M8 15h8v5H8v-5Z",
  alert: "M12 4 3 20h18L12 4Zm0 5v6m0 3v.5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v.5M12 11v6",
  music: "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  arrowRight: "M4 12h16m0 0-6-6m6 6-6 6",
  refresh: "M20 11A8 8 0 0 0 6.3 6.3L4 8.5M4 11V5m0 6h6M4 13a8 8 0 0 0 13.7 4.7L20 15.5M20 13v6h-6",
  star: "m12 3 2.7 6 6.3.6-4.7 4.2 1.4 6.2L12 16.6 6.3 20l1.4-6.2L3 9.6 9.3 9 12 3Z",
  lock: "M6 11h12v10H6V11Zm3 0V7a3 3 0 0 1 6 0v4",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2",
  waveform: "M3 12h2l2-6 3 12 3-9 2 5 2-3h4",
  grid: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  headphones: "M4 15v-3a8 8 0 0 1 16 0v3M4 15h2.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4Zm16 0h-2.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-4Z",
  repeat: "M4 9V7a3 3 0 0 1 3-3h10l-3-3m3 14v2a3 3 0 0 1-3 3H4l3 3",
  download2: "M12 4v10m0 0 4-4m-4 4-4-4M5 18h14",
  scissors: "M6 6l12 12M6 18 18 6M4 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  bolt: "m13 2-9 12h6l-1 8 9-12h-6l1-8Z",
  library: "M4 5h4v14H4V5Zm6 0h4v14h-4V5Zm6 2 3.5-1 3 13-3.5 1-3-13Z",
  file: "M6 2h8l4 4v16H6V2Zm8 0v5h5",
  eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7 17a7 7 0 0 1 14 0",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  volume: "M4 10v4h3l4 4V6L7 10H4Zm11-3a5 5 0 0 1 0 10M17.5 4.5a8 8 0 0 1 0 15",
  volumeMute: "M4 10v4h3l4 4V6L7 10H4Zm11 1 5 5m0-5-5 5",
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 18,
  filled = false,
  ...props
}: { name: IconName; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
