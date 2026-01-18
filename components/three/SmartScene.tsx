"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { initThree, cleanupThree, type ThreeScene } from "@/lib/three/init";
import { createOrbitControls, type OrbitControls } from "@/lib/three/controls";
import { setupResize } from "@/lib/three/resize";
import { cn } from "@/lib/cn";

interface PlacedItem {
  id: number;
  modelPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  // Multiplier applied on top of the base-fit scale computed in `loadAndRenderItem`
  scale?: number;
  // MongoDB item ID for linking to database metadata
  dbItemId?: string;
}

// Database item type for the onItemClick callback
export interface DatabaseItemData {
  _id: string;
  source?: {
    type?: string;
    url?: string;
  };
  analysis?: {
    main_item?: string;
    description?: string;
    style?: string;
    materials?: string[];
    colors?: string[];
    confidence?: number;
    label?: string;
    type?: string;
  };
  asset?: {
    glbUrl?: string;
    imageUrl?: string;
  };
}

interface SmartSceneProps {
  className?: string;
  roomModelPath?: string;
  onAddItem?: (item: PlacedItem) => void;
  onReady?: (addChair: () => Promise<void>) => void; // Callback to expose addChair function
  onItemClick?: (item: DatabaseItemData) => void; // Callback when an item is clicked (for showing detail modal)
}

type RoomOverlayHintEventDetail = { text: string };
const ROOM_OVERLAY_HINT_EVENT = "room-overlay-hint";
const ROOM_OVERLAY_HINT_DEFAULT = "Drag to Explore";
const ROOM_OVERLAY_HINT_CONTROL = "Drag to Control";
const ROOM_OVERLAY_HINT_CALIBRATION =
  "Move the green floor plane to match the room floor, then press Enter to save";

function isTableLikeModelPath(modelPath: string): boolean {
  const tokenized = modelPath.toLowerCase().replace(/[^a-z]/g, " ");
  // Important: word-boundary matching so "desktop" does NOT count as "desk".
  return /\b(table|desk)\b/.test(tokenized);
}

