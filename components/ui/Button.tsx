import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "soft" | "ghost";
  asChild?: boolean;
  href?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "soft", asChild = false, href, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-pill px-6 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-[var(--accent)] text-white hover:opacity-90 focus:ring-[var(--accent)]",
      soft: "bg-[#f5f5f5] text-[var(--ink)] hover:bg-[#eeeeee] focus:ring-[var(--ink)] shadow-sm border-0",
      ghost: "bg-transparent text-[var(--ink)] hover:bg-[var(--bg)] focus:ring-[var(--ink)]",
    };

    const classes = cn(baseStyles, variants[variant], className);

    if (asChild && href) {
      return (
        <Link
          href={href}
          className={classes}
          data-cursor="hover"
          {...(props as any)}
        >
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        data-cursor="hover"
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
