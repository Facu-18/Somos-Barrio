import clsx from "clsx";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning" | "neutral";
  className?: string;
};

const variants = {
  primary: "bg-[var(--primary-soft)] text-[var(--primary-dark)]",
  secondary: "bg-[var(--accent)] text-white",
  success: "bg-green-100 text-green-800",
  danger: "bg-[var(--error-bg)] text-[var(--error)]",
  warning: "bg-yellow-100 text-yellow-800",
  neutral: "bg-[var(--surface-flat)] text-[var(--text-muted)]",
};

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
