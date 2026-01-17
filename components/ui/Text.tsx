import React from "react";
import { cn } from "@/lib/cn";

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  variant?: "body" | "muted" | "small" | "large";
  children: React.ReactNode;
}

const variantStyles = {
  body: "text-base",
  muted: "text-base text-[var(--muted)]",
  small: "text-sm text-[var(--muted)]",
  large: "text-lg",
};

export const Text: React.FC<TextProps> = ({
  as: Component = "p",
  variant = "body",
  className,
  children,
  ...props
}) => {
  return (
    <Component
      className={cn(variantStyles[variant], className)}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Text;
