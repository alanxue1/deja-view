import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/items
 *
 * Fetches items from MongoDB with status: "ready".
 * Optional query params:
 *  - boardUrl: filter by source.boardUrl
 *  - sort: "createdAtAsc" | "createdAtDesc" (default: none / insertion order)
 *  - limit: max documents to return
 *
 * Returns documents with asset.glbUrl, source info, and analysis for placement.
 */
export async function GET(request: NextRequest) {
  try {
    // Debug: log environment variables
    console.log("🔍 ENV DEBUG:");
    console.log("  MONGODB_ATLAS_URI:", process.env.MONGODB_ATLAS_URI ? "SET (starts with: " + process.env.MONGODB_ATLAS_URI.substring(0, 30) + "...)" : "NOT SET");
    console.log("  MONGODB_DEV_URI:", process.env.MONGODB_DEV_URI ? "SET" : "NOT SET");
    console.log("  MONGODB_DB:", process.env.MONGODB_DB || "NOT SET");

    const boardUrl = request.nextUrl.searchParams.get("boardUrl");
    const sort = request.nextUrl.searchParams.get("sort");
    const limitStr = request.nextUrl.searchParams.get("limit");
    
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);

    // Build filter
    const filter: Record<string, any> = { status: "ready" };
    if (boardUrl) {
      filter["source.boardUrl"] = boardUrl;
    }

    // Build sort
    let sortDoc: Record<string, 1 | -1> | undefined;
    if (sort === "createdAtAsc") {
      sortDoc = { createdAt: 1 };
    } else if (sort === "createdAtDesc") {
      sortDoc = { createdAt: -1 };
    }

    let cursor = db.collection("items").find(filter);
    if (sortDoc) cursor = cursor.sort(sortDoc);
    if (limitStr) {
      const lim = parseInt(limitStr, 10);
      if (lim > 0) cursor = cursor.limit(lim);
    }

    const items = await cursor.toArray();

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

/**
 * DELETE /api/items?id=<item_id>
 * 
 * Deletes an item from the items collection in MongoDB Atlas by _id
 */
export async function DELETE(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get("id");
    
    if (!itemId) {
      return NextResponse.json(
        { error: "Item id is required" },
        { status: 400 }
      );
    }

    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    
    const result = await db.collection("items").deleteOne({ 
      _id: new ObjectId(itemId) 
    });
    
    console.log(`🗑️ Deleted item from items collection (MongoDB Atlas): ${itemId}, deleted: ${result.deletedCount}`);
    
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Error deleting item from MongoDB Atlas:", error);
    return NextResponse.json(
      { error: "Failed to delete item", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
