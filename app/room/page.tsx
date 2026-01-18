"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SmartScene, { type DatabaseItemData } from "@/components/three/SmartScene";
import RoomOverlay from "@/components/overlay/RoomOverlay";
import ItemDetailModal, { type DatabaseItem } from "@/components/overlay/ItemDetailModal";

function RoomContent() {
  const searchParams = useSearchParams();
  const modelFromUrl = searchParams?.get("model") ?? null;
  
  const [roomModelPath, setRoomModelPath] = useState(
    modelFromUrl || "/davidsbedroom.glb"
  );
  
  // Modal state for item detail popup
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DatabaseItem | null>(null);

  // Update room model when URL changes
  useEffect(() => {
    if (modelFromUrl) {
      setRoomModelPath(modelFromUrl);
    }
  }, [modelFromUrl]);

  const handleRoomSelect = (modelPath: string) => {
    setRoomModelPath(modelPath);
  };

  // Handle item click from SmartScene - show the detail modal
  const handleItemClick = useCallback((item: DatabaseItemData) => {
    console.log("🛒 Item clicked, showing detail modal:", item._id);
    // Convert DatabaseItemData to DatabaseItem (they have the same shape)
    setSelectedItem(item as DatabaseItem);
    setIsModalOpen(true);
  }, []);

  // Close the modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    // Clear selected item after animation completes
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Full-screen 3D Canvas */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <SmartScene 
          className="w-full h-full" 
          roomModelPath={roomModelPath}
          onItemClick={handleItemClick}
        />
      </div>

      {/* Floating UI Overlay */}
      <RoomOverlay onRoomSelect={handleRoomSelect} currentRoomPath={roomModelPath} />

      {/* Item Detail Modal */}
      <ItemDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        item={selectedItem}
      />
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    }>
      <RoomContent />
    </Suspense>
  );
}
