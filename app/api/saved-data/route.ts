import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * saved-data:
 * Stores per-object transform state that the scene should rehydrate:
 * { glbUrl, position, rotation, scale, label, dbItemId, createdAt, updatedAt }
 *
 * This is intentionally parallel to saved-items, but backed by the "saved-data" collection.
 */

export async function GET() {
  try {
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);

    const saved = await db.collection("saved-data").find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      items: saved.map((item: any) => ({
        _id: item._id.toString(),
        glbUrl: item.glbUrl,
        position: item.position,
        rotation: item.rotation,
        scale: item.scale,
        label: item.label,
        dbItemId: item.dbItemId || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (error) {
    console.error("❌ Error fetching saved-data:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved-data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { glbUrl, position, rotation, scale, label, dbItemId } = body || {};

    if (!glbUrl || !position) {
      return NextResponse.json({ error: "glbUrl and position are required" }, { status: 400 });
    }

    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);

    const now = new Date();
    const doc = {
      glbUrl,
      position,
      rotation,
      scale,
      label: label || "Item",
      dbItemId: dbItemId || null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("saved-data").insertOne(doc);

    return NextResponse.json({
      success: true,
      _id: result.insertedId.toString(),
      ...doc,
    });
  } catch (error) {
    console.error("❌ Error saving saved-data:", error);
    return NextResponse.json(
      { error: "Failed to save saved-data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Upsert transform state by savedDataId OR dbItemId OR glbUrl
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { savedDataId, glbUrl, dbItemId, position, rotation, scale, label } = body || {};

    if (!savedDataId && !dbItemId && !glbUrl) {
      return NextResponse.json(
        { error: "One of savedDataId, dbItemId, or glbUrl is required" },
        { status: 400 }
      );
    }

    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);

    let filter: any = null;
    if (typeof savedDataId === "string" && savedDataId) {
      filter = { _id: new ObjectId(savedDataId) };
    } else if (typeof dbItemId === "string" && dbItemId) {
      filter = { dbItemId };
    } else {
      filter = { glbUrl };
    }

    const update: any = { updatedAt: new Date() };
    if (position) update.position = position;
    if (rotation) update.rotation = rotation;
    if (typeof scale === "number") update.scale = scale;
    if (typeof label === "string" && label.trim()) update.label = label.trim();
    if (typeof dbItemId === "string") update.dbItemId = dbItemId;
    if (typeof glbUrl === "string") update.glbUrl = glbUrl;

    const result = await db.collection("saved-data").updateOne(
      filter,
      {
        $set: update,
        // Only set fields here that will never conflict with $set.
        // MongoDB throws if the same path is updated in both $set and $setOnInsert.
        $setOnInsert: { createdAt: new Date() },
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
    console.error("❌ Error updating saved-data:", error);
    return NextResponse.json(
      { error: "Failed to update saved-data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete specific saved-data by glbUrl (or clear all if omitted)
export async function DELETE(request: NextRequest) {
  try {
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);

    const glbUrl = request.nextUrl.searchParams.get("glbUrl");
    if (glbUrl) {
      const result = await db.collection("saved-data").deleteOne({ glbUrl });
      return NextResponse.json({ success: true, deletedCount: result.deletedCount, glbUrl });
    }

    const result = await db.collection("saved-data").deleteMany({});
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("❌ Error deleting saved-data:", error);
    return NextResponse.json(
      { error: "Failed to delete saved-data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

