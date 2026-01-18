import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/proxy-model?url=...
 * 
 * Proxies GLB model requests to avoid CORS issues with R2 storage.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    console.log("🔄 Proxying model from:", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("❌ Failed to fetch model:", response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch model: ${response.status}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    
    console.log("✅ Model fetched, size:", arrayBuffer.byteLength, "bytes");

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });
  } catch (error) {
    console.error("❌ Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy model" },
      { status: 500 }
    );
  }
}
