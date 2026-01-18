"use client";

import React, { useState } from "react";
import SmartScene from "@/components/three/SmartScene";
import RoomOverlay from "@/components/overlay/RoomOverlay";

export default function RoomPage() {
  const [roomModelPath, setRoomModelPath] = useState("/Perfect-empty-room - manual lidar.glb");

  const handleRoomSelect = (modelPath: string) => {
    setRoomModelPath(modelPath);
  };

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Full-screen 3D Canvas */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <SmartScene className="w-full h-full" roomModelPath={roomModelPath} />
      </div>

      {/* Floating UI Overlay */}
      <RoomOverlay onRoomSelect={handleRoomSelect} />
    </main>
  );
}
