type Size = "sm" | "md" | "lg";

/**
 * inline - fills its parent's width/height and centres inside it (parent needs a height).
 * cover  - absolutely covers the nearest `relative` parent and centres in it (x and y).
 * page   - fixed to the viewport, centred on screen (x and y), with a glass backdrop.
 */
type Mode = "inline" | "cover" | "page";

const BALL_SIZE: Record<Size, string> = {
  sm: "h-7 w-7",
  md: "h-11 w-11",
  lg: "h-16 w-16",
};

const SHADOW_SIZE: Record<Size, string> = {
  sm: "h-1 w-5",
  md: "h-1.5 w-8",
  lg: "h-2 w-12",
};

const TEXT_SIZE: Record<Size, string> = {
  sm: "gap-2 text-xs",
  md: "gap-3 text-sm",
  lg: "gap-4 text-base",
};

const MODE_CLASS: Record<Mode, string> = {
  inline: "h-full min-h-28 w-full",
  cover: "absolute inset-0 z-20 rounded-[inherit] bg-glass backdrop-blur-sm",
  page: "fixed inset-0 z-50 bg-glass-strong backdrop-blur-md",
};

export function LoadingSpinner({
  label = "Loading",
  size = "md",
  mode = "inline",
  className = "",
}: {
  label?: string;
  size?: Size;
  mode?: Mode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid place-items-center text-muted ${MODE_CLASS[mode]} ${className}`}
    >
      <div className={`flex flex-col items-center ${TEXT_SIZE[size]}`}>
        <div className="flex flex-col items-center">
          {/* Bouncing ball */}
          <div className="animate-bounce motion-reduce:animate-none">
            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              className={`${BALL_SIZE[size]} animate-spin [animation-duration:1.8s] motion-reduce:animate-none`}
            >
              <circle cx="24" cy="24" r="21" className="fill-surface stroke-fg" strokeWidth="2" />
              <g className="stroke-fg" strokeWidth="1.5" strokeLinecap="round">
                <line x1="24" y1="17" x2="24" y2="9" />
                <line x1="30.66" y1="21.84" x2="38.27" y2="19.36" />
                <line x1="28.11" y1="29.66" x2="32.82" y2="36.14" />
                <line x1="19.89" y1="29.66" x2="15.18" y2="36.14" />
                <line x1="17.34" y1="21.84" x2="9.73" y2="19.36" />
              </g>
              <polygon
                points="24,17 30.66,21.84 28.11,29.66 19.89,29.66 17.34,21.84"
                className="fill-accent stroke-fg"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <g className="fill-fg">
                <circle cx="33.7" cy="10.65" r="2.4" />
                <circle cx="39.69" cy="29.1" r="2.4" />
                <circle cx="24" cy="40.5" r="2.4" />
                <circle cx="8.31" cy="29.1" r="2.4" />
                <circle cx="14.3" cy="10.65" r="2.4" />
              </g>
            </svg>
          </div>

          {/* Ground shadow */}
          <div
            aria-hidden="true"
            className={`mt-1 animate-pulse rounded-full bg-fg/20 blur-[2px] motion-reduce:animate-none ${SHADOW_SIZE[size]}`}
          />
        </div>

        {label ? <span className="font-semibold tracking-wide">{label}</span> : <span className="sr-only">Loading</span>}
      </div>
    </div>
  );
}