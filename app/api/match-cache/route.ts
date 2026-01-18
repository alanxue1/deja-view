import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { shortenDescription } from "@/lib/match/shortenDescription";
import type { NormalizedProduct, MatchResponse } from "@/lib/match/types";

export const runtime = "nodejs";

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedMatch {
  _id?: ObjectId;
  itemId: string;
  searchQuery: string;
  products: NormalizedProduct[];
  createdAt: Date;
  expiresAt: Date;
}

/**
 * GET /api/match-cache?itemId=xxx
 * 
 * Fetches cached product matches for a given item ID.
 * If no cache exists or cache is expired, fetches fresh results from /api/match.
 */
export async function GET(request: NextRequest) {
  const itemId = request.nextUrl.searchParams.get("itemId");
  
  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  try {
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    
    // Check cache first
    const cached = await db.collection<CachedMatch>("product-matches").findOne({
      itemId,
      expiresAt: { $gt: new Date() }
    });
    
    if (cached) {
      console.log(`📦 Cache hit for item ${itemId}`);
      return NextResponse.json({
        cached: true,
        itemId,
        searchQuery: cached.searchQuery,
        products: cached.products,
        cachedAt: cached.createdAt,
      });
    }
    
    // Cache miss - fetch item details from items collection
    console.log(`🔍 Cache miss for item ${itemId} - fetching from database...`);
    
    let itemObjectId: ObjectId;
    try {
      itemObjectId = new ObjectId(itemId);
    } catch {
      return NextResponse.json({ error: "Invalid itemId format" }, { status: 400 });
    }
    
    const item = await db.collection("items").findOne({ _id: itemObjectId });
    
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    
    // Extract search query from item analysis
    const analysis = item.analysis || {};
    const description = analysis.description || "";
    const mainItem = analysis.main_item || analysis.label || "";
    
    if (!description && !mainItem) {
      return NextResponse.json({ 
        error: "Item has no description or main_item for search",
        itemId 
      }, { status: 400 });
    }
    
    // Shorten description if needed
    const searchQuery = shortenDescription(description, mainItem, 6);
    console.log(`🔎 Search query for item ${itemId}: "${searchQuery}" (from: "${description.substring(0, 50)}...")`);
    
    // Call /api/match to get products
    const matchUrl = new URL("/api/match", request.url);
    const matchResponse = await fetch(matchUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery }),
    });
    
    if (!matchResponse.ok) {
      const errorText = await matchResponse.text();
      console.error(`❌ Match API error: ${matchResponse.status} - ${errorText}`);
      return NextResponse.json({ 
        error: "Failed to fetch product matches",
        details: errorText 
      }, { status: 500 });
    }
    
    const matchData = (await matchResponse.json()) as MatchResponse;
    const products = matchData.products || [];
    
    // Store in cache
    const now = new Date();
    const cacheEntry: CachedMatch = {
      itemId,
      searchQuery,
      products,
      createdAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    };
    
    await db.collection<CachedMatch>("product-matches").updateOne(
      { itemId },
      { $set: cacheEntry },
      { upsert: true }
    );
    
    console.log(`💾 Cached ${products.length} products for item ${itemId}`);
    
    return NextResponse.json({
      cached: false,
      itemId,
      searchQuery,
      products,
      cachedAt: now,
    });
    
  } catch (error) {
    console.error("❌ Error in match-cache:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * DELETE /api/match-cache?itemId=xxx
 * 
 * Invalidates the cache for a specific item.
 */
export async function DELETE(request: NextRequest) {
  const itemId = request.nextUrl.searchParams.get("itemId");
  
  try {
    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    
    if (itemId) {
      // Delete specific item cache
      const result = await db.collection("product-matches").deleteOne({ itemId });
      return NextResponse.json({ 
        success: true, 
        deletedCount: result.deletedCount,
        itemId 
      });
    } else {
      // Delete all expired cache entries
      const result = await db.collection("product-matches").deleteMany({
        expiresAt: { $lt: new Date() }
      });
      return NextResponse.json({ 
        success: true, 
        deletedCount: result.deletedCount,
        message: "Cleared expired cache entries"
      });
    }
  } catch (error) {
    console.error("❌ Error deleting cache:", error);
    return NextResponse.json({ 
      error: "Failed to delete cache",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
