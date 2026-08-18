'use client';

// Tehuti loading spinner — an hourglass that flips like a sand timer.
// size: pixel size of the icon. label: optional text shown beside/below it.
export default function Spinner({
  size = 40,
  label,
  block = false,
}: {
  size?: number;
  label?: string;
  block?: boolean;
}) {
  const icon = (
    <svg
      className="tehuti-hourglass"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );

  if (block) {
    return (
      <div className="spinner-block" role="status" aria-live="polite">
        {icon}
        {label && <span className="spinner-label">{label}</span>}
      </div>
    );
  }

  return (
    <span className="spinner-inline" role="status" aria-live="polite">
      {icon}
      {label && <span className="spinner-label">{label}</span>}
    </span>
  );
}
