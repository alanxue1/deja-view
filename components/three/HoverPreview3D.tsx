"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type ThreeScene } from "@/lib/three/init";

interface HoverPreview3DProps {
  modelPath: string;
  visible: boolean;
  parentElement?: HTMLElement | null;
}

export const HoverPreview3D: React.FC<HoverPreview3DProps> = ({ modelPath, visible, parentElement }) => {
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
    camera.position.set(0, 1, 3);
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

    // Add subtle lighting for preview
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(2, 5, 2);
    scene.add(directionalLight);

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
        
        // Scale to fit in preview (bigger for center display)
        const maxDim = Math.max(size.x, size.y, size.z);
        const finalScale = 3 / maxDim; // Scale to fit in a 3 unit space
        model.scale.set(finalScale, finalScale, finalScale);
        
        threeScene.scene.add(model);
      },
      undefined,
      (error) => {
        console.error("Error loading preview model:", error);
      }
    );

    // Animation loop with slow rotation
    const animate = () => {
      if (modelRef.current && sceneRef.current && visible) {
        // Slow rotation on Y-axis (50% faster than previous)
        modelRef.current.rotation.y += 0.015;
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
      }
      if (visible) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
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

  return (
    <div
      ref={containerRef}
      className="w-[400px] h-[400px] fixed z-[120] pointer-events-none"
      style={{ 
        borderRadius: "12px", 
        overflow: "hidden",
        backgroundColor: "transparent",
        border: "none",
        boxShadow: "none",
        top: "calc(50% + 40px)",
        left: "calc(50% + 156px)",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
};

export default HoverPreview3D;
