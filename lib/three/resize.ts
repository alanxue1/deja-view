import * as THREE from "three";
import type { ThreeScene } from "./init";

export function setupResize(
  scene: ThreeScene,
  container: HTMLDivElement
): () => void {
  const handleResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene.camera.aspect = width / height;
    scene.camera.updateProjectionMatrix();
    scene.renderer.setSize(width, height);
  };

  window.addEventListener("resize", handleResize);

  return () => {
    window.removeEventListener("resize", handleResize);
  };
}
