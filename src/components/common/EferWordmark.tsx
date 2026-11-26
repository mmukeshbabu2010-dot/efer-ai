interface EferWordmarkProps {
  showIcon?: boolean;
  size?: 'md' | 'lg';
}

export function EferWordmark({ showIcon = true, size = 'md' }: EferWordmarkProps) {
  const textSizeClass = size === 'lg' ? 'text-[20px]' : 'text-[18px]';

  return (
    <span className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      {showIcon && (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <defs>
            <linearGradient id="efer-mark-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--efer-accent)" />
              <stop offset="100%" stopColor="var(--efer-accent-hover)" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#efer-mark-grad)" />
          <path
            d="M7.5 8H16.5M7.5 12H14.5M7.5 16H16.5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span
        className={`${textSizeClass} font-bold tracking-[-0.02em] leading-none text-text-primary dark:text-white`}
      >
        EFER
      </span>
    </span>
  );
}
