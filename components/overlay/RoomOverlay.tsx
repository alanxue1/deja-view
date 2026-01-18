"use client";

import React from "react";
import OverlayHeader from "./OverlayHeader";
import OverlayFooter from "./OverlayFooter";

interface RoomOverlayProps {
  onRoomSelect?: (modelPath: string) => void;
  currentRoomPath?: string;
}

export const RoomOverlay: React.FC<RoomOverlayProps> = ({ onRoomSelect, currentRoomPath }) => {
  return (
    <div className="relative z-10 pointer-events-none w-full h-full">
      <OverlayHeader onRoomSelect={onRoomSelect} currentRoomPath={currentRoomPath} />
      <OverlayFooter />
    </div>
  );
};

export default RoomOverlay;
