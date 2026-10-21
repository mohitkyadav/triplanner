/* One line icon per kind of plan, drawn for the app in the style of its
   other icons (24×24, 2px round strokes) and coloured by the category's
   tint through currentColor. The emoji stay in lib/categories.js for plain
   text (calendar exports). */

export const CATEGORY_PATHS = {
  flight: (
    <path
      transform="rotate(45 12 12)"
      d="M12 2.5c.9 0 1.6 1 1.6 2.2V9.4l7.4 4.3v2.1l-7.4-2.2v4.5l2.1 1.6v1.8l-3.7-1-3.7 1v-1.8l2.1-1.6v-4.5L3 15.8v-2.1l7.4-4.3V4.7c0-1.2.7-2.2 1.6-2.2z"
    />
  ),
  train: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 10h14M9 6.5h6" />
      <path d="M8.5 13.5h.01M15.5 13.5h.01" strokeWidth="2.6" />
      <path d="m8 17-2 4M16 17l2 4M7 19.5h10" />
    </>
  ),
  bus: (
    <>
      <path d="M6 3h12a2 2 0 0 1 2 2v12H4V5a2 2 0 0 1 2-2z" />
      <path d="M4 11h16M2 7v3M22 7v3" />
      <path d="M7.5 14h.01M16.5 14h.01" strokeWidth="2.6" />
      <path d="M6.5 17v3M17.5 17v3" />
    </>
  ),
  hotel: (
    <>
      <path d="M3 5v15M3 14h18v6M21 14v-1.5A3.5 3.5 0 0 0 17.5 9H11v5" />
      <circle cx="7" cy="11" r="2" />
    </>
  ),
  restaurant: (
    <>
      <path d="M5 3v5a2.5 2.5 0 0 0 5 0V3M7.5 3v18" />
      <path d="M18 21V3c-2.2 1.3-3.5 4-3.5 7.5V14H18" />
    </>
  ),
  cafe: (
    <>
      <path d="M4 9h13v4.5A5.5 5.5 0 0 1 11.5 19h-2A5.5 5.5 0 0 1 4 13.5V9z" />
      <path d="M17 10.5h1a2.5 2.5 0 0 1 0 5h-1.3" />
      <path d="M8 3.5c-.7.8.7 1.7 0 2.6M12.5 3.5c-.7.8.7 1.7 0 2.6" />
      <path d="M3 21.5h15" />
    </>
  ),
  bar: (
    <>
      <path d="M4 4h16l-8 9.5L4 4z" />
      <path d="M12 13.5V20M8 20.5h8M7 7.5h10" />
      <path d="m16.5 2-2.5 6" />
    </>
  ),
  museum: (
    <>
      <path d="M3 9.5 12 4l9 5.5H3z" />
      <path d="M6 12.5v5M10 12.5v5M14 12.5v5M18 12.5v5" />
      <path d="M4 20.5h16" />
    </>
  ),
  landmark: (
    <>
      <path d="M12 2v3M12 5c-.7 6-2.3 11-5 16M12 5c.7 6 2.3 11 5 16" />
      <path d="M9.7 10.5h4.6M8.2 15.5h7.6M5 21h14" />
    </>
  ),
  park: (
    <>
      <path d="M12 3a4.5 4.5 0 0 0-4.4 5.5A4 4 0 0 0 8 16.5h8a4 4 0 0 0 .4-8A4.5 4.5 0 0 0 12 3z" />
      <path d="M12 16.5V21M8.5 21h7M12 16.5v-3l2-2" />
    </>
  ),
  beach: (
    <>
      <path d="M3.5 12a8.5 8.5 0 0 1 17 0H3.5z" />
      <path d="M12 3.5V12M12 12l1.6 6" />
      <path d="M2 20.5c1.7 0 1.7-1.3 3.3-1.3s1.7 1.3 3.4 1.3 1.6-1.3 3.3-1.3 1.7 1.3 3.3 1.3 1.7-1.3 3.4-1.3 1.6 1.3 3.3 1.3" />
    </>
  ),
  shopping: (
    <>
      <path d="M5.5 8h13l-.9 11.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5.5 8z" />
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
    </>
  ),
  activity: (
    <>
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5z" />
      <path d="M14.5 5v2M14.5 10.5v2M14.5 16v2" />
      <path d="m8.5 9.5.8 1.6 1.7.3-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7L6 11.4l1.7-.3.8-1.6z" />
    </>
  ),
  work: (
    <>
      <rect x="3" y="7.5" width="18" height="13" rx="2" />
      <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3 13h18M11 13v1.5h2V13" />
    </>
  ),
  other: <path d="m12 3 2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.5l-5.3 2.9 1.1-6-4.4-4.1 6-.8L12 3z" />,
}

// "transport" plans from an older version draw as a train.
const ALIASES = { transport: 'train' }

export default function CategoryIcon({ type, className = 'size-5' }) {
  const paths = CATEGORY_PATHS[ALIASES[type] ?? type] ?? CATEGORY_PATHS.other
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  )
}
