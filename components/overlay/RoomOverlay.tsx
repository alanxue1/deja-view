"use client";

import React from "react";
import OverlayHeader from "./OverlayHeader";
import OverlayFooter from "./OverlayFooter";

export const RoomOverlay: React.FC = () => {
  return (
    <div className="relative z-10 pointer-events-none w-full h-full">
      <OverlayHeader />
      <OverlayFooter />
    </div>
  );
};

export default RoomOverlay;
