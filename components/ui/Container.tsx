import React from "react";
import { cn } from "@/lib/cn";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "6xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "6xl": "max-w-6xl",
  full: "max-w-full",
};

export const Container: React.FC<ContainerProps> = ({
  className,
  children,
  maxWidth = "6xl",
  ...props
}) => {
  return (
    <div
      className={cn("mx-auto px-10", maxWidthClasses[maxWidth], className)}
      {...props}
    >
      {children}
    </div>
  );
};

export default Container;
