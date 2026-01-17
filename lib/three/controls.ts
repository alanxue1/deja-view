import * as THREE from "three";
import type { ThreeScene } from "./init";

export interface OrbitControls {
  isDragging: boolean;
  previousMousePosition: { x: number; y: number };
  spherical: THREE.Spherical;
  minRadius: number;
  maxRadius: number;
  verticalOffset: number;
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
  let minRadius = 1;
  let maxRadius = 100;
  let verticalOffset = 0; // Current vertical offset for camera position
  let targetVerticalOffset = 0; // Target vertical offset (for smooth interpolation)
  
  // Target spherical values for smooth interpolation - initialize from current spherical
  let targetTheta = spherical.theta;
  let targetPhi = spherical.phi;

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    container.style.cursor = "grabbing";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    // Check if Shift key is pressed for vertical camera movement
    if (e.shiftKey) {
      // Move camera vertically (change Y position) - inverted and slower
      const verticalSpeed = 0.02; // Slower movement
      targetVerticalOffset += deltaY * verticalSpeed; // Inverted: dragging up moves camera up
    } else {
      // Normal rotation - update target values for smooth interpolation
      targetTheta -= deltaX * 0.01;
      targetPhi -= deltaY * 0.01;
      targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, targetPhi));
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    isDragging = false;
    container.style.cursor = "grab";
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const zoomDelta = e.deltaY * zoomSpeed;
    spherical.radius += zoomDelta;
    spherical.radius = Math.max(minRadius, Math.min(maxRadius, spherical.radius));
  };

  container.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  container.addEventListener("wheel", onWheel, { passive: false });
  container.style.cursor = "grab";

  return {
    get isDragging() {
      return isDragging;
    },
    previousMousePosition,
    spherical,
    get minRadius() {
      return minRadius;
    },
    set minRadius(value: number) {
      minRadius = value;
      spherical.radius = Math.max(minRadius, Math.min(maxRadius, spherical.radius));
    },
    get maxRadius() {
      return maxRadius;
    },
    set maxRadius(value: number) {
      maxRadius = value;
      spherical.radius = Math.max(minRadius, Math.min(maxRadius, spherical.radius));
    },
    get verticalOffset() {
      return verticalOffset;
    },
    set verticalOffset(value: number) {
      verticalOffset = value;
    },
    update: () => {
      // Smooth interpolation with moderate damping for all movements
      const dampingFactor = 0.12; // Moderate smoothing - noticeable but not too slow
      
      // Smooth spherical rotation
      spherical.theta += (targetTheta - spherical.theta) * dampingFactor;
      spherical.phi += (targetPhi - spherical.phi) * dampingFactor;
      
      // Smooth vertical offset
      verticalOffset += (targetVerticalOffset - verticalOffset) * dampingFactor;
      
      const position = new THREE.Vector3();
      position.setFromSpherical(spherical);
      // Apply vertical offset to camera position
      position.y += verticalOffset;
      camera.position.copy(position);
      camera.lookAt(0, verticalOffset, 0); // Look at center with vertical offset
    },
    dispose: () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
    },
  };
}
