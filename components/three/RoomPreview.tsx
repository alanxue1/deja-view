"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { initThree, cleanupThree, type ThreeScene } from "@/lib/three/init";
import { createOrbitControls, type OrbitControls } from "@/lib/three/controls";
import { setupResize } from "@/lib/three/resize";
import Card from "@/components/ui/Card";
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

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Initialize Three.js
    const scene = initThree(container);
    sceneRef.current = scene;

    // Create a simple room (box with inward-facing normals)
    const roomSize = 4;
    const roomGeometry = new THREE.BoxGeometry(roomSize, roomSize, roomSize);
    
    // Create room material (inward-facing)
    const roomMaterial = new THREE.MeshStandardMaterial({
      color: 0xfafcfd,
      side: THREE.BackSide,
      roughness: 0.8,
      metalness: 0.1,
    });
    const room = new THREE.Mesh(roomGeometry, roomMaterial);
    scene.scene.add(room);

    // Add a floor object
    const floorGeometry = new THREE.PlaneGeometry(roomSize * 0.8, roomSize * 0.8);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xc3d4ce,
      roughness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -roomSize / 2 + 0.01;
    scene.scene.add(floor);

    // Add a simple object in the room
    const objectGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const objectMaterial = new THREE.MeshStandardMaterial({
      color: 0xff7c12,
      roughness: 0.7,
      metalness: 0.3,
    });
    const object = new THREE.Mesh(objectGeometry, objectMaterial);
    object.position.set(0, -1, 0);
    scene.scene.add(object);

    // Add another object
    const object2Geometry = new THREE.SphereGeometry(0.3, 32, 32);
    const object2Material = new THREE.MeshStandardMaterial({
      color: 0x32404f,
      roughness: 0.6,
    });
    const object2 = new THREE.Mesh(object2Geometry, object2Material);
    object2.position.set(1, -1, -0.5);
    scene.scene.add(object2);

    // Setup controls
    const controls = createOrbitControls(scene.camera, container);
    controlsRef.current = controls;

    // Setup resize
    const resizeCleanup = setupResize(scene, container);
    resizeCleanupRef.current = resizeCleanup;

    // Animation loop
    let time = 0;
    const animate = () => {
      time += 0.01;
      
      // Subtle animation
      if (object) {
        object.rotation.y = Math.sin(time * 0.5) * 0.1;
      }
      if (object2) {
        object2.position.y = -1 + Math.sin(time * 0.7) * 0.1;
      }

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
    <Card className={className}>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[400px] relative"
        style={{ clipPath: "inset(0 round 16px)" }}
      />
    </Card>
  );
};

export default RoomPreview;
