"use client";

import React from "react";
import OverlayFooter from "./OverlayFooter";

export const RoomOverlay: React.FC = () => {
  return (
    <div className="relative z-10 pointer-events-none w-full h-full">
      <OverlayFooter />
    </div>
  );
};

export default RoomOverlay;
