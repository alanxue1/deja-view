"use client";

import React from "react";
import { cn } from "@/lib/cn";
import Text from "@/components/ui/Text";

export const FooterHints: React.FC = () => {
  return (
    <div className="w-full pt-4 pb-2">
      <div className="grid grid-cols-2 gap-8">
        {/* Scroll to Discover */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
          <Text variant="muted" className="text-sm font-normal">
            Scroll to Discover
          </Text>
        </div>

        {/* Drag to Explore */}
        <div className="flex items-center gap-2 justify-end">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
          <Text variant="muted" className="text-sm font-normal">
            Drag to Explore
          </Text>
        </div>
      </div>
    </div>
  );
};

export default FooterHints;
