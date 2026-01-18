"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type ThreeScene } from "@/lib/three/init";

interface HoverPreview3DProps {
  modelPath: string;
  visible: boolean;
  parentElement?: HTMLElement | null;
  size?: number; // Size in pixels (default 400)
  position?: { top?: string; left?: string; right?: string; bottom?: string }; // Custom position
}

export const HoverPreview3D: React.FC<HoverPreview3DProps> = ({ modelPath, visible, parentElement, size = 400, position }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _parentElement = parentElement; // Keep prop for API compatibility

  useEffect(() => {
    if (!containerRef.current || !visible) return;

    const container = containerRef.current;

    // Create low-quality Three.js scene for preview
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    // More interesting camera angle - slightly elevated and angled
    camera.position.set(2, 2, 3);
    camera.lookAt(0, 0, 0);

    // Low-quality renderer for preview (lower pixel ratio, no antialiasing)
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false, // Disable antialiasing for lower quality/performance
      alpha: true,
      powerPreference: "low-power" // Use low-power GPU mode
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(1); // Fixed low pixel ratio for lower quality
    container.appendChild(renderer.domElement);

    const threeScene = { scene, camera, renderer };
    sceneRef.current = threeScene;

    // Add very bright lighting for preview
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(3, 6, 3);
    scene.add(directionalLight);
    
    // Add additional fill light for better visibility
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-2, 4, -2);
    scene.add(fillLight);
    
    // Add hemisphere light for natural lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
    hemisphereLight.position.set(0, 5, 0);
    scene.add(hemisphereLight);
    
    // Add point light for extra brightness
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 10);
    pointLight.position.set(0, 3, 0);
    scene.add(pointLight);

    // Load GLB model
    const loader = new GLTFLoader();
    
    loader.load(
      modelPath,
      (gltf) => {
        if (!sceneRef.current) return; // Check if component is still mounted
        
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
        
        // Scale to fit in preview (slightly smaller for compact display)
        const maxDim = Math.max(size.x, size.y, size.z);
        const finalScale = 2.2 / maxDim; // Scale to fit in a 2.2 unit space (smaller than before but not too small)
        model.scale.set(finalScale, finalScale, finalScale);
        
        threeScene.scene.add(model);
        
        // Ensure animation continues after model loads
        if (visible && !animationFrameRef.current) {
          animate();
        }
      },
      undefined,
      (error) => {
        console.error("Error loading preview model:", error);
      }
    );

    // Animation loop with slow rotation - always runs when visible
    const animate = () => {
      if (sceneRef.current && visible) {
        // Rotate model if it's loaded
        if (modelRef.current) {
          modelRef.current.rotation.y += 0.015;
        }
        // Always render the scene (even if model not loaded yet)
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
      }
      if (visible) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };
    
    // Start animation immediately when visible
    if (visible) {
      animate();
    }

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (sceneRef.current) {
        // Clean up model geometry and materials
        if (modelRef.current) {
          modelRef.current.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (Array.isArray(object.material)) {
                object.material.forEach((mat) => mat.dispose());
              } else if (object.material) {
                object.material.dispose();
              }
            }
          });
        }
        // Clean up renderer
        sceneRef.current.renderer.dispose();
        if (sceneRef.current.renderer.domElement.parentNode) {
          sceneRef.current.renderer.domElement.parentNode.removeChild(sceneRef.current.renderer.domElement);
        }
        sceneRef.current = null;
      }
      modelRef.current = null;
    };
  }, [modelPath, visible]);

  if (!visible) return null;

  const defaultPosition = {
    top: "50%",
    left: "calc(50% + 400px)",
  };

  const finalPosition = position ? { ...defaultPosition, ...position } : defaultPosition;
  
  // Always add transform for vertical centering if top is percentage
  const transform = finalPosition.top?.includes('%') ? "translateY(-50%)" : undefined;

  return (
    <div
      ref={containerRef}
      className="fixed z-[120] pointer-events-none"
      style={{ 
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "16px", 
        overflow: "hidden",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
        ...finalPosition,
        ...(transform ? { transform } : {}),
      }}
    />
  );
};

export default HoverPreview3D;
