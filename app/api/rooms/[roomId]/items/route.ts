import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/rooms/[roomId]/items
 * 
 * Fetch all items for a specific room from MongoDB.
 * Returns items sorted by updatedAt (newest first).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const items = await db
      .collection("items")
      .find({ roomId })
      .sort({ updatedAt: -1 })
      .toArray();

    // Transform MongoDB documents to JSON-friendly format
    const transformedItems = items.map((item) => ({
      id: item._id.toString(),
      roomId: item.roomId,
      source: item.source,
      status: item.status,
      transform: item.transform,
      asset: item.asset || null,
      analysis: item.analysis || null,
      error: item.error || null,
      createdAt: item.createdAt?.toISOString(),
      updatedAt: item.updatedAt?.toISOString(),
      processedAt: item.processedAt?.toISOString() || null,
    }));

    return NextResponse.json({
      roomId,
      items: transformedItems,
      count: transformedItems.length,
    });
  } catch (error) {
    console.error("[GET /api/rooms/[roomId]/items]", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rooms/[roomId]/items/[itemId]
 * 
 * Update an item's transform (position, rotation, scale).
 * Useful for saving item placements in the 3D scene.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const { itemId, transform } = body;

    if (!itemId || !transform) {
      return NextResponse.json(
        { error: "itemId and transform are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const { ObjectId } = await import("mongodb");

    const result = await db.collection("items").updateOne(
      { _id: new ObjectId(itemId), roomId },
      {
        $set: {
          transform,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, itemId });
  } catch (error) {
    console.error("[PATCH /api/rooms/[roomId]/items]", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }
}
