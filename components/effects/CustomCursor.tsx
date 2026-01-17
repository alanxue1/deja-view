"use client";

import React, { useEffect, useState } from "react";
import { shouldUseMotion, isTouchDevice } from "@/lib/device";
import { cn } from "@/lib/cn";

export const CustomCursor: React.FC = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isTouchDevice() || !shouldUseMotion()) {
      return;
    }

    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      rafId = requestAnimationFrame(() => {
        setPosition({ x: e.clientX, y: e.clientY });
        setIsVisible(true);
      });
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleHoverEnter = () => {
      setIsHovering(true);
    };

    const handleHoverLeave = () => {
      setIsHovering(false);
    };

    // Check for hoverable elements
    const checkHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const hoverable = target.closest("[data-cursor='hover']");
      if (hoverable) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousemove", checkHover);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousemove", checkHover);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  if (isTouchDevice() || !shouldUseMotion()) {
    return null;
  }

  return (
    <>
      {/* Outer ring */}
      <div
        className={cn(
          "fixed top-0 left-0 w-8 h-8 rounded-full border-2 border-[var(--ink)] pointer-events-none z-[9999] mix-blend-difference transition-all duration-300 ease-out",
          isHovering && "scale-150 opacity-50",
          !isVisible && "opacity-0"
        )}
        style={{
          transform: `translate(${position.x - 16}px, ${position.y - 16}px)`,
        }}
      />
      {/* Inner dot */}
      <div
        className={cn(
          "fixed top-0 left-0 w-2 h-2 rounded-full bg-[var(--ink)] pointer-events-none z-[9999] mix-blend-difference transition-all duration-200 ease-out",
          isHovering && "scale-150",
          !isVisible && "opacity-0"
        )}
        style={{
          transform: `translate(${position.x - 4}px, ${position.y - 4}px)`,
        }}
      />
    </>
  );
};

export default CustomCursor;
