"use client";

import React, { useEffect, useState } from "react";
import { MoveHorizontal } from "lucide-react";

type RoomOverlayHintEventDetail = { text: string };
const ROOM_OVERLAY_HINT_EVENT = "room-overlay-hint";

export const OverlayFooter: React.FC = () => {
  const [hintText, setHintText] = useState<string>(() => {
    if (typeof window === "undefined") return "Drag to Explore";
    return (window as any).__roomOverlayHint || "Drag to Explore";
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<RoomOverlayHintEventDetail>).detail;
      const text = detail?.text;
      if (typeof text !== "string" || text.length === 0) return;
      setHintText(text);
      (window as any).__roomOverlayHint = text;
    };

    window.addEventListener(ROOM_OVERLAY_HINT_EVENT, handler);
    return () => window.removeEventListener(ROOM_OVERLAY_HINT_EVENT, handler);
  }, []);

  return (
    <footer className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none flex justify-center items-center pb-8">
      <div className="pointer-events-auto bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 flex items-center gap-2">
        <MoveHorizontal size={14} className="text-white" />
        <span
          id="room-overlay-hint"
          className="text-sm text-white uppercase tracking-wide"
        >
          {hintText}
        </span>
      </div>
    </footer>
  );
};

export default OverlayFooter;
