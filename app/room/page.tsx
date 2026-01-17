"use client";

import React from "react";
import RoomPreview from "@/components/three/RoomPreview";
import RoomOverlay from "@/components/overlay/RoomOverlay";

export default function RoomPage() {
  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Full-screen 3D Canvas */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <RoomPreview className="w-full h-full" />
      </div>

      {/* Floating UI Overlay */}
      <RoomOverlay />
    </main>
  );
}
