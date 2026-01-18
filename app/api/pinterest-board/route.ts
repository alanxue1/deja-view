import { NextRequest, NextResponse } from "next/server";

const PINTEREST_SERVICE_URL = process.env.PINTEREST_SERVICE_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardUrl } = body;

    if (!boardUrl) {
      return NextResponse.json(
        { error: "boardUrl is required" },
        { status: 400 }
      );
    }

    // Call the Pinterest extraction service
    const response = await fetch(`${PINTEREST_SERVICE_URL}/v1/analyze-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board_url: boardUrl,
        max_pins: 10, // Process up to 10 pins
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Pinterest service error:", errorText);
      return NextResponse.json(
        { error: "Failed to process Pinterest board", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("✅ Pinterest board job started:", result.job_id);

    return NextResponse.json({
      success: true,
      job_id: result.job_id,
      message: "Pinterest board processing started",
    });
  } catch (error) {
    console.error("❌ Error calling Pinterest service:", error);
    return NextResponse.json(
      { error: "Failed to process Pinterest board", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
