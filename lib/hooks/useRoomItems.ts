import { useState, useEffect, useCallback } from "react";

export interface RoomItem {
  id: string;
  roomId: string;
  source: {
    type: string;
    boardUrl: string;
    pinId: string;
    imageUrl: string;
  };
  status: "queued" | "running" | "ready" | "failed";
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  };
  asset?: {
    glbUrl: string;
    extractedPngUrl: string;
  };
  analysis?: {
    main_item: string;
    description: string;
    style: string;
    materials: string[];
    colors: string[];
    confidence: number;
  };
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
  processedAt?: string | null;
}

export interface UseRoomItemsOptions {
  roomId: string;
  pollInterval?: number; // milliseconds, default 3000 (3 seconds)
  enabled?: boolean; // whether polling is enabled, default true
}

export interface UseRoomItemsResult {
  items: RoomItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and poll room items from MongoDB.
 * Automatically polls for updates at the specified interval.
 */
export function useRoomItems({
  roomId,
  pollInterval = 3000,
  enabled = true,
}: UseRoomItemsOptions): UseRoomItemsResult {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!roomId || !enabled) return;

    try {
      const response = await fetch(`/api/rooms/${roomId}/items`);

      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.statusText}`);
      }

      const data = await response.json();
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching room items:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [roomId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Polling
  useEffect(() => {
    if (!enabled || !roomId) return;

    const interval = setInterval(fetchItems, pollInterval);

    return () => clearInterval(interval);
  }, [fetchItems, pollInterval, enabled, roomId]);

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
  };
}
