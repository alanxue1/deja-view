import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

// GET - Fetch all saved items (with original item descriptions from items collection)
export async function GET() {
  try {
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    
    const savedItems = await db.collection("saved-items")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log(`📦 Fetched ${savedItems.length} saved items from MongoDB`);
    
    // Collect valid dbItemIds to fetch original item descriptions
    const dbItemIds: ObjectId[] = [];
    for (const item of savedItems) {
      if (item.dbItemId) {
        try {
          dbItemIds.push(new ObjectId(item.dbItemId));
        } catch {
          // Invalid ObjectId, skip
        }
      }
    }
    
    // Batch fetch original items from items collection
    const originalItemsMap = new Map<string, { main_item: string; description: string }>();
    if (dbItemIds.length > 0) {
      const originalItems = await db.collection("items")
        .find({ _id: { $in: dbItemIds } })
        .toArray();
      
      for (const orig of originalItems) {
        const analysis = orig.analysis || {};
        originalItemsMap.set(orig._id.toString(), {
          main_item: analysis.main_item || analysis.label || "",
          description: analysis.description || "",
        });
      }
      console.log(`📋 Fetched ${originalItems.length} original items for description lookup`);
    }
    
    return NextResponse.json({
      success: true,
      items: savedItems.map((item) => {
        const origData = item.dbItemId ? originalItemsMap.get(item.dbItemId) : null;
        return {
          _id: item._id.toString(),
          glbUrl: item.glbUrl,
          position: item.position,
          rotation: item.rotation,
          scale: item.scale,
          label: item.label,
          dbItemId: item.dbItemId || null,
          // Include original item's description data for search
          originalMainItem: origData?.main_item || null,
          originalDescription: origData?.description || null,
          createdAt: item.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("❌ Error fetching saved items:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved items", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Save a new item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { glbUrl, position, rotation, scale, label, dbItemId } = body;
    
    if (!glbUrl || !position) {
      return NextResponse.json(
        { error: "glbUrl and position are required" },
        { status: 400 }
      );
    }
    
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    
    const savedItem = {
      glbUrl,
      position, // [x, y, z]
      rotation, // [x, y, z]
      scale,    // number
      label: label || "Item",
      dbItemId: dbItemId || null, // Original item ID from items collection (for metadata lookup)
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection("saved-items").insertOne(savedItem);
    
    console.log(`✅ Saved item to MongoDB: ${result.insertedId}`);
    
    return NextResponse.json({
      success: true,
      _id: result.insertedId.toString(),
      ...savedItem,
    });
  } catch (error) {
    console.error("❌ Error saving item:", error);
    return NextResponse.json(
      { error: "Failed to save item", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update (or upsert) an existing saved item transform
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { savedItemId, glbUrl, dbItemId, position, rotation, scale, label } = body || {};

    // Need at least one identifier to find the saved record
    if (!savedItemId && !dbItemId && !glbUrl) {
      return NextResponse.json(
        { error: "One of savedItemId, dbItemId, or glbUrl is required" },
        { status: 400 }
      );
    }

    const update: any = {
      updatedAt: new Date(),
    };
    if (position) update.position = position;
    if (rotation) update.rotation = rotation;
    if (typeof scale === "number") update.scale = scale;
    if (typeof label === "string" && label.trim()) update.label = label.trim();
    if (typeof dbItemId === "string") update.dbItemId = dbItemId;
    if (typeof glbUrl === "string") update.glbUrl = glbUrl;

    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);

    let filter: any = null;
    if (typeof savedItemId === "string" && savedItemId) {
      filter = { _id: new ObjectId(savedItemId) };
    } else if (typeof dbItemId === "string" && dbItemId) {
      filter = { dbItemId };
    } else if (typeof glbUrl === "string" && glbUrl) {
      filter = { glbUrl };
    }

    const result = await db.collection("saved-items").updateOne(
      filter,
      {
        $set: update,
        $setOnInsert: {
          createdAt: new Date(),
          // Ensure required-ish fields exist on insert
          label: update.label || "Item",
          dbItemId: update.dbItemId || null,
          glbUrl: update.glbUrl || null,
          position: update.position || [0, 0, 0],
          rotation: update.rotation || [0, 0, 0],
          scale: typeof update.scale === "number" ? update.scale : 1,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedId: result.upsertedId ? result.upsertedId.toString() : null,
    });
  } catch (error) {
    console.error("❌ Error updating saved item:", error);
    return NextResponse.json(
      { error: "Failed to update saved item", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete specific item by glbUrl or clear all saved items
export async function DELETE(request: NextRequest) {
  try {
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    
    // Check if glbUrl is provided to delete specific item
    const glbUrl = request.nextUrl.searchParams.get("glbUrl");
    
    if (glbUrl) {
      // Delete specific item by glbUrl
      const result = await db.collection("saved-items").deleteOne({ glbUrl });
      
      console.log(`🗑️ Deleted saved item with glbUrl: ${glbUrl}, deleted: ${result.deletedCount}`);
      
      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount,
        glbUrl,
      });
    } else {
      // Clear all saved items
      const result = await db.collection("saved-items").deleteMany({});
      
      console.log(`🗑️ Cleared ${result.deletedCount} saved items from MongoDB`);
      
      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount,
      });
    }
  } catch (error) {
    console.error("❌ Error deleting saved items:", error);
    return NextResponse.json(
      { error: "Failed to delete saved items", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
