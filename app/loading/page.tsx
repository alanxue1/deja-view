"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { initThree, cleanupThree } from "@/lib/three/init";
import LoadingProgress from "@/components/ui/LoadingProgress";

export default function LoadingPage() {
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const threeJsProgressRef = useRef(0);

  useEffect(() => {
    const startTime = Date.now();
    const minDuration = 2000;

    // Sync Clerk user to MongoDB (fire-and-forget; user is signed in after redirect)
    fetch("/api/users/sync").catch(() => {});

    // Pre-initialize Three.js in background (contributes 80% of progress)
    const runThreeInit = () => {
      try {
        const div = document.createElement("div");
        div.style.cssText =
          "position:fixed;left:-9999px;width:400px;height:400px;";
        document.body.appendChild(div);

        const scene = initThree(div);

        const roomSize = 4;
        const roomGeometry = new THREE.BoxGeometry(roomSize, roomSize, roomSize);
        const roomMaterial = new THREE.MeshStandardMaterial({
          color: 0xfafcfd,
          side: THREE.BackSide,
          roughness: 0.8,
          metalness: 0.1,
        });
        const room = new THREE.Mesh(roomGeometry, roomMaterial);
        scene.scene.add(room);

        const floorGeometry = new THREE.PlaneGeometry(
          roomSize * 0.8,
          roomSize * 0.8
        );
        const floorMaterial = new THREE.MeshStandardMaterial({
          color: 0xc3d4ce,
          roughness: 0.9,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -roomSize / 2 + 0.01;
        scene.scene.add(floor);

        const obj1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshStandardMaterial({
            color: 0xff7c12,
            roughness: 0.7,
            metalness: 0.3,
          })
        );
        obj1.position.set(0, -1, 0);
        scene.scene.add(obj1);

        const obj2 = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 32, 32),
          new THREE.MeshStandardMaterial({ color: 0x32404f, roughness: 0.6 })
        );
        obj2.position.set(1, -1, -0.5);
        scene.scene.add(obj2);

        scene.renderer.render(scene.scene, scene.camera);
        cleanupThree(scene);
        div.remove();
      } catch {
        // On error, still mark as done so progress can complete
      } finally {
        threeJsProgressRef.current = 1;
      }
    };

    setTimeout(runThreeInit, 0);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const timeProgress = Math.min(elapsed / minDuration, 1);
      const p = Math.min(
        threeJsProgressRef.current * 0.8 + timeProgress * 0.2,
        1
      );
      setProgress(p);

      if (p >= 1) {
        clearInterval(interval);
        router.replace("/room");
      }
    }, 50);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-2xl md:text-3xl font-serif text-[var(--ink)] mb-12 font-normal">
          Loading your memory
        </h1>

        <LoadingProgress
          progress={progress}
          bottomText="Your experience is on the way"
        />
      </div>
    </main>
  );
}
