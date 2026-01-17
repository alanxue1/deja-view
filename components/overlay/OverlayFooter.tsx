"use client";

import React from "react";
import { MoveHorizontal } from "lucide-react";

export const OverlayFooter: React.FC = () => {
  return (
    <footer className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none flex justify-center items-center pb-8">
      <div className="pointer-events-auto bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 flex items-center gap-2">
        <MoveHorizontal size={14} className="text-white" />
        <span className="text-sm text-white uppercase tracking-wide">
          Drag to Explore
        </span>
      </div>
    </footer>
  );
};

export default OverlayFooter;
