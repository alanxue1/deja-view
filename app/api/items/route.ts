import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/items
 *
 * Fetches all items from MongoDB with status: "ready".
 * Returns documents with asset.glbUrl, source info, and analysis for placement.
 */
export async function GET() {
  try {
    // Debug: log environment variables
    console.log("🔍 ENV DEBUG:");
    console.log("  MONGODB_ATLAS_URI:", process.env.MONGODB_ATLAS_URI ? "SET (starts with: " + process.env.MONGODB_ATLAS_URI.substring(0, 30) + "...)" : "NOT SET");
    console.log("  MONGODB_DEV_URI:", process.env.MONGODB_DEV_URI ? "SET" : "NOT SET");
    console.log("  MONGODB_DB:", process.env.MONGODB_DB || "NOT SET");
    
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    const items = await db
      .collection("items")
      .find({ status: "ready" })
      .toArray();

    // Map to return only necessary fields for the frontend
    const mappedItems = items.map((item) => ({
      _id: item._id.toString(),
      source: item.source,
      roomId: item.roomId,
      status: item.status,
      transform: item.transform,
      analysis: item.analysis,
      asset: item.asset,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    console.log(`📦 Fetched ${mappedItems.length} items from MongoDB`);

    return NextResponse.json(mappedItems);
  } catch (error) {
    console.error("[GET /api/items] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch items from database" },
      { status: 500 }
    );
  }
}
