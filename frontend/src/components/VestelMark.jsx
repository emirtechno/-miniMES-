/**
 * Vestel markası — kalın geometrik "V".
 * Lucide uyumlu: `size` ve `className` alır (currentColor kullanır).
 */
export default function VestelMark({ size = 24, className, title = 'Vestel', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
      {...props}
    >
      <path
        fill="currentColor"
        d="M4.1 3.25h5.05L12 12.55l2.85-9.3H19.9L13.55 20.75h-3.1L4.1 3.25Z"
      />
    </svg>
  );
}
