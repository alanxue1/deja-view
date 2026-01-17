import React from "react";
import { cn } from "@/lib/cn";

interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
}

export const Divider: React.FC<DividerProps> = ({
  className,
  orientation = "horizontal",
  ...props
}) => {
  if (orientation === "vertical") {
    return (
      <div
        className={cn("w-px h-full bg-[var(--border)]", className)}
        {...props}
      />
    );
  }

  return (
    <hr
      className={cn("border-0 h-px bg-[var(--border)]", className)}
      {...props}
    />
  );
};

export default Divider;
