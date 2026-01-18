import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const PINTEREST_SERVICE_URL = process.env.PINTEREST_SERVICE_URL || "http://localhost:8000";

// Helper to poll job status
async function pollJobStatus(jobId: string, endpoint: string, maxWaitTime = 300000): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 3000; // Poll every 3 seconds

  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`${PINTEREST_SERVICE_URL}${endpoint}/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to poll job status: ${response.statusText}`);
    }

    const status = await response.json();
    
    if (status.status === "succeeded") {
      return status.result;
    }
    
    if (status.status === "failed") {
      throw new Error(`Job failed: ${status.error || "Unknown error"}`);
    }

    // Job still running, wait and poll again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error("Job timeout - took too long to complete");
}

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

    console.log("📌 Starting Pinterest board processing:", boardUrl);
    console.log("🔗 Pinterest service URL:", PINTEREST_SERVICE_URL);

    // Step 1: Start analyze job
    let analyzeResponse;
    try {
      analyzeResponse = await fetch(`${PINTEREST_SERVICE_URL}/v1/analyze-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board_url: boardUrl,
          max_pins: 10,
        }),
      });
    } catch (fetchError) {
      console.error("❌ Failed to connect to Pinterest service:", fetchError);
      return NextResponse.json(
        { 
          error: "Failed to connect to Pinterest extraction service", 
          details: `Make sure the Pinterest service is running at ${PINTEREST_SERVICE_URL}. Error: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}` 
        },
        { status: 503 }
      );
    }

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error("❌ Pinterest analyze job error:", errorText);
      return NextResponse.json(
        { error: "Failed to start analyze job", details: errorText },
        { status: analyzeResponse.status }
      );
    }

    const analyzeResult = await analyzeResponse.json();
    const analyzeJobId = analyzeResult.job_id;
    console.log("✅ Analyze job started:", analyzeJobId);

    // Step 2: Poll for analyze job completion
    console.log("⏳ Waiting for analyze job to complete...");
    const analyzeResultData = await pollJobStatus(analyzeJobId, "/v1/analyze-job");
    console.log(`✅ Analyze complete: ${analyzeResultData.num_pins_analyzed} pins analyzed`);

    // Step 3: Process pins with main_item - generate 3D models
    const pinsWithItems = analyzeResultData.pins.filter(
      (pin: any) => pin.analysis?.main_item && !pin.skipped
    );

    console.log(`🎯 Found ${pinsWithItems.length} pins with main items`);

    const dbName = process.env.MONGODB_DB || "deja-view";
    const db = await getDb(dbName);
    const itemsCreated: string[] = [];

    // Process each pin with a main_item
    for (const pin of pinsWithItems) {
      try {
        console.log(`🔄 Processing pin ${pin.pin_id}: ${pin.analysis.main_item}`);

        // Start 3D extraction job
        const extract3dResponse = await fetch(`${PINTEREST_SERVICE_URL}/v1/extract-item-3d`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: pin.image_url,
            item_description: pin.analysis.main_item,
          }),
        });

        if (!extract3dResponse.ok) {
          console.error(`❌ Failed to start 3D extraction for pin ${pin.pin_id}`);
          continue;
        }

        const extract3dResult = await extract3dResponse.json();
        const extract3dJobId = extract3dResult.job_id;

        // Poll for 3D extraction completion
        console.log(`⏳ Waiting for 3D model generation for ${pin.analysis.main_item}...`);
        const extract3dResultData = await pollJobStatus(extract3dJobId, "/v1/extract-item-3d", 600000); // 10 min timeout

        if (extract3dResultData.model_glb_url) {
          // Save to MongoDB
          const item = {
            source: {
              type: "pinterest",
              boardUrl: boardUrl,
              pinId: pin.pin_id,
              imageUrl: pin.image_url,
            },
            roomId: null,
            status: "ready",
            transform: null,
            analysis: {
              label: pin.analysis.main_item,
              type: pin.analysis.type || "furniture",
              main_item: pin.analysis.main_item,
              description: pin.analysis.description,
              style: pin.analysis.style,
              materials: pin.analysis.materials,
              colors: pin.analysis.colors,
              confidence: pin.analysis.confidence,
            },
            asset: {
              glbUrl: extract3dResultData.model_glb_url,
              imageUrl: extract3dResultData.result_image_url,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const insertResult = await db.collection("items").insertOne(item);
          itemsCreated.push(insertResult.insertedId.toString());
          console.log(`✅ Saved item to MongoDB: ${pin.analysis.main_item}`);
        }
      } catch (error) {
        console.error(`❌ Error processing pin ${pin.pin_id}:`, error);
        // Continue with next pin
      }
    }

    console.log(`✅ Pinterest board processing complete. Created ${itemsCreated.length} items.`);

    return NextResponse.json({
      success: true,
      itemsCreated: itemsCreated.length,
      message: `Successfully processed Pinterest board and created ${itemsCreated.length} items`,
    });
  } catch (error) {
    console.error("❌ Error processing Pinterest board:", error);
    return NextResponse.json(
      { error: "Failed to process Pinterest board", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
