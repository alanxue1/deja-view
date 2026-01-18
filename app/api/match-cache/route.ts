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
 * GET /api/match-cache?itemId=xxx&description=xxx&mainItem=xxx
 * 
 * Fetches cached product matches for a given item ID.
 * If description/mainItem are provided, uses those directly instead of looking up from database.
 * If no cache exists or cache is expired, fetches fresh results from /api/match.
 */
export async function GET(request: NextRequest) {
  const itemId = request.nextUrl.searchParams.get("itemId");
  const descriptionParam = request.nextUrl.searchParams.get("description");
  const mainItemParam = request.nextUrl.searchParams.get("mainItem");
  
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
    
    // Cache miss - get item details
    console.log(`🔍 Cache miss for item ${itemId} - fetching details...`);
    
    let description = descriptionParam || "";
    let mainItem = mainItemParam || "";
    
    // If description/mainItem not provided in params, try to fetch from database
    if (!description && !mainItem) {
      try {
        const itemObjectId = new ObjectId(itemId);
        const item = await db.collection("items").findOne({ _id: itemObjectId });
        
        if (item) {
          const analysis = item.analysis || {};
          description = analysis.description || "";
          mainItem = analysis.main_item || analysis.label || "";
        }
      } catch {
        // Invalid ObjectId format or item not found - continue with empty values
        console.log(`⚠️ Could not fetch item ${itemId} from database`);
      }
    }
    
    // If still no search terms, return error
    if (!description && !mainItem) {
      return NextResponse.json({ 
        error: "No description available for search. Item may not exist in database.",
        itemId 
      }, { status: 400 });
    }
    
    // Shorten description if needed
    const searchQuery = shortenDescription(description, mainItem, 6);
    console.log(`🔎 Search query for item ${itemId}: "${searchQuery}"`);
    
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
