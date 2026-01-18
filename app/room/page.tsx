"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import SmartScene from "@/components/three/SmartScene";
import RoomOverlay from "@/components/overlay/RoomOverlay";

export default function RoomPage() {
  const searchParams = useSearchParams();
  const modelFromUrl = searchParams.get("model");
  
  const [roomModelPath, setRoomModelPath] = useState(
    modelFromUrl || "/davidsbedroom.glb"
  );

  // Update room model when URL changes
  useEffect(() => {
    if (modelFromUrl) {
      setRoomModelPath(modelFromUrl);
    }
  }, [modelFromUrl]);

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
      <RoomOverlay onRoomSelect={handleRoomSelect} currentRoomPath={roomModelPath} />
    </main>
  );
}
