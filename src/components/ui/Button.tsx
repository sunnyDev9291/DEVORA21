import Link from "next/link";
import { brand } from "@/lib/ui-styles";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  external?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: `${brand.gradientButton}`,
  secondary:
    "bg-stone-900 hover:bg-stone-800 text-white shadow-lg shadow-stone-900/20 dark:bg-orange-500/90 dark:text-white dark:hover:bg-orange-400 dark:shadow-orange-500/20",
  outline:
    "border border-orange-200 bg-white/90 text-stone-700 shadow-sm hover:border-orange-300 hover:bg-orange-50/80 hover:text-orange-800 dark:border-orange-500/20 dark:bg-white/[0.05] dark:text-stone-100 dark:hover:border-orange-400/40 dark:hover:bg-orange-500/10",
  ghost:
    "text-stone-600 hover:text-orange-700 hover:bg-orange-50/80 dark:text-stone-400 dark:hover:text-orange-300 dark:hover:bg-orange-500/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-4 py-2 text-sm rounded-xl",
  md: "px-6 py-3 text-[17px] rounded-xl",
  lg: "px-8 py-4 text-base rounded-xl",
};

export default function Button({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  external = false,
  type = "button",
  disabled = false,
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-all duration-200 hover:-translate-y-px ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""} ${className}`;

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
