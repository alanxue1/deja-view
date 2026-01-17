import * as THREE from "three";
import type { ThreeScene } from "./init";

export interface OrbitControls {
  isDragging: boolean;
  previousMousePosition: { x: number; y: number };
  spherical: THREE.Spherical;
  update: () => void;
  dispose: () => void;
}

export function createOrbitControls(
  camera: THREE.PerspectiveCamera,
  container: HTMLElement
): OrbitControls {
  const spherical = new THREE.Spherical();
  spherical.setFromVector3(camera.position);
  spherical.radius = 5;

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    container.style.cursor = "grabbing";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    spherical.theta -= deltaX * 0.01;
    spherical.phi += deltaY * 0.01;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    isDragging = false;
    container.style.cursor = "grab";
  };

  container.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  container.style.cursor = "grab";

  return {
    get isDragging() {
      return isDragging;
    },
    previousMousePosition,
    spherical,
    update: () => {
      const position = new THREE.Vector3();
      position.setFromSpherical(spherical);
      camera.position.copy(position);
      camera.lookAt(0, 0, 0);
    },
    dispose: () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    },
  };
}