export const SmartScene: React.FC<SmartSceneProps> = ({
  className,
  roomModelPath = "/davidsbedroom.glb",
  onAddItem,
  onReady,
  onItemClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const roomModelRef = useRef<THREE.Group | null>(null);
  const itemModelsRef = useRef<Map<number, THREE.Group>>(new Map());
  const transformControlsRef = useRef<Map<number, TransformControls>>(new Map());
  const isMountedRef = useRef(true);
  const selectedItemIdRef = useRef<number | null>(null);
  const isDraggingTransformRef = useRef(false);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pointerNdcRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const clickIntentRef = useRef<{
    x: number;
    y: number;
    time: number;
    withinCanvas: boolean;
    pendingHitItemId: number | null;
    restoreOrbitEnabledTo: boolean | null;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [roomDimensions, setRoomDimensions] = useState<{ width: number; depth: number; floorY: number; scaledWidth?: number; scaledDepth?: number; scaleFactor?: number }>({ width: 4, depth: 4, floorY: -0.5315285924741149 }); // Floor Y from user measurement
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const floorControlsRef = useRef<TransformControls | null>(null);
  const itemShadowRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const isCalibratingFloorRef = useRef(false);
  // Store database item metadata for each placed item (keyed by PlacedItem.id)
  const dbItemsMetaRef = useRef<Map<number, DatabaseItemData>>(new Map());

  const setRoomOverlayHint = useCallback((text: string) => {
    if (typeof window === "undefined") return;
    (window as any).__roomOverlayHint = text;
    window.dispatchEvent(
      new CustomEvent<RoomOverlayHintEventDetail>(ROOM_OVERLAY_HINT_EVENT, {
        detail: { text },
      })
    );
  }, []);

  const getSurfaceYForItem = useCallback(
    (item: PlacedItem): number => {
      const label = item.modelPath?.toLowerCase() || "";
      const isPlant = label.includes("plant");
      const hasTable = items.some((i) => i.modelPath && isTableLikeModelPath(i.modelPath));
      const currentFloorY = roomDimensions.floorY || -0.5315285924741149;
      const tableHeight = 0.75;
      return isPlant && hasTable ? currentFloorY + tableHeight : currentFloorY;
    },
    [items, roomDimensions.floorY]
  );

  const applyPbrLightingTuning = useCallback((root: THREE.Object3D, envMapIntensity = 0.35) => {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat) continue;
        // Most glTF assets use MeshStandard/Physical materials; boost env reflections slightly for realism.
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.envMapIntensity = envMapIntensity;
          mat.needsUpdate = true;
        }
      }
    });
  }, []);

  const applySelectionHighlight = useCallback((root: THREE.Object3D) => {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat) continue;
        // Subtle highlight for PBR materials
        if (mat instanceof THREE.MeshStandardMaterial) {
          const ud = mat.userData as any;
          ud.__sel_orig_emissive ??= mat.emissive?.clone?.() ?? new THREE.Color(0x000000);
          ud.__sel_orig_emissiveIntensity ??= mat.emissiveIntensity ?? 0;
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveIntensity = 0.12;
          mat.needsUpdate = true;
        }
      }
    });
  }, []);

  const clearSelectionHighlight = useCallback((root: THREE.Object3D) => {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat) continue;
        if (mat instanceof THREE.MeshStandardMaterial) {
          const ud = mat.userData as any;
          if (ud.__sel_orig_emissive) {
            mat.emissive = ud.__sel_orig_emissive;
          }
          if (typeof ud.__sel_orig_emissiveIntensity === "number") {
            mat.emissiveIntensity = ud.__sel_orig_emissiveIntensity;
          }
          mat.needsUpdate = true;
        }
      }
    });
  }, []);

  const setSelectedItemId = useCallback(
    (nextId: number | null) => {
      const prevId = selectedItemIdRef.current;
      if (prevId === nextId) return;

      // Clear previous
      if (typeof prevId === "number") {
        const prevModel = itemModelsRef.current.get(prevId);
        if (prevModel) clearSelectionHighlight(prevModel);
      }

      // Hide/disable all gizmos by default
      transformControlsRef.current.forEach((controls) => {
        controls.visible = false;
        controls.enabled = false;
      });

      selectedItemIdRef.current = nextId;

      if (typeof nextId === "number") {
        const model = itemModelsRef.current.get(nextId);
        if (model) applySelectionHighlight(model);
        const controls = transformControlsRef.current.get(nextId);
        if (controls) {
          controls.visible = true;
          controls.enabled = true;
        }
      }
    },
    [applySelectionHighlight, clearSelectionHighlight]
  );

  // Press Enter to "commit" the green calibration floor (if present).
  // Use capture phase so it still triggers even if something stops propagation later.
  useEffect(() => {
    const onKeyDownCapture = (event: KeyboardEvent) => {
      const isEnter =
        event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter";
      if (!isEnter) return;
      if (!sceneRef.current) return;

      // Prefer refs, but fall back to looking up by name in case refs got out of sync.
      const mesh =
        floorMeshRef.current ??
        (sceneRef.current.scene.getObjectByName("calibration-floor") as THREE.Mesh | null);
      if (!mesh) return;

      event.preventDefault();
      event.stopPropagation();

      const finalFloorY = mesh.position.y;
      console.log("✅ Saving floor Y:", finalFloorY);

      setRoomDimensions((prev) => ({
        ...prev,
        floorY: finalFloorY,
      }));

      // Remove green floor mesh and controls
      const scene = sceneRef.current.scene;

      // Detach and remove controls first (if attached to mesh, detach before removing mesh)
      const refControls = floorControlsRef.current;
      if (refControls) {
        refControls.detach();
        scene.remove(refControls);
        refControls.dispose();
        floorControlsRef.current = null;
      }

      // Remove/dispose mesh
      const refMesh = floorMeshRef.current;
      const meshToRemove = refMesh ?? mesh;
      if (meshToRemove && meshToRemove.parent) {
        scene.remove(meshToRemove);
        meshToRemove.geometry?.dispose?.();
        const mat = meshToRemove.material as any;
        if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
        else mat?.dispose?.();
      }
      floorMeshRef.current = null;

      isCalibratingFloorRef.current = false;
      setRoomOverlayHint(ROOM_OVERLAY_HINT_CONTROL);

      console.log("🏠 Floor Y saved and green floor removed. Floor Y:", finalFloorY);
    };

    // Use window capture for maximum reliability.
    window.addEventListener("keydown", onKeyDownCapture, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDownCapture, { capture: true } as any);
  }, [setRoomOverlayHint]);

  // Click-to-select: show gizmo + highlight only for the clicked item model.
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const dom = scene.renderer.domElement;

    const isInteractiveUiTarget = (event: PointerEvent) => {
      const targetEl = event.target as HTMLElement | null;
      return (
        !!targetEl &&
        !!targetEl.closest(
          "button, a, input, textarea, select, [role='button'], [role='menu'], [role='menuitem']"
        )
      );
    };

    const isWithinCanvas = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      return !(
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };

    const onPointerDownCapture = (event: PointerEvent) => {
      // If dragging a gizmo, don't change selection.
      if (isDraggingTransformRef.current) return;
      if (event.pointerType === "mouse" && typeof event.button === "number" && event.button !== 0) return; // left-click only

      const withinCanvas = isWithinCanvas(event) && !isInteractiveUiTarget(event);
      let pendingHitItemId: number | null = null;
      let restoreOrbitEnabledTo: boolean | null = null;

      if (withinCanvas) {
        console.log("[pick] pointerdown within canvas", {
          x: event.clientX,
          y: event.clientY,
          pointerType: event.pointerType,
        });
      }

      if (withinCanvas) {
        // Raycast immediately on mousedown, then temporarily disable orbit controls if we hit an item.
        const rect = dom.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        pointerNdcRef.current.set(x, y);

        scene.scene.updateMatrixWorld(true);
        scene.camera.updateMatrixWorld(true);

        const raycaster = raycasterRef.current;
        raycaster.setFromCamera(pointerNdcRef.current, scene.camera);

        const roots = Array.from(itemModelsRef.current.values()).filter(
          (o): o is THREE.Group => !!o && (o as any).isGroup
        );

        if (roots.length > 0) {
          const hits = raycaster.intersectObjects(roots, true);
          if (hits.length > 0) {
            let obj: THREE.Object3D | null = hits[0].object;
            while (obj) {
              const ud = (obj as any).userData;
              if (ud && ud.itemId != null) {
                const parsed = Number(ud.itemId);
                if (Number.isFinite(parsed)) pendingHitItemId = parsed;
                break;
              }
              obj = obj.parent;
            }
          }
        }

        console.log("[pick] raycast result", {
          roots: roots.length,
          hitItemId: pendingHitItemId,
        });

        if (pendingHitItemId != null) {
          const orbit = controlsRef.current;
          if (orbit) {
            restoreOrbitEnabledTo = orbit.enabled;
            orbit.setEnabled(false);
          }
        }
      }

      clickIntentRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
        withinCanvas,
        pendingHitItemId,
        restoreOrbitEnabledTo,
      };
    };

    const onPointerUpCapture = (event: PointerEvent) => {
      if (isDraggingTransformRef.current) return;

      const intent = clickIntentRef.current;
      clickIntentRef.current = null;

      // Restore orbit controls if we disabled them for a potential pick.
      if (intent?.restoreOrbitEnabledTo != null && controlsRef.current) {
        controlsRef.current.setEnabled(intent.restoreOrbitEnabledTo);
      }

      if (!intent?.withinCanvas) return;

      // If the pointer moved, treat it as camera drag (not a click).
      const dx = event.clientX - intent.x;
      const dy = event.clientY - intent.y;
      const distSq = dx * dx + dy * dy;
      const movedTooMuch = distSq > 7 * 7; // 7px threshold
      const tookTooLong = Date.now() - intent.time > 500;
      if (movedTooMuch || tookTooLong) {
        console.log("[pick] pointerup ignored (drag/hold)", {
          movedTooMuch,
          tookTooLong,
          dist: Math.sqrt(distSq),
        });
        return;
      }

      const hitId = intent.pendingHitItemId;
      console.log("[pick] pointerup click", { hitId });
      if (hitId != null && Number.isFinite(hitId)) {
        if (selectedItemIdRef.current === hitId) setSelectedItemId(null);
        else setSelectedItemId(hitId);
        
        // Call onItemClick callback with the database item metadata
        if (onItemClick) {
          const dbItemMeta = dbItemsMetaRef.current.get(hitId);
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/27aedacc-7706-407d-b1ae-abccf09ed163',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:onItemClick',message:'Item clicked - checking metadata',data:{hitId,hasMetadata:!!dbItemMeta,metaId:dbItemMeta?._id,mainItem:dbItemMeta?.analysis?.main_item,description:dbItemMeta?.analysis?.description?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
          if (dbItemMeta) {
            console.log("[pick] Calling onItemClick with item:", dbItemMeta._id);
            onItemClick(dbItemMeta);
          } else {
            console.log("[pick] No database metadata found for item:", hitId);
          }
        }
      } else {
        setSelectedItemId(null);
      }
    };

    // Use window capture so we still receive the event even if UI layers are above the canvas.
    window.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    window.addEventListener("pointerup", onPointerUpCapture, { capture: true });
    console.log("[pick] Selection listeners attached, sceneRef.current exists:", !!scene);
    return () => {
      window.removeEventListener("pointerdown", onPointerDownCapture, { capture: true } as any);
      window.removeEventListener("pointerup", onPointerUpCapture, { capture: true } as any);
    };
  }, [setSelectedItemId, loading, onItemClick]);

  const ensureItemContactShadow = useCallback(
    (
      item: PlacedItem,
      model: THREE.Object3D,
      opts?: {
        radius?: number;
        opacity?: number;
        footprintXZ?: { x: number; z: number };
        footprintScale?: number; // scale value used when footprintXZ was measured
        scaleOverride?: number; // optional current scale override
      }
    ) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current.scene;

      // Keep the shadow at the same Y level as the floor calibration plane (green plane),
      // so it never "floats up" with the object.
      const floorY =
        floorMeshRef.current?.position.y ??
        roomDimensions.floorY ??
        -0.5315285924741149;
      const shadowY = floorY + 0.01; // slight lift (as requested)

      const currentScale =
        typeof opts?.scaleOverride === "number" && Number.isFinite(opts.scaleOverride)
          ? opts.scaleOverride
          : model.scale.x;

      // Compute a stable radius that scales with the object.
      // We store a per-scale-unit base value once to avoid jitter from inconsistent inputs.
      const ud = model.userData as any;
      let baseRadiusPerScaleUnit =
        typeof ud.shadowRadiusPerScaleUnit === "number" && Number.isFinite(ud.shadowRadiusPerScaleUnit)
          ? ud.shadowRadiusPerScaleUnit
          : undefined;

      // If caller provided an explicit radius, treat it as the current radius.
      if (typeof opts?.radius === "number" && Number.isFinite(opts.radius) && opts.radius > 0) {
        if (currentScale > 1e-6) {
          baseRadiusPerScaleUnit = opts.radius / currentScale;
          ud.shadowRadiusPerScaleUnit = baseRadiusPerScaleUnit;
        }
      }

      if (baseRadiusPerScaleUnit === undefined) {
        // Derive radius at the scale the footprint was measured, then convert to per-scale-unit.
        const footprintScale =
          typeof opts?.footprintScale === "number" && Number.isFinite(opts.footprintScale) && opts.footprintScale > 0
            ? opts.footprintScale
            : undefined;

        let radiusAtKnownScale: number | undefined;
        let knownScale: number | undefined;

        if (opts?.footprintXZ && footprintScale) {
          const maxFootprint = Math.max(opts.footprintXZ.x, opts.footprintXZ.z);
          radiusAtKnownScale = Math.max(0.08, maxFootprint * 0.5);
          knownScale = footprintScale;
        } else if (currentScale > 1e-6) {
          // Fallback: derive from current bbox (measured at currentScale)
          const bbox = new THREE.Box3().setFromObject(model);
          const sz = bbox.getSize(new THREE.Vector3());
          const maxFootprint = Math.max(sz.x, sz.z);
          radiusAtKnownScale = Math.max(0.08, maxFootprint * 0.5);
          knownScale = currentScale;
        }

        if (radiusAtKnownScale !== undefined && knownScale !== undefined && knownScale > 1e-6) {
          baseRadiusPerScaleUnit = radiusAtKnownScale / knownScale;
          ud.shadowRadiusPerScaleUnit = baseRadiusPerScaleUnit;
        } else {
          baseRadiusPerScaleUnit = 0;
          ud.shadowRadiusPerScaleUnit = baseRadiusPerScaleUnit;
        }
      }

      const radius = Math.max(0, baseRadiusPerScaleUnit * currentScale);
      const targetOpacity = Math.max(0, Math.min(0.9, opts?.opacity ?? 0.65));

      let shadowMesh = itemShadowRef.current.get(item.id);
      if (!shadowMesh) {
        const shadowMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: targetOpacity,
          depthWrite: false, // don't write to depth buffer to avoid z-fighting with floor
          depthTest: true, // respect depth buffer so shadow is occluded by model
          side: THREE.DoubleSide,
        });
        // Keep Y exact but still render above the floor without z-fighting.
        shadowMat.polygonOffset = true;
        shadowMat.polygonOffsetFactor = -4;
        shadowMat.polygonOffsetUnits = -4;
        // Use a unit circle and scale it, so resizing never rebuilds geometry (prevents jitter).
        shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), shadowMat);
        shadowMesh.name = `item-shadow-${item.id}`;
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.renderOrder = 1;
        scene.add(shadowMesh);
        itemShadowRef.current.set(item.id, shadowMesh);
      } else {
        // Update opacity (radius is handled via mesh scale below)
        const mat = shadowMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = targetOpacity;
        mat.color.setHex(0x000000);
      }

      shadowMesh.scale.set(radius, radius, 1);
      shadowMesh.position.set(model.position.x, shadowY, model.position.z);
    },
    [roomDimensions.floorY]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    isMountedRef.current = true;

    // Initialize Three.js
    const scene = initThree(container);
    sceneRef.current = scene;
    // Reset hint on mount to avoid stale state from prior sessions.
    isCalibratingFloorRef.current = false;
    setRoomOverlayHint(ROOM_OVERLAY_HINT_DEFAULT);

    // Setup controls first
    const controls = createOrbitControls(scene.camera, container);
    controlsRef.current = controls;

    // Load room GLB model
    const loader = new GLTFLoader();
    
    loader.load(
      roomModelPath,
      (gltf) => {
        if (!isMountedRef.current) return;
        const model = gltf.scene;
        roomModelRef.current = model;

        // Ensure PBR materials benefit from the scene environment lighting.
        applyPbrLightingTuning(model, 0.22);
        
        // Calculate bounding box to get room dimensions
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Helper function to find the floor Y position more accurately
        // This finds the lowest Y position of all meshes in the room model
        const getFloorY = (model: THREE.Group): number => {
          let lowestY = Infinity;
          
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // Get bounding box of this mesh
              const meshBox = new THREE.Box3().setFromObject(child);
              if (meshBox.min.y < lowestY) {
                lowestY = meshBox.min.y;
              }
            }
          });
          
          // If we couldn't find a floor, use the overall bounding box minimum
          return lowestY === Infinity ? box.min.y : lowestY;
        };
        
        const floorY = getFloorY(model);
        console.log("🏠 Floor Y detected:", floorY, "(from bounding box min:", box.min.y + ")");
        
        // Store room dimensions and floor height for coordinate conversion
        setRoomDimensions({ width: size.x, depth: size.z, floorY: floorY });
        
        // Center the model
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;
        
        // Scale to fit - keep original scale (4 units) for visual consistency
        // For room dimensions sent to Gemini, use the ORIGINAL unscaled dimensions
        // This ensures Gemini gets realistic dimensions (e.g., actual room size in meters)
        const maxDim = Math.max(size.x, size.y, size.z);
        const finalScale = 4 / maxDim; // Keep visual scale at 4 units
        
        // Store the scale factor for coordinate conversion
        // Calibrate floor Y after centering and scaling
        // The floor is the lowest Y point after transformation
        // After centering: floorY = originalFloorY - centerY
        // After scaling: floorY = (originalFloorY - centerY) * finalScale
        const calibratedFloorY = (floorY - center.y) * finalScale;
        // Note: item shadows are spawned per-item (no global shadow floor).
        
        // IMPORTANT: Use ORIGINAL unscaled dimensions for Gemini API
        // The room model likely has real-world dimensions (e.g., in meters)
        // We scale for visual display, but Gemini needs the actual room size for placement
        // Scaled dimensions would be tiny (e.g., 0.4m x 0.4m) but real rooms are 4-6m x 4-6m
        const scaledWidth = size.x * finalScale;
        const scaledDepth = size.z * finalScale;
        
        // Store LARGE fixed dimensions for Gemini - ignore actual model dimensions
        // Use realistic room sizes (6 meters) regardless of what the model dimensions are
        const REALISTIC_ROOM_WIDTH = 6.0;  // Always use 6 meters width for Gemini (realistic room size)
        const REALISTIC_ROOM_DEPTH = 6.0;  // Always use 6 meters depth for Gemini (realistic room size)
        
        // Store BOTH: large fixed dimensions for Gemini (6m x 6m), and scaled dimensions for coordinates
        const roomDimensionsData = {
          width: REALISTIC_ROOM_WIDTH,  // Fixed 6 meters width for Gemini (realistic room size)
          depth: REALISTIC_ROOM_DEPTH,  // Fixed 6 meters depth for Gemini (realistic room size)
          scaledWidth: scaledWidth,  // Scaled width (for coordinate conversion in scene)
          scaledDepth: scaledDepth,  // Scaled depth (for coordinate conversion in scene)
          scaleFactor: finalScale,   // Scale factor for converting Gemini coords
          floorY: calibratedFloorY,
        };
        setRoomDimensions(roomDimensionsData);
        console.log("📐 Room dimensions - For Gemini (FIXED):", { width: REALISTIC_ROOM_WIDTH, depth: REALISTIC_ROOM_DEPTH }, "Scaled (scene):", { width: scaledWidth, depth: scaledDepth }, "Original model:", { width: size.x, depth: size.z });
        console.log("📐 Calibrated floor Y:", calibratedFloorY, "from room model (original:", floorY + ", center:", center.y + ", scale:", finalScale + ")");
        
        // Prepare green floor mesh (will be shown after room animation)
        const floorGeometry = new THREE.PlaneGeometry(1.5, 1.5);
        const floorMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00ff00, 
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5
        });
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        floorMesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
        // Set starting floor Y based on room
        const isUoftDorm = roomModelPath.includes("uoft-student-dorm");
        const isDavidsBedroom = roomModelPath.includes("davidsbedroom");
        let startingFloorY = -1.0536222685081933; // Default
        if (isUoftDorm) {
          startingFloorY = -0.48130348880026463;
        } else if (isDavidsBedroom) {
          startingFloorY = -1.0536222685081933;
        }
        floorMesh.position.y = startingFloorY;
        floorMesh.position.x = 0;
        floorMesh.position.z = 0;
        floorMesh.name = "calibration-floor";
        floorMesh.visible = false; // Start hidden, show after room animation
        floorMesh.scale.set(0, 0, 0); // Start at scale 0 for pop-in
        scene.scene.add(floorMesh);
        floorMeshRef.current = floorMesh;
        
        // Prepare TransformControls (will be enabled after room animation)
        const floorControls = new TransformControls(scene.camera, scene.renderer.domElement);
        floorControls.attach(floorMesh);
        floorControls.setMode("translate");
        floorControls.setSpace("world");
        floorControls.enabled = false; // Start disabled
        floorControls.visible = false; // Start hidden
        floorControls.size = 0.8;
        scene.scene.add(floorControls);
        floorControlsRef.current = floorControls;
        
        // Skip calibration - show control hint immediately
        setRoomOverlayHint(ROOM_OVERLAY_HINT_CONTROL);
        isCalibratingFloorRef.current = false;
        
        // Disable camera controls when dragging floor mesh
        floorControls.addEventListener("dragging-changed", (event: any) => {
          const isDragging = event.value as boolean;
          if (controlsRef.current) {
            controlsRef.current.setEnabled(!isDragging);
          }
        });
        
        // Log Y position when floor is moved
        floorControls.addEventListener("change", () => {
          const floorY = floorMesh.position.y;
          console.log("📍 Floor Y position:", floorY);
          console.log("   Floor position (x, y, z):", floorMesh.position.x, floorY, floorMesh.position.z);
        });

        console.log("🏠 Green floor mesh prepared, will show after room animation");
        
        // Start with model invisible/scaled down for animation
        model.scale.set(0, 0, 0);
        
        // Set opacity to 0 for fade-in animation
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: THREE.Material) => {
                // Store original render settings so we can restore after fade-in.
                (mat.userData as any).__origTransparent ??= mat.transparent;
                (mat.userData as any).__origOpacity ??= mat.opacity;
                (mat.userData as any).__origSide ??= (mat as any).side;
                mat.transparent = true;
                mat.opacity = 0;
              });
            } else if (child.material) {
              const mat = child.material as THREE.Material;
              (mat.userData as any).__origTransparent ??= mat.transparent;
              (mat.userData as any).__origOpacity ??= mat.opacity;
              (mat.userData as any).__origSide ??= (mat as any).side;
              child.material.transparent = true;
              child.material.opacity = 0;
            }
          }
        });
        
        scene.scene.add(model);
        
        // Disable raycasting on room model so we can click through it
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.raycast = () => {}; // Disable raycasting - allows clicking through room
          }
        });
        
        // Animate model appearance
        const duration = 2500; // 2.5 seconds
        const startTime = Date.now();
        let floorPlaneTriggered = false;
        
        const showFloorPlane = () => {
          // Skip showing the green floor plane - calibration disabled
          if (floorPlaneTriggered) return;
          floorPlaneTriggered = true;
          
          // Keep floor mesh and controls hidden
          // The floor Y is already set from room model detection
          console.log("🏠 Floor calibration skipped - using detected floor Y");
        };
        
        const animateAppearance = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Show floor plane after 1.6 seconds into room animation
          if (elapsed >= 1600 && !floorPlaneTriggered) {
            showFloorPlane();
          }
          
          // Easing function (ease out cubic)
          const eased = 1 - Math.pow(1 - progress, 3);
          
          // Animate scale
          const currentScale = eased * finalScale;
          model.scale.set(currentScale, currentScale, currentScale);
          
          // Animate opacity
          const opacity = eased;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => {
                  mat.opacity = opacity;
                });
              } else if (child.material) {
                child.material.opacity = opacity;
              }
            }
          });
          
          if (progress < 1) {
            requestAnimationFrame(animateAppearance);
          } else {
            // Animation complete - ensure final scale is set
            model.scale.set(finalScale, finalScale, finalScale);

            // Restore original material settings (we only made them transparent for the fade-in)
            // and make likely-floor surfaces visible from below (DoubleSide).
            model.traverse((child) => {
              if (!(child instanceof THREE.Mesh)) return;
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of materials) {
                if (!mat) continue;
                const ud = mat.userData as any;
                if (typeof ud.__origOpacity === "number") mat.opacity = ud.__origOpacity;
                if (typeof ud.__origTransparent === "boolean") mat.transparent = ud.__origTransparent;
                // Heuristic: thin meshes near the calibrated floor are treated as "floor" and made double-sided.
                try {
                  const box = new THREE.Box3().setFromObject(child);
                  const height = box.max.y - box.min.y;
                  const centerY = (box.max.y + box.min.y) / 2;
                  const nearFloor = Math.abs(centerY - calibratedFloorY) < 0.15 || Math.abs(box.min.y - calibratedFloorY) < 0.08;
                  const isThin = height < 0.08;
                  if (nearFloor && isThin) {
                    (mat as any).side = THREE.DoubleSide;
                  }
                } catch {
                  // ignore bbox errors
                }
                mat.needsUpdate = true;
              }
            });
            
            // Recalculate room dimensions after animation completes to verify scale
            // The model is now at final scale, so recalculate bounding box in world space
            model.updateMatrixWorld(true); // Force update world matrix
            const finalBox = new THREE.Box3().setFromObject(model);
            const finalSize = finalBox.getSize(new THREE.Vector3());
            
            // Update room dimensions with actual final dimensions
            setRoomDimensions({
              width: finalSize.x,
              depth: finalSize.z,
              floorY: calibratedFloorY,
            });
            
            console.log("✅ Animation complete - Final room dimensions:", { width: finalSize.x, depth: finalSize.z });
            
            setLoading(false);
            
            // Ensure floor plane is shown if not already triggered
            if (!floorPlaneTriggered) {
              showFloorPlane();
            }
          }
        };
        
        // Adjust camera position based on model size
        const distance = Math.max(size.x, size.y, size.z) * 0.6 * finalScale;
        scene.camera.position.set(distance, distance * 0.5, distance);
        scene.camera.lookAt(0, 0, 0);
        
        // Update controls spherical to match new camera position
        controls.spherical.setFromVector3(scene.camera.position);
        controls.spherical.radius = distance;
        
        // Set zoom limits
        controls.minRadius = distance * 0.3;
        controls.maxRadius = distance * 1.2;
        
        animateAppearance();
      },
      (progress) => {
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log("Loading progress:", percentComplete.toFixed(2) + "%");
        }
      },
      (error) => {
        console.error("Error loading model:", error);
        setLoading(false);
      }
    );

    // Setup resize
    const resizeCleanup = setupResize(scene, container);
    resizeCleanupRef.current = resizeCleanup;

    // Animation loop
    const animate = () => {
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      // Update scene (TransformControls update automatically)
      if (sceneRef.current) {
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    
    // Make room model not intercept raycasts (so we can click through it)
    if (roomModelRef.current) {
      roomModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.raycast = () => {}; // Disable raycasting on room model
        }
      });
    }

    // Cleanup
    return () => {
      isMountedRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Reset footer hint on unmount.
      setRoomOverlayHint(ROOM_OVERLAY_HINT_DEFAULT);
      // Cleanup per-item contact shadows
      if (sceneRef.current) {
        itemShadowRef.current.forEach((mesh) => {
          sceneRef.current?.scene.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });
      }
      itemShadowRef.current.clear();
      // Cleanup TransformControls
      transformControlsRef.current.forEach((controls) => {
        controls.dispose();
      });
      transformControlsRef.current.clear();
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
      if (sceneRef.current) {
        cleanupThree(sceneRef.current);
        sceneRef.current = null;
      }
    };
  }, [roomModelPath, applyPbrLightingTuning, setRoomOverlayHint]);

  // Clear items when room changes
  useEffect(() => {
    // Clear all items when room model path changes
    setItems([]);
    itemModelsRef.current.clear();
    setSelectedItemId(null);
  }, [roomModelPath]);

  // Load and render a single item
  const loadAndRenderItem = useCallback(async (item: PlacedItem): Promise<void> => {
    if (!sceneRef.current) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e379d4a-11d8-484f-b8f7-0a98f77c7c7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:loadAndRenderItem:entry',message:'loadAndRenderItem entry',data:{itemId:item.id,modelPath:item.modelPath,position:item.position,rotation:item.rotation,hasScaleProp:(item as any).scale},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // If already loaded, ensure it has a contact shadow (no duplicates).
    if (itemModelsRef.current.has(item.id)) {
      const existingModel = itemModelsRef.current.get(item.id);
      if (existingModel && !itemShadowRef.current.has(item.id)) {
        ensureItemContactShadow(item, existingModel, { opacity: 0.36 });
      }
      console.log(`⚠️ Item ${item.id} already loaded, skipping...`);
      return;
    }
    
    // Mark as loading to prevent duplicate loads
    itemModelsRef.current.set(item.id, null as any); // Temporary marker

    const scene = sceneRef.current;
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        item.modelPath,
        (gltf) => {
        const model = gltf.scene.clone();

        // Ensure placed items look good under environment lighting.
        applyPbrLightingTuning(model, 0.4);
        // Set X, Z, and rotation from item - Y will be recalculated below
        model.position.x = item.position[0];
        model.position.z = item.position[2];
        model.rotation.set(...item.rotation);
        
        // Scale to match room scale (adjust as needed)
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const baseFitScale = 0.5 / maxDim; // base-fit size
        const requestedMultiplier = typeof item.scale === "number" && Number.isFinite(item.scale) ? item.scale : 1;
        const finalItemScale = baseFitScale * requestedMultiplier;

        // Persist scales for later (e.g. scale popup)
        (model.userData as any).baseFitScale = baseFitScale;
        (model.userData as any).scaleMultiplier = requestedMultiplier;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3e379d4a-11d8-484f-b8f7-0a98f77c7c7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:loadAndRenderItem:scaleCalc',message:'Computed baseFitScale + multiplier',data:{itemId:item.id,size:{x:size.x,y:size.y,z:size.z},maxDim,baseFitScale,requestedMultiplier,finalItemScale,modelScaleBefore:{x:model.scale.x,y:model.scale.y,z:model.scale.z}},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        model.scale.set(finalItemScale, finalItemScale, finalItemScale);
        
        // Recalculate bounding box after scaling to get accurate bottom offset and extents
        // First, temporarily reset position to calculate local bounding box
        const tempPosition = model.position.clone();
        model.position.set(0, 0, 0);
        const localBox = new THREE.Box3().setFromObject(model);
        model.position.copy(tempPosition);
        
        // bottomOffset is the distance from pivot to bottom (negative if bottom is below pivot)
        const bottomOffset = localBox.min.y;
        const itemExtentX = localBox.max.x - localBox.min.x; // Item width in local space
        const itemExtentZ = localBox.max.z - localBox.min.z; // Item depth in local space
        const itemHalfWidth = itemExtentX / 2; // Half width for bounds checking
        const itemHalfDepth = itemExtentZ / 2; // Half depth for bounds checking

        // Persist footprint for contact shadow updates while dragging.
        (model.userData as any).footprintXZ = { x: itemExtentX, z: itemExtentZ };
        // Cache a stable radius-per-scale unit so shadow scales smoothly without jitter.
        {
          const maxFootprint = Math.max(itemExtentX, itemExtentZ);
          const radiusAtFinalScale = Math.max(0.08, maxFootprint * 0.5);
          (model.userData as any).shadowRadiusPerScaleUnit = radiusAtFinalScale / finalItemScale;
        }
        
        // Adjust initial Y position based on floor Y and bottom offset
        // bottomOffset is negative (e.g., -0.5 means bottom is 0.5 units below pivot)
        // So: pivotY + bottomOffset = bottomY
        // We want: bottomY = floorY (or slightly above for plants on tables)
        // Therefore: pivotY = floorY - bottomOffset
        
        // Check if this is a plant that should go on a table
        const label = item.modelPath?.toLowerCase() || "";
        const isPlant = label.includes('plant');
        const hasTable = items.some((i) => i.modelPath && isTableLikeModelPath(i.modelPath));
        
        const currentFloorY = roomDimensions.floorY || -0.5315285924741149;
        const tableHeight = 0.75; // Typical table height
        
        // Calculate Y position: use item.position[1] if it's a plant on table, otherwise use floorY
        let targetBottomY: number;
        if (isPlant && hasTable) {
          // Plant on table: bottom should be at floorY + tableHeight
          targetBottomY = currentFloorY + tableHeight;
        } else {
          // Object on floor: bottom should be at floorY (or slightly above)
          targetBottomY = currentFloorY + 0.01; // Tiny offset to prevent z-fighting (avoid visible floating)
        }
        
        // Calculate pivot Y from target bottom Y and bottom offset
        const initialModelY = targetBottomY - bottomOffset;
        model.position.y = initialModelY;
          
          console.log("🔧 Item bottomOffset:", bottomOffset, "Initial Y:", initialModelY, "Floor Y:", currentFloorY);
          
          // Start invisible for animation
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => {
                  mat.transparent = true;
                  mat.opacity = 0;
                });
              } else if (child.material) {
                child.material.transparent = true;
                child.material.opacity = 0;
              }
            }
          });
          
          model.scale.set(0, 0, 0);
          
        // Per-item soft contact shadow (cheap, looks better than a hard-edged square).
        // It "appears with" the generated item and follows it while dragging.
        ensureItemContactShadow(item, model, {
          opacity: 0,
          footprintXZ: { x: itemExtentX, z: itemExtentZ },
          footprintScale: finalItemScale,
          scaleOverride: 0,
        });

          scene.scene.add(model);
          itemModelsRef.current.set(item.id, model);

          // Mark meshes as selectable (raycast hit -> itemId)
          (model.userData as any).itemId = item.id;
          model.traverse((child) => {
            (child.userData as any).itemId = item.id;
          });

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3e379d4a-11d8-484f-b8f7-0a98f77c7c7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:loadAndRenderItem:preAnim',message:'Model added; scale zeroed for animation',data:{itemId:item.id,baseFitScale:(model.userData as any).baseFitScale,scaleMultiplier:(model.userData as any).scaleMultiplier,targetScale:finalItemScale,modelScaleNow:{x:model.scale.x,y:model.scale.y,z:model.scale.z}},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          // Add TransformControls for this model - attach directly to model
          const transformControls = new TransformControls(scene.camera, scene.renderer.domElement);
          transformControls.attach(model);
          transformControls.setMode("translate"); // Start with translate mode
          transformControls.setSpace("world");
          transformControls.enabled = false; // enabled only when selected
          transformControls.visible = false; // visible only when selected
          transformControls.size = 0.5; // Make controls smaller (default is 1.0)
          
          // Store current mode for switching
          let currentMode: "translate" | "rotate" | "scale" = "translate";
          
          // Add keyboard shortcut to switch between translate, rotate, and scale modes
          const handleKeyDown = (event: KeyboardEvent) => {
            // Only the selected item should react to shortcuts.
            if (selectedItemIdRef.current !== item.id) return;
            // Press 'R' to switch to rotate mode, 'T' to switch to translate mode, 'S' for scale popup
            if (event.key === 'r' || event.key === 'R') {
              currentMode = "rotate";
              transformControls.setMode("rotate");
              event.preventDefault();
            } else if (event.key === 't' || event.key === 'T') {
              currentMode = "translate";
              transformControls.setMode("translate");
              event.preventDefault();
            } else if (event.key === 's' || event.key === 'S') {
              // Show custom popup to enter scale value for proportional scaling
              event.preventDefault();
              
              // Remove any existing scale popup
              const existingPopup = document.getElementById(`scale-popup-${item.id}`);
              if (existingPopup) {
                existingPopup.remove();
              }
              
              const baseFitScale = typeof (model.userData as any).baseFitScale === "number" ? (model.userData as any).baseFitScale : model.scale.x;
              const currentMultiplier = typeof (model.userData as any).scaleMultiplier === "number" ? (model.userData as any).scaleMultiplier : 1;
              
              // Calculate position above the object (top-center) in 3D space
              // Use world bounding box so this stays correct across scaling/rotation.
              const objectPosition = new THREE.Vector3();
              const worldBox = new THREE.Box3().setFromObject(model);
              const worldCenter = worldBox.getCenter(new THREE.Vector3());
              objectPosition.set(worldCenter.x, worldBox.max.y, worldCenter.z);
              
              // Project 3D position to screen coordinates
              const updatePopupPosition = () => {
                const popupEl = document.getElementById(`scale-popup-${item.id}`);
                if (!popupEl || !sceneRef.current) return;
                
                const vector = objectPosition.clone();
                vector.project(sceneRef.current.camera);
                
                const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
                
                popupEl.style.left = `${x}px`;
                popupEl.style.top = `${y - 12}px`; // Slight pixel lift above the object top
                popupEl.style.transform = 'translate(-50%, -100%)';
              };
              
              // Create popup element
              const popup = document.createElement("div");
              popup.id = `scale-popup-${item.id}`;
              popup.style.cssText = `
                position: fixed;
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 12px;
                padding: 16px 20px;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2),
                            0 0 0 1px rgba(255, 255, 255, 0.2) inset,
                            0 1px 0 rgba(255, 255, 255, 0.3) inset;
                pointer-events: auto;
              `;
              
              popup.innerHTML = `
                <div style="font-family: 'Playfair Display', serif; color: rgba(255, 255, 255, 0.95); font-size: 13px; margin-bottom: 10px; text-align: center; letter-spacing: 0.5px;">
                  SCALE MULTIPLIER (CURRENT: ${currentMultiplier.toFixed(2)})
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <input
                    type="number"
                    id="scale-input-${item.id}"
                    value="${currentMultiplier.toFixed(2)}"
                    step="0.1"
                    min="0.1"
                    max="10"
                    style="
                      background: rgba(255, 255, 255, 0.1);
                      border: 1px solid rgba(255, 255, 255, 0.2);
                      border-radius: 6px;
                      padding: 8px 12px;
                      color: rgba(255, 255, 255, 0.95);
                      font-family: 'Playfair Display', serif;
                      font-size: 14px;
                      width: 80px;
                      outline: none;
                      transition: all 0.2s;
                    "
                    onfocus="this.style.borderColor='rgba(255, 255, 255, 0.4)'; this.style.background='rgba(255, 255, 255, 0.15)'"
                    onblur="this.style.borderColor='rgba(255, 255, 255, 0.2)'; this.style.background='rgba(255, 255, 255, 0.1)'"
                  />
                  <button
                    id="scale-submit-${item.id}"
                    style="
                      background: rgba(255, 255, 255, 0.15);
                      border: 1px solid rgba(255, 255, 255, 0.2);
                      border-radius: 6px;
                      padding: 8px 16px;
                      color: rgba(255, 255, 255, 0.95);
                      font-family: 'Playfair Display', serif;
                      font-size: 12px;
                      letter-spacing: 0.5px;
                      cursor: pointer;
                      transition: all 0.2s;
                      text-transform: uppercase;
                    "
                    onmouseover="this.style.background='rgba(255, 255, 255, 0.25)'; this.style.borderColor='rgba(255, 255, 255, 0.3)'"
                    onmouseout="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.borderColor='rgba(255, 255, 255, 0.2)'"
                  >
                    Apply
                  </button>
                </div>
              `;
              
              document.body.appendChild(popup);
              updatePopupPosition();
              
              // Focus input and select text
              const input = document.getElementById(`scale-input-${item.id}`) as HTMLInputElement;
              if (input) {
                input.focus();
                input.select();
              }
              
              // Handle Enter key in input
              const handleInputKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  applyScale();
                } else if (e.key === 'Escape') {
                  removePopup();
                }
              };
              
              // Apply scale function
              const applyScale = () => {
                const inputEl = document.getElementById(`scale-input-${item.id}`) as HTMLInputElement;
                if (!inputEl) return;
                
                const newMultiplier = parseFloat(inputEl.value);
                if (!isNaN(newMultiplier) && newMultiplier > 0 && newMultiplier <= 10) {
                  (model.userData as any).scaleMultiplier = newMultiplier;
                  const nextScale = baseFitScale * newMultiplier;
                  model.scale.set(nextScale, nextScale, nextScale);

              // Keep shadow scale synced immediately (prevents visual snap/jitter).
              const shadow = itemShadowRef.current.get(item.id);
              const shadowOpacity =
                shadow && shadow.material instanceof THREE.MeshBasicMaterial
                  ? shadow.material.opacity
                  : 0.65;
              ensureItemContactShadow(item, model, { opacity: shadowOpacity, scaleOverride: nextScale });
                  
                  // Update item state with new multiplier
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === item.id
                        ? {
                            ...i,
                            scale: newMultiplier,
                            position: [model.position.x, model.position.y, model.position.z],
                            rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
                          }
                        : i
                    )
                  );
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/3e379d4a-11d8-484f-b8f7-0a98f77c7c7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:scalePopup:apply',message:'Applied scale multiplier',data:{itemId:item.id,baseFitScale,newMultiplier,nextScale,modelScaleNow:{x:model.scale.x,y:model.scale.y,z:model.scale.z}},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
                  // #endregion

                  console.log(`✅ Scale multiplier set to ${newMultiplier.toFixed(2)} for item ${item.id}`);
                  removePopup();
                } else {
                  inputEl.style.borderColor = 'rgba(255, 100, 100, 0.6)';
                  setTimeout(() => {
                    inputEl.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }, 500);
                }
              };
              
              // Remove popup function
              const removePopup = () => {
                const popupEl = document.getElementById(`scale-popup-${item.id}`);
                if (popupEl) {
                  popupEl.style.opacity = '0';
                  popupEl.style.transform = popupEl.style.transform + ' scale(0.95)';
                  popupEl.style.transition = 'all 0.2s ease-out';
                  setTimeout(() => popupEl.remove(), 200);
                }
                document.removeEventListener('keydown', handleInputKeyDown);
                cleanupPositionUpdate();
              };
              
              // Update position on camera/object movement
              let positionUpdateInterval: NodeJS.Timeout | null = null;
              const cleanupPositionUpdate = () => {
                if (positionUpdateInterval) {
                  clearInterval(positionUpdateInterval);
                  positionUpdateInterval = null;
                }
              };
              
              positionUpdateInterval = setInterval(updatePopupPosition, 100); // Update every 100ms
              
              // Attach event listeners
              const submitBtn = document.getElementById(`scale-submit-${item.id}`);
              if (submitBtn) {
                submitBtn.addEventListener('click', applyScale);
              }
              if (input) {
                input.addEventListener('keydown', handleInputKeyDown);
              }
              
              // Cleanup on outside click
              const handleOutsideClick = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (!popup.contains(target)) {
                  removePopup();
                  document.removeEventListener('click', handleOutsideClick);
                }
              };
              setTimeout(() => document.addEventListener('click', handleOutsideClick), 100);
              
              // Store cleanup for when item is removed
              (popup as any).__cleanup = () => {
                cleanupPositionUpdate();
                document.removeEventListener('click', handleOutsideClick);
                document.removeEventListener('keydown', handleInputKeyDown);
              };
            }
          };
          
          document.addEventListener("keydown", handleKeyDown);
          
          // Store cleanup function
          const cleanupKeyHandler = () => {
            document.removeEventListener("keydown", handleKeyDown);
          };
          
          // Store cleanup in a way we can call it later
          (transformControls as any).__cleanupKeyHandler = cleanupKeyHandler;
          
          // Make TransformControls more transparent
          transformControls.traverse((child) => {
            if (child instanceof THREE.Line) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => {
                  if (mat instanceof THREE.LineBasicMaterial) {
                    mat.transparent = true;
                    mat.opacity = 0.4; // Adjust opacity (0.0 = fully transparent, 1.0 = fully opaque)
                  }
                });
              } else if (child.material instanceof THREE.LineBasicMaterial) {
                child.material.transparent = true;
                child.material.opacity = 0.4;
              }
            }
            // Also check for Mesh objects (arrows/spheres on the gizmo)
            if (child instanceof THREE.Mesh) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => {
                  mat.transparent = true;
                  mat.opacity = 0.4;
                });
              } else if (child.material) {
                child.material.transparent = true;
                child.material.opacity = 0.4;
              }
            }
          });
          
          // Update item state when TransformControls changes
          // Apply constraints only when dragging ends to avoid interfering with controls
          let updateTimeout: NodeJS.Timeout | null = null;
          let isDragging = false;
          
          // Function to apply constraints and update state
          const applyConstraintsAndUpdate = () => {
            // Constrain Y position to prevent dragging below floor
            const currentFloorY = roomDimensions.floorY || -0.5315285924741149;
            const minPivotY = currentFloorY - bottomOffset - 0.1;
            
            if (model.position.y < minPivotY) {
              model.position.y = minPivotY;
            }
            
            // Constrain X and Z positions to prevent clipping through walls
            const roomWidth = roomDimensions.width || 4;
            const roomDepth = roomDimensions.depth || 4;
            const roomHalfWidth = roomWidth / 2;
            const roomHalfDepth = roomDepth / 2;
            const margin = 0.05;
            
            const minX = -roomHalfWidth + itemHalfWidth + margin;
            const maxX = roomHalfWidth - itemHalfWidth - margin;
            if (model.position.x < minX) {
              model.position.x = minX;
            } else if (model.position.x > maxX) {
              model.position.x = maxX;
            }
            
            const minZ = -roomHalfDepth + itemHalfDepth + margin;
            const maxZ = roomHalfDepth - itemHalfDepth - margin;
            if (model.position.z < minZ) {
              model.position.z = minZ;
            } else if (model.position.z > maxZ) {
              model.position.z = maxZ;
            }
            
            // Update state
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        position: [model.position.x, model.position.y, model.position.z],
                        rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
                      }
                    : i
                )
              );
            }, 100);

            // Keep contact shadow aligned (with cast/front offset) after constraints.
            const shadow = itemShadowRef.current.get(item.id);
            if (shadow) {
              const mat = shadow.material as THREE.MeshBasicMaterial;
              ensureItemContactShadow(item, model, { opacity: mat.opacity });
            }
          };
          
          transformControls.addEventListener("change", () => {
            // Only update state while dragging, constraints applied when drag ends
            if (isDragging) {
              if (updateTimeout) clearTimeout(updateTimeout);
              updateTimeout = setTimeout(() => {
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? {
                          ...i,
                          position: [model.position.x, model.position.y, model.position.z],
                          rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
                        }
                      : i
                  )
                );
              }, 100);
            }

            // Keep contact shadow aligned (with cast/front offset) during dragging too.
            const shadow = itemShadowRef.current.get(item.id);
            if (shadow) {
              const mat = shadow.material as THREE.MeshBasicMaterial;
              ensureItemContactShadow(item, model, { opacity: mat.opacity });
            }
          });
          
          // Apply constraints when dragging ends
          transformControls.addEventListener("dragging-changed", (event: any) => {
            isDragging = event.value as boolean;
            isDraggingTransformRef.current = isDragging;
            if (controlsRef.current) {
              controlsRef.current.setEnabled(!isDragging);
            }
            // Apply constraints when dragging ends
            if (!isDragging) {
              applyConstraintsAndUpdate();
            }
          });
          
          scene.scene.add(transformControls);
          transformControlsRef.current.set(item.id, transformControls);
          
          // Animate appearance
          const duration = 1500;
          const startTime = Date.now();
          const finalScale = finalItemScale;
          
          const animateAppearance = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            // Animate scale
            const currentScale = eased * finalScale;
            model.scale.set(currentScale, currentScale, currentScale);
            
            // Animate opacity
            const opacity = eased;
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: THREE.Material) => {
                    mat.opacity = opacity;
                  });
                } else if (child.material) {
                  child.material.opacity = opacity;
                }
              }
            });

            // Fade in the contact shadow with the item (so it "appears with it").
            const shadow = itemShadowRef.current.get(item.id);
            if (shadow) {
              const mat = shadow.material as THREE.MeshBasicMaterial;
              const targetShadowOpacity = isPlant && hasTable ? 0.16 : 0.36;
              mat.opacity = eased * targetShadowOpacity;
              // Keep shadow size synced to animated model scale.
              ensureItemContactShadow(item, model, { opacity: mat.opacity, scaleOverride: currentScale });
            }
            
            if (progress < 1) {
              requestAnimationFrame(animateAppearance);
            } else {
              resolve();
            }
          };
          
          animateAppearance();
        },
        undefined,
        (error) => {
          console.error(`Error loading item ${item.id}:`, error);
          reject(error);
        }
      );
    });
  }, [roomDimensions, applyPbrLightingTuning, ensureItemContactShadow, getSurfaceYForItem]);

  // Backfill: if items existed before shadow changes, ensure they have a shadow.
  useEffect(() => {
    if (!sceneRef.current) return;
    items.forEach((item) => {
      const model = itemModelsRef.current.get(item.id);
      if (model) {
        ensureItemContactShadow(item, model, { opacity: 0.36 });
      }
    });
  }, [items, ensureItemContactShadow]);

  // Load and render placed items
  useEffect(() => {
    if (!sceneRef.current || items.length === 0) return;

    // Load any new items that haven't been loaded yet
    items.forEach((item) => {
      if (!itemModelsRef.current.has(item.id)) {
        loadAndRenderItem(item).catch(console.error);
      }
    });
  }, [items]);

  // Cleanup item models when removed
  useEffect(() => {
    const currentItemIds = new Set(items.map((item) => item.id));
    itemModelsRef.current.forEach((model, id) => {
      if (!currentItemIds.has(id) && sceneRef.current) {
        // Cleanup contact shadow mesh for removed item
        const shadow = itemShadowRef.current.get(id);
        if (shadow) {
          sceneRef.current.scene.remove(shadow);
          shadow.geometry.dispose();
          (shadow.material as THREE.Material).dispose();
          itemShadowRef.current.delete(id);
        }

        sceneRef.current.scene.remove(model);
        // Dispose of geometry and materials
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
        itemModelsRef.current.delete(id);
        
        // Cleanup TransformControls
        const controls = transformControlsRef.current.get(id);
        if (controls && sceneRef.current) {
          // Cleanup keyboard handler if it exists
          if ((controls as any).__cleanupKeyHandler) {
            (controls as any).__cleanupKeyHandler();
          }
          sceneRef.current.scene.remove(controls);
          controls.dispose();
          transformControlsRef.current.delete(id);
        }
      }
    });
  }, [items]);

  // Capture top-down image of the room using a render target (no extra WebGL context)
  const captureTopDownImage = useCallback(async (): Promise<string> => {
    if (!sceneRef.current) throw new Error("Scene not initialized");

    const scene = sceneRef.current;
    const renderer = scene.renderer;
    const mainCamera = scene.camera;

    // Save ALL main camera state
    const savedPosition = mainCamera.position.clone();
    const savedQuaternion = mainCamera.quaternion.clone();
    const savedUp = mainCamera.up.clone();

    // Create render target for offscreen rendering
    const captureSize = 1024;
    const renderTarget = new THREE.WebGLRenderTarget(captureSize, captureSize, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    // Create a temporary camera for the capture (doesn't affect main camera)
    const captureCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const roomHeight = roomDimensions.depth * 1.5;
    captureCamera.position.set(0, roomHeight, 0);
    captureCamera.lookAt(0, 0, 0);
    captureCamera.up.set(0, 0, -1);
    captureCamera.updateProjectionMatrix();
    
    // Render to target using the SAME renderer (no new WebGL context)
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene.scene, captureCamera);
    renderer.setRenderTarget(null); // Reset to default (screen)
    
    // Read pixels from render target
    const pixels = new Uint8Array(captureSize * captureSize * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, captureSize, captureSize, pixels);
    
    // Convert to canvas and then to data URL
    const canvas = document.createElement('canvas');
    canvas.width = captureSize;
    canvas.height = captureSize;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(captureSize, captureSize);
    
    // Flip vertically (WebGL has origin at bottom-left, canvas at top-left)
    for (let y = 0; y < captureSize; y++) {
      for (let x = 0; x < captureSize; x++) {
        const srcIdx = ((captureSize - y - 1) * captureSize + x) * 4;
        const dstIdx = (y * captureSize + x) * 4;
        imageData.data[dstIdx] = pixels[srcIdx];
        imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const dataURL = canvas.toDataURL("image/jpeg", 0.7);
    
    // Cleanup render target
    renderTarget.dispose();

    // Ensure main camera is unchanged (it should be, but double-check)
    mainCamera.position.copy(savedPosition);
    mainCamera.quaternion.copy(savedQuaternion);
    mainCamera.up.copy(savedUp);

    return dataURL;
  }, [roomDimensions]);

  // Capture an isolated image of a model (for sending to Gemini) using render target
  const captureModelImage = useCallback(async (modelPath: string): Promise<{ image: string; dimensions: { width: number; depth: number; height: number } }> => {
    if (!sceneRef.current) throw new Error("Scene not initialized");
    
    const mainRenderer = sceneRef.current.renderer;

    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          try {
            const model = gltf.scene.clone();
            
            // Calculate bounding box to get raw dimensions
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            
            // Apply the SAME scale that will be used in the actual scene
            // This matches the scaling logic in loadAndRenderItem
            const maxDim = Math.max(size.x, size.y, size.z);
            const itemScale = 0.5 / maxDim; // Same scale as used in loadAndRenderItem
            
            // Calculate dimensions AFTER scaling (this is what will actually be in the scene)
            const scaledDimensions = {
              width: size.x * itemScale,
              depth: size.z * itemScale,
              height: size.y * itemScale,
            };
            
            console.log("📏 Model dimensions - Raw:", size, "Scaled:", scaledDimensions, "Scale factor:", itemScale);
            
            // Scale model for visualization (use same scale for consistency)
            model.scale.set(itemScale, itemScale, itemScale);
            
            // Center the model
            const center = box.getCenter(new THREE.Vector3());
            model.position.set(-center.x * itemScale, -center.y * itemScale, -center.z * itemScale);
            
            // Create a temporary scene for rendering (separate from main scene)
            const tempScene = new THREE.Scene();
            tempScene.background = new THREE.Color(0xf0f0f0); // Light gray background
            tempScene.add(model);
            
            // Add basic lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 5, 5);
            tempScene.add(ambientLight);
            tempScene.add(directionalLight);
            
            // Create a camera for top-down view
            const tempCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
            const modelHeight = size.y * itemScale;
            tempCamera.position.set(0, modelHeight * 2, 0);
            tempCamera.lookAt(0, 0, 0);
            tempCamera.up.set(0, 0, -1);
            tempCamera.updateProjectionMatrix();
            
            // Use render target instead of creating new renderer
            const captureSize = 512;
            const renderTarget = new THREE.WebGLRenderTarget(captureSize, captureSize, {
              format: THREE.RGBAFormat,
              type: THREE.UnsignedByteType,
            });
            
            // Render to target using main renderer
            mainRenderer.setRenderTarget(renderTarget);
            mainRenderer.render(tempScene, tempCamera);
            mainRenderer.setRenderTarget(null);
            
            // Read pixels
            const pixels = new Uint8Array(captureSize * captureSize * 4);
            mainRenderer.readRenderTargetPixels(renderTarget, 0, 0, captureSize, captureSize, pixels);
            
            // Convert to canvas and data URL
            const canvas = document.createElement('canvas');
            canvas.width = captureSize;
            canvas.height = captureSize;
            const ctx = canvas.getContext('2d')!;
            const imgData = ctx.createImageData(captureSize, captureSize);
            
            // Flip vertically
            for (let y = 0; y < captureSize; y++) {
              for (let x = 0; x < captureSize; x++) {
                const srcIdx = ((captureSize - y - 1) * captureSize + x) * 4;
                const dstIdx = (y * captureSize + x) * 4;
                imgData.data[dstIdx] = pixels[srcIdx];
                imgData.data[dstIdx + 1] = pixels[srcIdx + 1];
                imgData.data[dstIdx + 2] = pixels[srcIdx + 2];
                imgData.data[dstIdx + 3] = pixels[srcIdx + 3];
              }
            }
            ctx.putImageData(imgData, 0, 0);
            const imageData = canvas.toDataURL("image/jpeg", 0.8);
            
            // Cleanup
            renderTarget.dispose();
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat) => mat.dispose());
                } else if (child.material) {
                  child.material.dispose();
                }
              }
            });
            
            resolve({ image: imageData, dimensions: scaledDimensions });
          } catch (error) {
            reject(error);
          }
        },
        undefined,
        (error) => reject(error)
      );
    });
  }, []);

  // Add chair function
  const addChair = useCallback(async () => {
    if (!sceneRef.current) {
      console.error("❌ Scene not ready");
      return;
    }

    console.log("🚀 addChair() called - starting process...");

    try {
      // Capture top-down image of room
      console.log("📸 Capturing top-down image of room...");
      const roomImageData = await captureTopDownImage();
      console.log("✅ Room image captured (length:", roomImageData.length, "chars)");

      // Capture model image and get dimensions
      const modelPath = "/minimalist_potted_succulent_desktop_plant_scan.glb";
      console.log("📸 Capturing model image and dimensions...");
      const { image: modelImageData, dimensions: modelDimensions } = await captureModelImage(modelPath);
      console.log("✅ Model image captured, dimensions:", modelDimensions);

      // Send to API with room context and model information
      console.log("📡 Sending request to Gemini API with room context and model info...");
      const response = await fetch("/api/get-placement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: roomImageData,
          modelImage: modelImageData, // Send model image so Gemini knows what it's placing
          modelDimensions: modelDimensions, // Send model dimensions
          label: "Plant",
          roomWidth: roomDimensions.width,  // Use original dimensions for Gemini
          roomDepth: roomDimensions.depth,  // Use original dimensions for Gemini
          existingItems: items.map((item) => ({
            label: item.modelPath?.includes('couch') ? "Couch" : item.modelPath?.includes('plant') ? "Plant" : "Item",
            position: item.position,
            rotation: item.rotation,
          })),
        }),
      });

      console.log("📥 API Response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const placement = await response.json();

      // Print coordinates from Gemini
      console.log("📍 Gemini Placement Coordinates:", placement);
      console.log("   Normalized: x =", placement.x, ", y =", placement.y, ", rotation =", placement.rotation);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3e379d4a-11d8-484f-b8f7-0a98f77c7c7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:addChair:placement',message:'Received placement from API',data:{placement,roomDims:roomDimensions},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Convert normalized coordinates (0-1) from Gemini to world coordinates in the scaled scene
      // Gemini uses larger room dimensions (e.g., 5-6m), but scene uses scaled dimensions
      const geminiWidth = roomDimensions.width || 5; // Gemini sees larger dimensions
      const geminiDepth = roomDimensions.depth || 5;
      const scaledWidth = roomDimensions.scaledWidth || (geminiWidth * (roomDimensions.scaleFactor || 1));
      const scaledDepth = roomDimensions.scaledDepth || (geminiDepth * (roomDimensions.scaleFactor || 1));
      
      // Gemini returns coordinates based on larger dimensions, convert to scaled scene coords
      // Normalized coords (0-1) -> Gemini world coords -> Scaled scene coords
      const geminiX = (placement.x - 0.5) * geminiWidth;
      const geminiZ = (placement.y - 0.5) * geminiDepth;
      const finalX = (geminiX / geminiWidth) * scaledWidth;  // Convert ratio to scaled coords
      const finalZ = (geminiZ / geminiDepth) * scaledDepth;  // Convert ratio to scaled coords

      // Position Y - will be recalculated in loadAndRenderItem based on bottomOffset
      // For now, just set a placeholder Y that will be corrected
      const floorY = roomDimensions.floorY || -0.5315285924741149; // Floor Y from user measurement
      
      // This is a placeholder - actual Y will be calculated in loadAndRenderItem
      const finalY = floorY + 0.3; // Default to floor for now - will be recalculated

      console.log("🌍 World Coordinates:", { x: finalX, y: finalY, z: finalZ, rotation: placement.rotation });
      console.log("📐 Room Dimensions:", roomDimensions);
      console.log("🏠 Floor Y:", floorY, "Couch Y:", finalY);

      // Create new item - plant at calculated coordinates
      const newItem: PlacedItem = {
        id: Date.now(),
        modelPath: "/minimalist_potted_succulent_desktop_plant_scan.glb", // Plant model
        position: [finalX, finalY, finalZ], // Position will be adjusted by floor constraint
        rotation: [0, placement.rotation || 0, 0],
        scale: typeof placement.scale === "number" && Number.isFinite(placement.scale) ? placement.scale : 1,
      };

      // Add item to state (this will trigger the useEffect to load it)
      setItems((prev) => {
        // Double-check for duplicates in the state update
        if (prev.some((i) => i.id === newItem.id)) {
          console.log(`⚠️ Item ${newItem.id} already in state, skipping duplicate...`);
          return prev;
        }
        console.log(`✅ Adding new item ${newItem.id} to state`);
        return [...prev, newItem];
      });
      
      // Don't call loadAndRenderItem here - let the useEffect handle it
      // The useEffect will automatically load the new item when it's added to state
      
      if (onAddItem) {
        onAddItem(newItem);
      }
    } catch (error) {
      console.error("❌ Error adding chair:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Full error details:", error);
      alert(`Failed to add chair: ${errorMessage}`);
    }
  }, [roomDimensions, items, onAddItem, captureTopDownImage, loadAndRenderItem]);

  // Save an item to the saved-items collection
  const saveItemToDb = useCallback(async (item: PlacedItem, glbUrl: string, label: string, dbItemId?: string) => {
    try {
      const response = await fetch("/api/saved-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          glbUrl: glbUrl,
          position: item.position,
          rotation: item.rotation,
          scale: item.scale,
          label: label,
          dbItemId: dbItemId, // Original item ID from items collection
        }),
      });
      
      if (!response.ok) {
        console.error("❌ Failed to save item to database");
        return null;
      }
      
      const savedItem = await response.json();
      console.log(`💾 Saved item to database: ${savedItem._id}`);
      return savedItem;
    } catch (error) {
      console.error("❌ Error saving item:", error);
      return null;
    }
  }, []);

  // Delete an item from scene, state, and database
  const deleteItem = useCallback(async (itemId: number) => {
    if (!sceneRef.current) return;
    
    const model = itemModelsRef.current.get(itemId);
    const item = items.find(i => i.id === itemId);
    
    if (model) {
      // Remove transform controls
      const controls = transformControlsRef.current.get(itemId);
      if (controls) {
        controls.detach();
        sceneRef.current.scene.remove(controls);
        controls.dispose();
        transformControlsRef.current.delete(itemId);
      }
      
      // Remove shadow
      const shadow = itemShadowRef.current.get(itemId);
      if (shadow) {
        sceneRef.current.scene.remove(shadow);
        shadow.geometry.dispose();
        if (shadow.material instanceof THREE.Material) {
          shadow.material.dispose();
        }
        itemShadowRef.current.delete(itemId);
      }
      
      // Remove model from scene
      sceneRef.current.scene.remove(model);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      itemModelsRef.current.delete(itemId);
      
      console.log(`🗑️ Removed item ${itemId} from scene`);
    }
    
    // Remove from state
    setItems(prev => prev.filter(i => i.id !== itemId));
    
    // Clear selection
    setSelectedItemId(null);
    
    // Delete from saved-items in MongoDB
    if (item && item.modelPath) {
      try {
        // Extract the original glbUrl from the proxied URL
        let glbUrl = item.modelPath;
        if (glbUrl.includes('/api/proxy-model?url=')) {
          glbUrl = decodeURIComponent(glbUrl.replace('/api/proxy-model?url=', ''));
        }
        
        const response = await fetch(`/api/saved-items?glbUrl=${encodeURIComponent(glbUrl)}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`💾 Deleted from saved-items: ${result.deletedCount} item(s)`);
        } else {
          console.error("❌ Failed to delete from saved-items");
        }
      } catch (error) {
        console.error("❌ Error deleting from saved-items:", error);
      }
    }
    
    console.log(`✅ Item ${itemId} deleted successfully`);
  }, [items, setSelectedItemId]);

  // Handle delete confirmation
  const confirmDelete = useCallback(() => {
    if (itemToDelete !== null) {
      deleteItem(itemToDelete);
    }
    setShowDeletePopup(false);
    setItemToDelete(null);
  }, [itemToDelete, deleteItem]);

  const cancelDelete = useCallback(() => {
    setShowDeletePopup(false);
    setItemToDelete(null);
  }, []);

  // Backspace key listener for delete
  useEffect(() => {
    const handleBackspace = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        // Don't trigger if typing in an input
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        if (isInput) return;
        
        // Check if an item is selected
        const selectedId = selectedItemIdRef.current;
        if (selectedId !== null) {
          e.preventDefault();
          setItemToDelete(selectedId);
          setShowDeletePopup(true);
        }
      }
    };
    
    window.addEventListener("keydown", handleBackspace);
    return () => window.removeEventListener("keydown", handleBackspace);
  }, []);

  // Load items from MongoDB database and place them with Gemini
  const loadItemsFromDatabase = useCallback(async () => {
    if (!sceneRef.current) {
      console.error("❌ Scene not ready for loading database items");
      return;
    }

    console.log("🗄️ Loading items from MongoDB database...");

    try {
      // 1. Fetch items from MongoDB API
      const response = await fetch("/api/items");
      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status} ${response.statusText}`);
      }
      
      const dbItems = await response.json();
      console.log(`📦 Fetched ${dbItems.length} items from database`);

      if (dbItems.length === 0) {
        console.log("ℹ️ No items found in database with status: ready");
        return;
      }

      // Helper to proxy external URLs through our API to avoid CORS
      const getProxiedUrl = (url: string): string => {
        if (url.startsWith('/')) return url; // Local URLs don't need proxy
        return `/api/proxy-model?url=${encodeURIComponent(url)}`;
      };

      // 2. Process each item sequentially to avoid overwhelming Gemini API
      for (let i = 0; i < dbItems.length; i++) {
        const dbItem = dbItems[i];
        const glbUrl = dbItem.asset?.glbUrl;
        
        if (!glbUrl) {
          console.warn(`⚠️ Item ${dbItem._id} has no glbUrl, skipping...`);
          continue;
        }

        // Proxy external URLs to avoid CORS
        const proxiedUrl = getProxiedUrl(glbUrl);
        console.log(`🔄 Processing item ${i + 1}/${dbItems.length}: ${glbUrl} -> ${proxiedUrl}`);

        try {
          // Capture top-down image of room (with existing items)
          const roomImageData = await captureTopDownImage();

          // Capture model image and get dimensions (use proxied URL)
          const { image: modelImageData, dimensions: modelDimensions } = await captureModelImage(proxiedUrl);

          // Get label from analysis or use default
          const label = dbItem.analysis?.label || dbItem.analysis?.type || "Furniture";

          // Call Gemini API for placement
          console.log(`📡 Getting Gemini placement for: ${label}`);
          const placementResponse = await fetch("/api/get-placement", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              image: roomImageData,
              modelImage: modelImageData,
              modelDimensions: modelDimensions,
              label: label,
              roomWidth: roomDimensions.width,
              roomDepth: roomDimensions.depth,
              existingItems: items.map((item) => ({
                label: item.modelPath?.includes('couch') ? "Couch" : 
                       item.modelPath?.includes('plant') ? "Plant" : 
                       item.modelPath?.includes('chair') ? "Chair" : "Item",
                position: item.position,
                rotation: item.rotation,
              })),
            }),
          });

          if (!placementResponse.ok) {
            console.error(`❌ Gemini API error for item ${dbItem._id}`);
            continue;
          }

          const placement = await placementResponse.json();
          console.log(`📍 Placement for ${label}:`, placement);

          // Convert normalized coordinates to world coordinates
          const geminiWidth = roomDimensions.width || 5;
          const geminiDepth = roomDimensions.depth || 5;
          const scaledWidth = roomDimensions.scaledWidth || (geminiWidth * (roomDimensions.scaleFactor || 1));
          const scaledDepth = roomDimensions.scaledDepth || (geminiDepth * (roomDimensions.scaleFactor || 1));
          
          const geminiX = (placement.x - 0.5) * geminiWidth;
          const geminiZ = (placement.y - 0.5) * geminiDepth;
          const finalX = (geminiX / geminiWidth) * scaledWidth;
          const finalZ = (geminiZ / geminiDepth) * scaledDepth;

          const floorY = roomDimensions.floorY || -0.5315285924741149;
          const finalY = floorY + 0.3; // Placeholder - will be recalculated in loadAndRenderItem

          // Create PlacedItem with unique ID (use proxied URL)
          const itemId = Date.now() + i;
          const newItem: PlacedItem = {
            id: itemId, // Ensure unique ID for each item
            modelPath: proxiedUrl,
            position: [finalX, finalY, finalZ],
            rotation: [0, placement.rotation || 0, 0],
            scale: typeof placement.scale === "number" && Number.isFinite(placement.scale) ? placement.scale : 1,
            dbItemId: dbItem._id,
          };

          // Store database item metadata for click callbacks
          dbItemsMetaRef.current.set(itemId, {
            _id: dbItem._id,
            source: dbItem.source,
            analysis: dbItem.analysis,
            asset: dbItem.asset,
          });

          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/27aedacc-7706-407d-b1ae-abccf09ed163',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:loadItemsFromDatabase',message:'Stored metadata for item',data:{itemId,dbItemId:dbItem._id,mainItem:dbItem.analysis?.main_item,description:dbItem.analysis?.description?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion

          console.log(`✅ Adding item from database: ${label} at (${finalX.toFixed(2)}, ${finalZ.toFixed(2)})`);

          // Add item to state
          setItems((prev) => {
            if (prev.some((i) => i.id === newItem.id)) {
              return prev;
            }
            return [...prev, newItem];
          });

          // Save to saved-items collection for future loads (include dbItemId for later metadata lookup)
          await saveItemToDb(newItem, glbUrl, label, dbItem._id);

          // Small delay between items to let the previous one render and update existingItems
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (itemError) {
          console.error(`❌ Error processing item ${dbItem._id}:`, itemError);
          // Continue with next item
        }
      }

      console.log("✅ Finished loading all items from database");

    } catch (error) {
      console.error("❌ Error loading items from database:", error);
    }
  }, [roomDimensions, items, captureTopDownImage, captureModelImage, saveItemToDb]);

  // Load saved items directly (without Gemini placement)
  const loadSavedItems = useCallback(async () => {
    if (!sceneRef.current) {
      console.error("❌ Scene not ready for loading saved items");
      return false;
    }

    console.log("📂 Checking for saved items...");

    try {
      const response = await fetch("/api/saved-items");
      if (!response.ok) {
        throw new Error(`Failed to fetch saved items: ${response.status}`);
      }
      
      const data = await response.json();
      const savedItems = data.items || [];
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/27aedacc-7706-407d-b1ae-abccf09ed163',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:loadSavedItems',message:'Fetched saved items',data:{count:savedItems.length,firstItem:savedItems[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      
      if (savedItems.length === 0) {
        console.log("ℹ️ No saved items found");
        return false;
      }

      console.log(`📦 Found ${savedItems.length} saved items - loading directly...`);

      // Helper to proxy external URLs
      const getProxiedUrl = (url: string): string => {
        if (url.startsWith('/')) return url;
        return `/api/proxy-model?url=${encodeURIComponent(url)}`;
      };

      // Load each saved item directly (no Gemini needed)
      for (let i = 0; i < savedItems.length; i++) {
        const saved = savedItems[i];
        const proxiedUrl = getProxiedUrl(saved.glbUrl);
        
        console.log(`📥 Loading saved item ${i + 1}/${savedItems.length}: ${saved.label}`);

        const itemId = Date.now() + i;
        const newItem: PlacedItem = {
          id: itemId,
          modelPath: proxiedUrl,
          position: saved.position,
          rotation: saved.rotation,
          scale: saved.scale,
          dbItemId: saved.dbItemId || saved._id, // Use original dbItemId if available, else saved item ID
        };

        // Store metadata for the modal - use original item description if available
        const mainItem = saved.originalMainItem || saved.label || "Furniture";
        const description = saved.originalDescription || saved.label || "Furniture";
        dbItemsMetaRef.current.set(itemId, {
          _id: saved.dbItemId || saved._id,
          analysis: {
            main_item: mainItem,
            label: saved.label,
            description: description,
          },
          asset: {
            glbUrl: saved.glbUrl,
          },
        });

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/27aedacc-7706-407d-b1ae-abccf09ed163',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:loadSavedItems',message:'Stored metadata from saved item',data:{itemId,savedId:saved._id,dbItemId:saved.dbItemId,label:saved.label,originalMainItem:saved.originalMainItem,originalDescription:saved.originalDescription?.substring(0,50),mainItemUsed:mainItem,descriptionUsed:description?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion

        setItems((prev) => {
          if (prev.some((item) => item.modelPath === proxiedUrl)) {
            return prev;
          }
          return [...prev, newItem];
        });

        // Small delay between items for smooth loading
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log("✅ Finished loading saved items");
      return true;
    } catch (error) {
      console.error("❌ Error loading saved items:", error);
      return false;
    }
  }, []);

  // Auto-load items when room is ready - check saved items first
  const hasAutoLoadedRef = useRef(false);
  useEffect(() => {
    // Only run once when room is ready (loading becomes false and room has dimensions)
    if (!loading && roomDimensions.width > 0 && sceneRef.current && !hasAutoLoadedRef.current) {
      hasAutoLoadedRef.current = true;
      console.log("🚀 Room ready - checking for saved items first...");
      
      // Small delay to ensure room is fully rendered
      setTimeout(async () => {
        try {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/27aedacc-7706-407d-b1ae-abccf09ed163',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:autoLoad',message:'Starting auto-load check',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          
          // First try to load saved items
          const hasSavedItems = await loadSavedItems();
          
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/27aedacc-7706-407d-b1ae-abccf09ed163',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:autoLoad',message:'loadSavedItems result',data:{hasSavedItems},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          
          if (!hasSavedItems) {
            // No saved items, load from database with Gemini placement
            console.log("🔄 No saved items found - loading from items database with Gemini...");
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/27aedacc-7706-407d-b1ae-abccf09ed163',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SmartScene.tsx:autoLoad',message:'Calling loadItemsFromDatabase',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
            // #endregion
            await loadItemsFromDatabase();
          }
        } catch (err) {
          console.error("❌ Error auto-loading items:", err);
        }
      }, 1000);
    }
  }, [loading, roomDimensions, loadSavedItems, loadItemsFromDatabase]);

  // Expose addChair when ready (after room loads)
  useEffect(() => {
    if (!loading && onReady && roomDimensions.width > 0) {
      onReady(addChair);
    }
  }, [loading, roomDimensions, onReady, addChair]);

  // Listen for spacebar to call addChair()
  useEffect(() => {
    console.log("🎹 Setting up keyboard listener for spacebar...");
    
    const handleKeyPress = (e: KeyboardEvent) => {
      console.log("🔊 Key pressed:", e.key, "Code:", e.code, "Target:", e.target);
      
      // Only trigger on spacebar and when not typing in an input
      if (e.code === "Space" || e.key === " " || e.keyCode === 32) {
        // Check if we're in an input field
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        
        if (isInput) {
          console.log("⚠️ Ignoring spacebar - typing in input field");
          return; // Don't trigger if typing in input
        }
        
        e.preventDefault(); // Prevent page scroll
        e.stopPropagation();
        
        console.log("⌨️ Spacebar pressed!");
        console.log("   Loading state:", loading);
        console.log("   Room dimensions:", roomDimensions);
        console.log("   Scene ref exists:", !!sceneRef.current);
        console.log("   Scene ready check:", !loading && roomDimensions.width > 0 && !!sceneRef.current);
        
        // Only run if scene is ready
        if (!loading && roomDimensions.width > 0 && sceneRef.current) {
          console.log("✅ Conditions met - calling addChair()");
          addChair().catch((err) => {
            console.error("❌ Error in addChair():", err);
          });
        } else {
          console.warn("⚠️ Scene not ready yet - cannot add chair");
          console.warn("   - loading:", loading);
          console.warn("   - roomDimensions.width > 0:", roomDimensions.width > 0);
          console.warn("   - sceneRef.current:", !!sceneRef.current);
        }
      }
    };

    // Add listener to document for better capture
    document.addEventListener("keydown", handleKeyPress);
    console.log("✅ Keyboard listener attached to document");

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      console.log("🧹 Keyboard listener removed");
    };
  }, [loading, roomDimensions, addChair]);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <div
        ref={containerRef}
        className="w-full h-full absolute inset-0"
      />
      
      {/* Delete Confirmation Popup - Glassmorphism */}
      {showDeletePopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl max-w-sm mx-4 ring-1 ring-white/10">
            <h3 className="text-white text-xl font-semibold mb-3 drop-shadow-lg">Delete Item?</h3>
            <p className="text-white/70 text-sm mb-8 leading-relaxed">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2.5 rounded-xl bg-red-500/80 backdrop-blur-sm border border-red-400/30 text-white hover:bg-red-500 transition-all duration-200 text-sm font-medium shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartScene;
