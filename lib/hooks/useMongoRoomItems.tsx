"use client";

import { useRoomItems, type RoomItem } from "./useRoomItems";
import { useMemo } from "react";

/**
 * Convert MongoDB items to the PlacedItem format expected by SmartScene
 */
export interface PlacedItem {
  id: number;
  modelPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
}

export function useMongoRoomItems(roomId: string) {
  const { items: mongoItems, loading, error } = useRoomItems({ roomId });

  // Convert MongoDB items to PlacedItem format
  const placedItems: PlacedItem[] = useMemo(() => {
    return mongoItems
      .filter((item) => item.status === "ready" && item.asset?.glbUrl)
      .map((item) => ({
        id: parseInt(item.id.slice(-8), 16), // Use last 8 chars of MongoDB ID as number
        modelPath: item.asset!.glbUrl,
        position: [
          item.transform.position.x,
          item.transform.position.y,
          item.transform.position.z,
        ],
        rotation: [
          item.transform.rotation.x,
          item.transform.rotation.y,
          item.transform.rotation.z,
        ],
        scale: item.transform.scale,
      }));
  }, [mongoItems]);

  // Get items by status for UI display
  const itemsByStatus = useMemo(() => {
    return {
      queued: mongoItems.filter((item) => item.status === "queued"),
      running: mongoItems.filter((item) => item.status === "running"),
      ready: mongoItems.filter((item) => item.status === "ready"),
      failed: mongoItems.filter((item) => item.status === "failed"),
    };
  }, [mongoItems]);

  return {
    placedItems,
    mongoItems,
    itemsByStatus,
    loading,
    error,
  };
}
