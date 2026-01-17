"use client";

import React, { useEffect } from "react";
import { shouldUseMotion, isTouchDevice } from "@/lib/device";

interface SmoothScrollProps {
  children: React.ReactNode;
}

export const SmoothScroll: React.FC<SmoothScrollProps> = ({ children }) => {
  useEffect(() => {
    if (isTouchDevice() || !shouldUseMotion()) {
      return;
    }

    let targetScroll = window.scrollY;
    let currentScroll = window.scrollY;
    let rafId: number | null = null;
    let isScrolling = false;

    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const updateScroll = () => {
      if (Math.abs(currentScroll - targetScroll) < 0.5) {
        currentScroll = targetScroll;
        window.scrollTo(0, currentScroll);
        isScrolling = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        return;
      }

      const diff = targetScroll - currentScroll;
      currentScroll += diff * 0.1;
      window.scrollTo(0, currentScroll);

      rafId = requestAnimationFrame(updateScroll);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetScroll += e.deltaY;
      targetScroll = Math.max(0, Math.min(targetScroll, document.documentElement.scrollHeight - window.innerHeight));

      if (!isScrolling) {
        isScrolling = true;
        rafId = requestAnimationFrame(updateScroll);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return <>{children}</>;
};

export default SmoothScroll;
