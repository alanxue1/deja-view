"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface LoadingProgressProps {
  /**
   * Progress value between 0 and 1 (0 = 0%, 1 = 100%)
   */
  progress?: number;
  /**
   * Minutes remaining (if provided, shows "Ready in X min" instead of percentage)
   */
  minutesRemaining?: number;
  /**
   * Custom bottom text (defaults to "Check back soon!")
   */
  bottomText?: string;
  /**
   * Additional className for the container
   */
  className?: string;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({
  progress = 0,
  minutesRemaining,
  bottomText = "Check back soon!",
  className,
}) => {
  // Clamp progress between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, progress));
  
  // Calculate the stroke-dasharray and stroke-dashoffset for clockwise progress
  // Starting at top (12 o'clock), going clockwise
  // Inner circle: 124px (radius 62px)
  // Padding between circle and ring: 8px
  // Stroke width: 6px (thinner ring)
  // Ring center radius: 62 + 8 + 3 = 73px
  const strokeWidth = 6;
  const padding = 8;
  const innerCircleRadius = 62; // 124px / 2
  const radius = innerCircleRadius + padding + strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  // For clockwise from top: use -rotate-90 to start at top, standard offset
  // Then flip horizontally with scaleX(-1) to reverse direction
  const strokeDashoffset = circumference * (1 - clampedProgress);

  // Determine what text to show
  const displayText = minutesRemaining !== undefined 
    ? `Ready in ${minutesRemaining} min`
    : `${Math.round(clampedProgress * 100)}%`;
  
  const isPercentage = minutesRemaining === undefined;

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      {/* Circular Progress Indicator */}
      <div className="relative w-[150px] h-[150px] flex items-center justify-center overflow-visible">
        {/* Inner Circle (124x124) */}
        <div className="absolute w-[124px] h-[124px] rounded-full bg-[#f5f5f5] flex items-center justify-center">
          <span 
            className={cn(
              "text-[var(--ink)] font-sohne",
              isPercentage 
                ? "text-base font-bold" // kraftig = bold, 16px = text-base
                : "text-base font-normal"
            )}
          >
            {displayText}
          </span>
        </div>

        {/* Outer Progress Ring (150x150) */}
        <svg
          className="absolute inset-0 w-[150px] h-[150px] transform -rotate-90 overflow-visible"
          viewBox="0 0 150 150"
          style={{ overflow: 'visible' }}
        >
          {/* Progress circle (orange ring, clockwise) - no background track */}
          <g transform="scale(-1, 1) translate(-150, 0)">
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300 ease-out"
            />
          </g>
        </svg>
      </div>

      {/* Bottom Text */}
      <p className="mt-6 text-[var(--muted)] text-sm font-sohne font-normal">
        {bottomText}
      </p>
    </div>
  );
};

export default LoadingProgress;
