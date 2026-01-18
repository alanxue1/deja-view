import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// GET - Fetch all saved items
export async function GET() {
  try {
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    
    const savedItems = await db.collection("saved-items")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log(`📦 Fetched ${savedItems.length} saved items from MongoDB`);
    
    return NextResponse.json({
      success: true,
      items: savedItems.map((item) => ({
        _id: item._id.toString(),
        glbUrl: item.glbUrl,
        position: item.position,
        rotation: item.rotation,
        scale: item.scale,
        label: item.label,
        createdAt: item.createdAt,
      })),
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
    const { glbUrl, position, rotation, scale, label } = body;
    
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
