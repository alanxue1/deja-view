"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { initThree, cleanupThree, type ThreeScene } from "@/lib/three/init";
import { createOrbitControls, type OrbitControls } from "@/lib/three/controls";
import { setupResize } from "@/lib/three/resize";
import { cn } from "@/lib/cn";

interface RoomPreviewProps {
  className?: string;
}

export const RoomPreview: React.FC<RoomPreviewProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Initialize Three.js
    const scene = initThree(container);
    sceneRef.current = scene;

    // Setup controls first
    const controls = createOrbitControls(scene.camera, container);
    controlsRef.current = controls;

    // Load GLB model
    const loader = new GLTFLoader();
    const modelPath = "/uoft-dorm-common-area.glb";
    
    console.log("Loading model from:", modelPath);
    
    loader.load(
      modelPath,
      (gltf) => {
        console.log("Model loaded successfully:", gltf);
        const model = gltf.scene;
        modelRef.current = model;
        
        // Calculate bounding box to center and scale the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Center the model
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;
        
        // Scale to fit (optional - adjust as needed)
        const maxDim = Math.max(size.x, size.y, size.z);
        const finalScale = 4 / maxDim; // Scale to fit in a 4 unit space
        
        // Start with model invisible/scaled down for animation
        model.scale.set(0, 0, 0);
        
        // Set opacity to 0 for fade-in animation
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
        
        scene.scene.add(model);
        
        // Animate model appearance
        const duration = 2500; // 2.5 seconds (much slower animation)
        const startTime = Date.now();
        
        const animateAppearance = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
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
            setLoading(false);
          }
        };
        
        // Adjust camera position based on model size - start more zoomed in (centered)
        const distance = Math.max(size.x, size.y, size.z) * 0.6 * finalScale; // Reduced to 0.6 for more centered view
        scene.camera.position.set(distance, distance * 0.5, distance);
        scene.camera.lookAt(0, 0, 0);
        
        // Update controls spherical to match new camera position
        controls.spherical.setFromVector3(scene.camera.position);
        controls.spherical.radius = distance;
        
        // Set zoom limits - limit zoom out to only a little bit
        controls.minRadius = distance * 0.3; // Can zoom in 3x closer
        controls.maxRadius = distance * 1.2; // Can only zoom out 20% farther (limited)
        
        // Start the animation
        animateAppearance();
      },
      (progress) => {
        // Progress callback
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log("Loading progress:", percentComplete.toFixed(2) + "%");
        }
      },
      (error) => {
        console.error("Error loading model:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response,
          url: modelPath,
        });
        setLoading(false);
        alert(`Failed to load model: ${error.message || "Unknown error"}`);
      }
    );

    // Setup resize
    const resizeCleanup = setupResize(scene, container);
    resizeCleanupRef.current = resizeCleanup;

    // Animation loop
    const animate = () => {
      controls.update();
      scene.renderer.render(scene.scene, scene.camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
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
  }, []);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <div
        ref={containerRef}
        className="w-full h-full absolute inset-0"
      />
    </div>
  );
};

export default RoomPreview;
