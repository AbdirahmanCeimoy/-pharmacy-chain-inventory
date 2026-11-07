// PharmaTrack brand mark. P&T interlocked monogram on a rounded square in brand blue.
// `size` controls the pixel box; wordmark optional for header/login contexts.

export function Logo({ size = 32, className = '', withWordmark = false, wordmarkClassName = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        role="img"
        aria-label="PharmaTrack"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="48" rx="10" fill="#3952A4" />
        {/* P */}
        <path
          d="M12 11 h12 a7 7 0 0 1 0 14 h-8 M16 11 v26"
          stroke="white"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* T interlocked, crossing the P's bowl at the right */}
        <path
          d="M23 21 h14 M30 21 v16"
          stroke="white"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Subtle dot top-right — nods to a pill */}
        <circle cx="39" cy="12" r="2.2" fill="white" opacity="0.85" />
      </svg>
      {withWordmark && (
        <span
          className={wordmarkClassName || 'text-base font-semibold tracking-tight text-ink-primary'}
        >
          PharmaTrack
        </span>
      )}
    </span>
  );
}
