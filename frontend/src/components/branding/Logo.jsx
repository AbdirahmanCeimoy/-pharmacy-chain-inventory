// Medicap brand mark.
//   - On DARK surfaces (sidebar, hero CTA): render the mint heartbeat with a
//     white "edicap" wordmark.
//   - On LIGHT surfaces (login, landing nav, footer): same heartbeat, but
//     "edicap" in navy ink. No background pill — the mark sits directly on
//     the page.
//
// Built from SVG so it scales cleanly at any size, carries no PNG padding,
// and inherits current text color for the wordmark.

export function Logo({ size = 32, className = '', tone = 'light', iconOnly = false }) {
  const mint = '#2DD4BF'; // darker mint than #5EEAD4 — readable on white
  const navy = '#0F1E4D';
  const wordColor = tone === 'dark' ? '#FFFFFF' : navy;

  if (iconOnly) {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 56 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Medicap"
      >
        <path
          d="M4 24 L18 24 L22 18 L28 32 L34 4 L40 32 L46 24 L52 24"
          stroke={mint}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Full wordmark — viewBox 240x48, scales to the requested size.
  // Heartbeat starts the mark, then "edicap" continues in the chosen text
  // color. Letter-spacing and weight match the reference.
  const width = Math.round(size * 4.5);
  return (
    <svg
      className={className}
      width={width}
      height={size}
      viewBox="0 0 240 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Medicap"
    >
      <path
        d="M4 30 L22 30 L28 24 L34 36 L42 6 L50 38 L56 30 L72 30"
        stroke={mint}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="76"
        y="37"
        fontFamily="Poppins, system-ui, sans-serif"
        fontSize="30"
        fontWeight="600"
        letterSpacing="-0.6"
        fill={wordColor}
      >
        edicap
      </text>
    </svg>
  );
}
