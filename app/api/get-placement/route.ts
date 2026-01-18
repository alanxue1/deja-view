import { NextRequest, NextResponse } from 'next/server';

// Post-processing algorithm to optimize placement
function optimizePlacement(placement: any, context: {
  roomWidth: number;
  roomDepth: number;
  existingItems: any[];
  label: string;
  modelDimensions?: { width: number; depth: number; height?: number } | null;
}) {
  let { x, y, rotation, scale } = placement;
  const { roomWidth, roomDepth, existingItems, label, modelDimensions } = context;

  // Constants (unitless / scene-units-aware). We avoid claiming any physical unit (m/cm).
  const SAFE_MIN = 0.05; // normalized margin from walls
  const SAFE_MAX = 0.95;
  const CENTER_THRESHOLD = 0.1; // avoid dead center bias

  // Clamp scale to safe range (scale is a multiplier; client applies it on top of its base fit scaling).
  const clampedScale = (() => {
    const s = typeof scale === "number" && Number.isFinite(scale) ? scale : 1;
    return Math.max(0.2, Math.min(4.0, s));
  })();

  const labelLower = (label || "").toLowerCase();
  const isCouch = labelLower.includes("couch") || labelLower.includes("sofa");
  const isFurniture =
    /(couch|sofa|chair|armchair|bench|stool|bed|desk|table|dining|dresser|cabinet|shelf|bookshelf|tv|stand)/.test(
      labelLower
    );

  // Estimate footprint in scene units (if model dimensions are provided), then convert to normalized margins.
  const footprint = (() => {
    if (!modelDimensions || !Number.isFinite(modelDimensions.width) || !Number.isFinite(modelDimensions.depth)) {
      return { widthUnits: 0, depthUnits: 0, marginX: 0, marginY: 0 };
    }
    const widthUnits = Math.max(0, modelDimensions.width) * clampedScale;
    const depthUnits = Math.max(0, modelDimensions.depth) * clampedScale;
    const marginX = roomWidth > 0 ? (widthUnits / 2) / roomWidth : 0;
    const marginY = roomDepth > 0 ? (depthUnits / 2) / roomDepth : 0;
    return { widthUnits, depthUnits, marginX, marginY };
  })();

  // Effective safe bounds considering footprint (prevents “through wall” placements).
  const SAFE_MIN_X = Math.max(SAFE_MIN, Math.min(0.45, footprint.marginX));
  const SAFE_MAX_X = 1 - SAFE_MIN_X;
  const SAFE_MIN_Y = Math.max(SAFE_MIN, Math.min(0.45, footprint.marginY));
  const SAFE_MAX_Y = 1 - SAFE_MIN_Y;

  const clamp01 = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // Snap rotation to 4 cardinal directions (server-side backstop)
  const snapRotation = (r: number): number => {
    const candidates = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    let best = candidates[0];
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.abs(((r - c + Math.PI) % (2 * Math.PI)) - Math.PI);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  };

  // Convert normalized to scene coordinates (use let for reassignment)
  let worldX = (x - 0.5) * roomWidth;
  let worldZ = (y - 0.5) * roomDepth;

  // Helper function to calculate distance between two points
  const calculateDistance = (x1: number, z1: number, x2: number, z2: number): number => {
    const dx = x1 - x2;
    const dz = z1 - z2;
    return Math.sqrt(dx * dx + dz * dz);
  };

  // Validation function to check if position is valid
  const isValidPosition = (nx: number, ny: number, wx: number, wz: number, items: any[]): boolean => {
    // Wall bounds FIRST (footprint-aware)
    if (nx < SAFE_MIN_X || nx > SAFE_MAX_X || ny < SAFE_MIN_Y || ny > SAFE_MAX_Y) {
      return false;
    }
    
    // Check furniture collision (unitless heuristics).
    // Existing items currently don't include their own dimensions, so we use a relative clearance based on room size + our footprint.
    const roomMax = Math.max(roomWidth || 1, roomDepth || 1);
    const ourRadius = Math.max(footprint.widthUnits, footprint.depthUnits) > 0 ? Math.max(footprint.widthUnits, footprint.depthUnits) / 2 : roomMax * 0.04;
    const otherRadiusDefault = roomMax * 0.04;
    const clearance = roomMax * 0.06;

    for (const item of items) {
      const itemX = item.position[0] || item.position?.[0];
      const itemZ = item.position[2] || item.position?.[2] || item.position?.[1];
      
      if (itemX === undefined || itemZ === undefined) continue;
      
      const distance = calculateDistance(wx, wz, itemX, itemZ);
      const requiredDistance = ourRadius + otherRadiusDefault + clearance;
      
      if (distance < requiredDistance) {
        return false;
      }
    }
    
    return true;
  };

  // Step 1: Clamp to safe bounds (footprint-aware)
  if (x < SAFE_MIN_X || x > SAFE_MAX_X || y < SAFE_MIN_Y || y > SAFE_MAX_Y) {
    x = clamp01(x, SAFE_MIN_X, SAFE_MAX_X);
    y = clamp01(y, SAFE_MIN_Y, SAFE_MAX_Y);
    
    // Recalculate world coords after wall adjustment
    worldX = (x - 0.5) * roomWidth;
    worldZ = (y - 0.5) * roomDepth;
  }

  // Step 2: Check collision with existing furniture and adjust iteratively
  const MAX_ITERATIONS = 10;
  let iterations = 0;
  let adjustedX = x;
  let adjustedY = y;
  let adjustedWorldX = worldX;
  let adjustedWorldZ = worldZ;
  
  while (iterations < MAX_ITERATIONS) {
    let needsAdjustment = false;
    
    for (const item of existingItems) {
      const itemX = item.position[0] || item.position?.[0];
      const itemZ = item.position[2] || item.position?.[2] || item.position?.[1];
      
      if (itemX === undefined || itemZ === undefined) continue;

      const distance = calculateDistance(adjustedWorldX, adjustedWorldZ, itemX, itemZ);
      const roomMax = Math.max(roomWidth || 1, roomDepth || 1);
      const ourRadius = Math.max(footprint.widthUnits, footprint.depthUnits) > 0 ? Math.max(footprint.widthUnits, footprint.depthUnits) / 2 : roomMax * 0.04;
      const otherRadiusDefault = roomMax * 0.04;
      const clearance = roomMax * 0.06;
      const requiredDistance = ourRadius + otherRadiusDefault + clearance;

      // If too close, push away from furniture
      if (distance < requiredDistance) {
        needsAdjustment = true;
        const angle = Math.atan2(adjustedWorldZ - itemZ, adjustedWorldX - itemX);
        const pushDistance = requiredDistance - distance + 0.1; // Add small buffer
        
        // Calculate new position
        const newWorldX = adjustedWorldX + Math.cos(angle) * pushDistance;
        const newWorldZ = adjustedWorldZ + Math.sin(angle) * pushDistance;
        
        // Convert back to normalized coordinates
        adjustedX = (newWorldX / roomWidth) + 0.5;
        adjustedY = (newWorldZ / roomDepth) + 0.5;
        
        // Clamp to safe zone (not room bounds)
        adjustedX = clamp01(adjustedX, SAFE_MIN_X, SAFE_MAX_X);
        adjustedY = clamp01(adjustedY, SAFE_MIN_Y, SAFE_MAX_Y);
        
        // Recalculate world coords
        adjustedWorldX = (adjustedX - 0.5) * roomWidth;
        adjustedWorldZ = (adjustedY - 0.5) * roomDepth;
        
        // If push-away results in wall violation, try alternative direction (away from nearest wall)
        if (adjustedX < SAFE_MIN_X || adjustedX > SAFE_MAX_X || adjustedY < SAFE_MIN_Y || adjustedY > SAFE_MAX_Y) {
          // Move toward center of safe zone instead
          const centerX = 0.5;
          const centerY = 0.5;
          const centerWorldX = 0;
          const centerWorldZ = 0;
          
          const angleToCenter = Math.atan2(centerWorldZ - itemZ, centerWorldX - itemX);
          const safeDistance = requiredDistance + 0.2;
          
          adjustedWorldX = itemX + Math.cos(angleToCenter) * safeDistance;
          adjustedWorldZ = itemZ + Math.sin(angleToCenter) * safeDistance;
          
          adjustedX = (adjustedWorldX / roomWidth) + 0.5;
          adjustedY = (adjustedWorldZ / roomDepth) + 0.5;
          
          // Clamp to safe zone
          adjustedX = clamp01(adjustedX, SAFE_MIN_X, SAFE_MAX_X);
          adjustedY = clamp01(adjustedY, SAFE_MIN_Y, SAFE_MAX_Y);
          
          adjustedWorldX = (adjustedX - 0.5) * roomWidth;
          adjustedWorldZ = (adjustedY - 0.5) * roomDepth;
        }
      }
    }
    
    if (!needsAdjustment) break; // No more adjustments needed
    iterations++;
  }
  
  // Update x, y with adjusted values
  x = adjustedX;
  y = adjustedY;

  // Step 3: Recalculate world coordinates for final validation
  const finalWorldX = (x - 0.5) * roomWidth;
  const finalWorldZ = (y - 0.5) * roomDepth;

  // Step 4: Final validation - ensure position meets all constraints
  if (!isValidPosition(x, y, finalWorldX, finalWorldZ, existingItems)) {
    // Fallback: Try center of safe zone
    let fallbackX = 0.5;
    let fallbackY = 0.5;
    let fallbackWorldX = 0;
    let fallbackWorldZ = 0;
    
    // If center conflicts with furniture, try positions in safe zone
    const positionsToTry = [
      [0.5, 0.5], // Center
      [0.3, 0.3], // Left-back
      [0.7, 0.3], // Right-back
      [0.3, 0.7], // Left-front
      [0.7, 0.7], // Right-front
      [0.25, 0.5], // Left-center
      [0.75, 0.5], // Right-center
      [0.5, 0.25], // Back-center
      [0.5, 0.75], // Front-center
    ];
    
    let foundValid = false;
    for (const [tryX, tryY] of positionsToTry) {
      const tryWorldX = (tryX - 0.5) * roomWidth;
      const tryWorldZ = (tryY - 0.5) * roomDepth;
      
      if (isValidPosition(tryX, tryY, tryWorldX, tryWorldZ, existingItems)) {
        fallbackX = tryX;
        fallbackY = tryY;
        fallbackWorldX = tryWorldX;
        fallbackWorldZ = tryWorldZ;
        foundValid = true;
        break;
      }
    }
    
    if (foundValid) {
      x = fallbackX;
      y = fallbackY;
    } else {
      // Last resort: Use safe zone boundaries, but ensure not on furniture
      x = clamp01(x, SAFE_MIN_X, SAFE_MAX_X);
      y = clamp01(y, SAFE_MIN_Y, SAFE_MAX_Y);
    }
  }

  // Step 5: Couch-specific wall alignment + cardinal rotation (best-effort)
  if (isCouch) {
    // Decide nearest wall and snap toward it (still footprint-aware).
    const dLeft = x;
    const dRight = 1 - x;
    const dBack = y;
    const dFront = 1 - y;
    const min = Math.min(dLeft, dRight, dBack, dFront);

    // wall band: close to wall but inside safe zone
    const wallBand = 0.04;
    if (min === dBack) {
      y = clamp01(SAFE_MIN_Y + wallBand, SAFE_MIN_Y, SAFE_MAX_Y);
      rotation = 0;
      // Avoid dead-center x for couch
      if (Math.abs(x - 0.5) < CENTER_THRESHOLD) x = clamp01(0.25, SAFE_MIN_X, SAFE_MAX_X);
    } else if (min === dFront) {
      y = clamp01(SAFE_MAX_Y - wallBand, SAFE_MIN_Y, SAFE_MAX_Y);
      rotation = Math.PI;
      if (Math.abs(x - 0.5) < CENTER_THRESHOLD) x = clamp01(0.75, SAFE_MIN_X, SAFE_MAX_X);
    } else if (min === dLeft) {
      x = clamp01(SAFE_MIN_X + wallBand, SAFE_MIN_X, SAFE_MAX_X);
      rotation = Math.PI / 2;
      if (Math.abs(y - 0.5) < CENTER_THRESHOLD) y = clamp01(0.25, SAFE_MIN_Y, SAFE_MAX_Y);
    } else {
      x = clamp01(SAFE_MAX_X - wallBand, SAFE_MIN_X, SAFE_MAX_X);
      rotation = -Math.PI / 2;
      if (Math.abs(y - 0.5) < CENTER_THRESHOLD) y = clamp01(0.75, SAFE_MIN_Y, SAFE_MAX_Y);
    }
  } else {
    // Non-couch: if too centered, nudge away from center slightly (still safe-zone).
    const distFromCenterX = Math.abs(x - 0.5);
    const distFromCenterY = Math.abs(y - 0.5);
    if (distFromCenterX < CENTER_THRESHOLD && distFromCenterY < CENTER_THRESHOLD) {
      const candidateX = x < 0.5 ? SAFE_MIN_X + 0.1 : SAFE_MAX_X - 0.1;
      const candidateY = y < 0.5 ? SAFE_MIN_Y + 0.1 : SAFE_MAX_Y - 0.1;
      const candidateWorldX = (candidateX - 0.5) * roomWidth;
      const candidateWorldZ = (candidateY - 0.5) * roomDepth;
      if (isValidPosition(candidateX, candidateY, candidateWorldX, candidateWorldZ, existingItems)) {
        x = candidateX;
        y = candidateY;
      }
    }
  }

  // Final clamp (footprint-aware)
  x = clamp01(x, SAFE_MIN_X, SAFE_MAX_X);
  y = clamp01(y, SAFE_MIN_Y, SAFE_MAX_Y);

  rotation = snapRotation(typeof rotation === "number" && Number.isFinite(rotation) ? rotation : 0);

  // Furniture backstop: avoid facing the nearest wall (face inward).
  if (isFurniture) {
    const dLeft = x;
    const dRight = 1 - x;
    const dBack = y;
    const dFront = 1 - y;
    const min = Math.min(dLeft, dRight, dBack, dFront);
    if (min === dBack && rotation === Math.PI) rotation = 0; // near back wall: don't face -Z
    else if (min === dFront && rotation === 0) rotation = Math.PI; // near front wall: don't face +Z
    else if (min === dLeft && rotation === -Math.PI / 2) rotation = Math.PI / 2; // near left wall: don't face -X
    else if (min === dRight && rotation === Math.PI / 2) rotation = -Math.PI / 2; // near right wall: don't face +X
  }

  return {
    x: parseFloat(x.toFixed(3)),
    y: parseFloat(y.toFixed(3)),
    rotation,
    scale: parseFloat(clampedScale.toFixed(3)),
    reasoning: placement.reasoning || 'Optimized placement with collision avoidance and wall clearance'
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, label, modelImage, modelDimensions } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    console.log("🔑 Gemini API Key check:", apiKey ? `Present (${apiKey.substring(0, 10)}...)` : "❌ MISSING");
    
    if (!apiKey) {
      console.error("❌ ERROR: GOOGLE_GEMINI_API_KEY not configured in environment variables");
      return NextResponse.json(
        { error: 'GOOGLE_GEMINI_API_KEY not configured. Please add it to your .env file.' },
        { status: 500 }
      );
    }

    // Extract room context from body if provided
    const roomWidth = body.roomWidth || null;
    const roomDepth = body.roomDepth || null;
    const existingItems = body.existingItems || [];

    // Build context string in scene units (unitless; do not claim physical units like m/cm)
    let contextInfo = "";
    if (roomWidth && roomDepth) {
      // Room coordinate bounds (normalized 0-1, scene units)
      const worldMinX = -(roomWidth / 2);
      const worldMaxX = roomWidth / 2;
      const worldMinZ = -(roomDepth / 2);
      const worldMaxZ = roomDepth / 2;
      
      contextInfo += `\n\nROOM COORDINATE SYSTEM:\n`;
      contextInfo += `- Room size: ${roomWidth.toFixed(2)} units (width) x ${roomDepth.toFixed(2)} units (depth)\n`;
      contextInfo += `- Normalized coordinates (0-1): x=0.0 (left wall) to x=1.0 (right wall), y=0.0 (back wall) to y=1.0 (front wall)\n`;
      contextInfo += `- Scene bounds: X [${worldMinX.toFixed(2)}, ${worldMaxX.toFixed(2)}], Z [${worldMinZ.toFixed(2)}, ${worldMaxZ.toFixed(2)}]\n`;
      contextInfo += `- Center point: normalized (0.5, 0.5) = world (0, 0)\n`;
      contextInfo += `- Wall regions: x < 0.25 or x > 0.75 (side walls), y < 0.25 or y > 0.75 (front/back walls)\n`;
      contextInfo += `- Corner regions: (x < 0.25, y < 0.25), (x < 0.25, y > 0.75), (x > 0.75, y < 0.25), (x > 0.75, y > 0.75)\n`;
      
      contextInfo += `\nSAFE PLACEMENT ZONES:\n`;
      contextInfo += `- Valid normalized coordinates: x [0.05, 0.95], y [0.05, 0.95]\n`;
      contextInfo += `- Prohibited wall zones: x < 0.05 (left wall too close), x > 0.95 (right wall too close), y < 0.05 (back wall too close), y > 0.95 (front wall too close)\n`;
      contextInfo += `- CRITICAL: NEVER place items in prohibited zones (x < 0.05, x > 0.95, y < 0.05, or y > 0.95)\n`;
      contextInfo += `- Note: Use normalized spacing + the model size to avoid clipping into walls.\n`;
    }
    
    // Analyze existing furniture for context-aware placement
    if (existingItems.length > 0) {
      contextInfo += `\nEXISTING FURNITURE CONTEXT:\n`;
      existingItems.forEach((item: any, idx: number) => {
        const normalizedX = ((item.position[0] / roomWidth) + 0.5).toFixed(3);
        const normalizedY = ((item.position[2] / roomDepth) + 0.5).toFixed(3);
        const worldX = item.position[0].toFixed(2);
        const worldZ = item.position[2].toFixed(2);
        const itemLabel = item.label || 'Item';
        
        const minNormalizedDistance = (0.1 * Math.max(roomWidth, roomDepth)) / Math.max(roomWidth, roomDepth); // ~0.1 of room in normalized
        
        contextInfo += `  ${idx + 1}. ${itemLabel} at normalized (${normalizedX}, ${normalizedY}) = scene (${worldX}, ${worldZ})\n`;
        contextInfo += `     → Keep at least ~${minNormalizedDistance.toFixed(3)} normalized separation unless the object is meant to touch.\n`;
        
        // Add relationship hints for chairs
        if (itemLabel.toLowerCase().includes('table') || itemLabel.toLowerCase().includes('desk')) {
          contextInfo += `     → If placing a chair, position it NEAR this ${itemLabel} but avoid overlaps and keep a comfortable gap.\n`;
        }
        if (itemLabel.toLowerCase().includes('chair')) {
          contextInfo += `     → Other chairs are here: avoid stacking chairs; keep visible spacing.\n`;
        }
      });
      
      // Check for tables/desks in the room
      const hasTable = existingItems.some((item: any) => 
        item.label?.toLowerCase().includes('table') || item.label?.toLowerCase().includes('desk')
      );
      if (hasTable && label?.toLowerCase().includes('chair')) {
        contextInfo += `\nPLACEMENT PRIORITY: This is a CHAIR and there is a TABLE/DESK in the room.\n`;
        contextInfo += `- Place the chair adjacent to the table (not on top of it)\n`;
        contextInfo += `- Position at a comfortable distance (0.3-0.5m from table edge)\n`;
        contextInfo += `- Face the chair TOWARD the table center\n`;
        contextInfo += `- If multiple tables exist, choose the closest/most appropriate one\n`;
      }
      
      // Check for plants - they should go ON tables
      const isPlant = label?.toLowerCase().includes('plant');
      if (isPlant && hasTable) {
        contextInfo += `\nPLACEMENT PRIORITY: This is a PLANT and there is a TABLE/DESK in the room.\n`;
        contextInfo += `- Place the plant ON TOP of the table (use the table's X and Z coordinates)\n`;
        contextInfo += `- Position the plant centered on or near the center of the table surface\n`;
        contextInfo += `- The plant's X and Z coordinates should match the table's coordinates\n`;
        contextInfo += `- If multiple tables exist, choose the most appropriate one for a decorative plant\n`;
      } else if (isPlant && !hasTable) {
        contextInfo += `\nPLACEMENT NOTE: This is a PLANT but no table is available. Place it on the floor in a suitable location.\n`;
      }
    }

    // Add model-specific context if available
    let modelContext = "";
    if (modelImage && modelDimensions) {
      modelContext += `\n\nMODEL TO PLACE:\n`;
      modelContext += `- Item type: ${label || 'Furniture'}\n`;
      modelContext += `- Model bounds (in the same scene units): ${modelDimensions.width.toFixed(3)} (width) x ${modelDimensions.depth.toFixed(3)} (depth) x ${modelDimensions.height.toFixed(3)} (height)\n`;
      modelContext += `- This is the item’s size in scene units. Use it to avoid clipping into walls/other objects.\n`;
      
      // Add couch-specific placement rules
      if (label?.toLowerCase().includes('couch') || label?.toLowerCase().includes('sofa')) {
        modelContext += `\nCOUCH PLACEMENT RULES:\n`;
        modelContext += `- Couches are typically placed AGAINST A WALL (back of couch against wall)\n`;
        modelContext += `- Face the couch toward the room center or a focal point (like a window/TV)\n`;
        modelContext += `- Leave visible walkway space in front (avoid blocking paths)\n`;
        modelContext += `- If the room has windows, consider placing the couch to face or be near the window\n`;
        modelContext += `- Avoid placing the couch in the center of the room - prefer wall placement\n`;
        modelContext += `- Back of couch should be near a wall, but still inside the safe zone\n`;
        modelContext += `- Rotation: 0 radians = facing forward (toward +Z), Math.PI/2 = facing right (+X), Math.PI = facing back (-Z), -Math.PI/2 = facing left (-X)\n`;
      }

    // General furniture orientation rules (prevents "facing a wall")
    if (label) {
      const l = label.toLowerCase();
      const isFurnitureLabel =
        /(couch|sofa|chair|armchair|bench|stool|bed|desk|table|dining|dresser|cabinet|shelf|bookshelf|tv|stand)/.test(l);
      if (isFurnitureLabel) {
        modelContext += `\nFURNITURE ORIENTATION RULES (IMPORTANT):\n`;
        modelContext += `- NEVER orient furniture so its FRONT faces directly into the nearest wall.\n`;
        modelContext += `- If placed near a wall, rotate it to face AWAY from that wall (face inward toward open space / room center).\n`;
        modelContext += `- Keep some clear space in front of the furniture (do not place its front flush against a wall).\n`;
      }
    }
    }

    // Prompt: unitless scene coordinates + strict JSON schema (adds `scale`, cardinal rotation)
    const prompt = `You are an expert interior designer. Analyze the provided top-down room image and choose a placement for the item labeled '${label || 'Item'}'.\n${contextInfo}${modelContext}\n\nIMPORTANT ABOUT SCALE:\n- All numeric sizes are in a generic scene unit system (NOT cm/m). Treat the room dimensions as a relative magnitude.\n- Your output must be consistent with the provided room size and model bounds so the item does not clip through walls.\n- Vertical placement (height) is handled automatically by the app; you must NOT return any height/Y value.\n\nOUTPUT CONTRACT (STRICT):\n1) Return normalized coordinates x,y in [0,1].\n2) Return rotation snapped to one of these exact values ONLY: 0, Math.PI/2, Math.PI, -Math.PI/2.\n   - 0 faces +Z, Math.PI faces -Z, Math.PI/2 faces +X, -Math.PI/2 faces -X.\n3) Return scale as a positive multiplier (typical range 0.5 to 2.0). The app already sizes the model to a base fit; scale multiplies that base.\n\nPLACEMENT RULES:\n- Never place in prohibited zones: x < 0.05, x > 0.95, y < 0.05, y > 0.95.\n- Avoid overlaps with existing items.\n- For couches/sofas: place with the BACK near a wall and face inward. Avoid dead center (do not use x≈0.5 and y≈0.5).\n- For furniture (chairs/desks/tables/beds/etc): ensure the FRONT faces inward and NOT into the nearest wall.\n\nRETURN ONLY A SINGLE JSON OBJECT (no markdown, no extra text):\n{\n  \"x\": 0.25,\n  \"y\": 0.15,\n  \"rotation\": 0,\n  \"scale\": 1.2,\n  \"reasoning\": \"Back near the back wall, facing inward; scaled to match room proportions; avoids overlaps\"\n}\n`;

    // Call Google Gemini Vision API - using gemini 3 flash preview
    const modelName = "gemini-3-flash-preview"; // Gemini 3 Flash Preview - latest fast preview model
    const apiVersion = "v1beta";
    console.log(`🤖 Using Gemini model: ${modelName} (API: ${apiVersion}) - Gemini 3 Flash Preview`);
    
    const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
    console.log(`📡 API URL: ${apiUrl.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout (flash should be faster but give it more time)
    
    console.log(`⏱️ Starting Gemini API request with 60s timeout...`);
    const startTime = Date.now();
    
    const response = await fetch(apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: image.includes('data:image/jpeg') ? 'image/jpeg' : 'image/png', // Auto-detect format
                    data: image.replace(/^data:image\/\w+;base64,/, ''), // Remove data URL prefix if present
                  },
                },
                // Add model image if available
                ...(modelImage ? [{
                  inline_data: {
                    mime_type: modelImage.includes('data:image/jpeg') ? 'image/jpeg' : 'image/png',
                    data: modelImage.replace(/^data:image\/\w+;base64,/, ''),
                  },
                }] : []),
              ],
            },
          ],
        }),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Gemini API responded in ${elapsed}s`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Gemini API error:', response.status, response.statusText);
      console.error('❌ Error details:', errorData);
      return NextResponse.json(
        { error: 'Failed to call Gemini API', details: errorData, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract the response text
    const responseText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('📝 Gemini API response text:', responseText);

    if (!responseText) {
      console.error('❌ No response text from Gemini API. Full response:', JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: 'No response from Gemini API', fullResponse: data },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let placement;
    try {
      // Extract JSON from response (handle markdown code blocks if present)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        placement = JSON.parse(jsonMatch[0]);
      } else {
        placement = JSON.parse(responseText);
      }

      // Validate and clamp values
      placement.x = Math.max(0, Math.min(1, placement.x || 0.5));
      placement.y = Math.max(0, Math.min(1, placement.y || 0.5));
      placement.rotation = typeof placement.rotation === "number" ? placement.rotation : 0;
      placement.scale = typeof placement.scale === "number" && Number.isFinite(placement.scale) ? placement.scale : 1.0;
      placement.scale = Math.max(0.2, Math.min(4.0, placement.scale));

      // Post-processing validation: optimize placement with algorithm
      const optimized = optimizePlacement(placement, {
        roomWidth: body.roomWidth || 4,
        roomDepth: body.roomDepth || 4,
        existingItems: existingItems || [],
        label: label || 'Chair',
        modelDimensions: modelDimensions || null
      });

      console.log('🎯 Placement optimized:', {
        original: placement,
        optimized: optimized
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3e379d4a-11d8-484f-b8f7-0a98f77c7c7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:POST:optimized',message:'Returning optimized placement',data:{label:label||'Chair',optimized},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      return NextResponse.json(optimized);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      // Fallback to center position
      const fallbackPlacement = {
        x: 0.5,
        y: 0.5,
        rotation: 0,
        scale: 1.0,
      };
      const fallbackOptimized = optimizePlacement(fallbackPlacement, {
        roomWidth: body.roomWidth || 4,
        roomDepth: body.roomDepth || 4,
        existingItems: existingItems || [],
        label: label || 'Chair',
        modelDimensions: modelDimensions || null
      });
      return NextResponse.json(fallbackOptimized);
    }
  } catch (error) {
    console.error('Error in get-placement API:', error);
    
    // Handle timeout/abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout after 30 seconds');
      return NextResponse.json(
        { error: 'Request timeout - Gemini API took too long to respond (60s limit)', details: 'The API request was aborted due to timeout. Try reducing image size or checking your API key permissions.' },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
