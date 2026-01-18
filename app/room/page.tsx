"use client";

import React from "react";
import SmartScene from "@/components/three/SmartScene";
import RoomOverlay from "@/components/overlay/RoomOverlay";

export default function RoomPage() {
  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Full-screen 3D Canvas */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <SmartScene className="w-full h-full" />
      </div>

      {/* Floating UI Overlay */}
      <RoomOverlay />
    </main>
  );
}
