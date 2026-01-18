"use client";

import React from "react";
import OverlayHeader from "./OverlayHeader";
import OverlayFooter from "./OverlayFooter";

interface RoomOverlayProps {
  onRoomSelect?: (modelPath: string) => void;
}

export const RoomOverlay: React.FC<RoomOverlayProps> = ({ onRoomSelect }) => {
  return (
    <div className="relative z-10 pointer-events-none w-full h-full">
      <OverlayHeader onRoomSelect={onRoomSelect} />
      <OverlayFooter />
    </div>
  );
};

export default RoomOverlay;
