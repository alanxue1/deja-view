import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface ThreeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

export function initThree(container: HTMLDivElement): ThreeScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1c22); // Softer dark background

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  // Shadows disabled: we use custom per-item discs instead (performance + style).
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  
  container.appendChild(renderer.domElement);

  // Lightweight physically-based environment lighting (generated once, very cheap at runtime).
  // This dramatically improves realism for glTF PBR materials without adding per-frame cost.
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmremGenerator.dispose();

  // Enhanced lighting setup
  // Ambient light for general illumination
  const ambientLight = new THREE.AmbientLight(0xfff1dc, 0.06);
  scene.add(ambientLight);

  // Main directional light (no shadow maps)
  const directionalLight = new THREE.DirectionalLight(0xfff1dc, 1.05);
  directionalLight.position.set(6, 10, 3);
  
  // Make the light look at the center
  directionalLight.target.position.set(0, 0, 0);
  directionalLight.target.updateMatrixWorld();
  scene.add(directionalLight);
  scene.add(directionalLight.target);
  
  // Additional fill light from opposite side for better illumination
  // Very subtle cool fill, no shadows (keeps contrast for cozy look).
  const fillLight = new THREE.DirectionalLight(0xcfe6ff, 0.05);
  fillLight.position.set(-6, 4, -4);
  scene.add(fillLight);
  
  // Hemisphere light for natural sky/ground lighting
  const hemisphereLight = new THREE.HemisphereLight(0xe7f0ff, 0x2b241d, 0.08);
  hemisphereLight.position.set(0, 10, 0);
  scene.add(hemisphereLight);

  return { scene, camera, renderer };
}

export function cleanupThree(scene: ThreeScene): void {
  const env = scene.scene.environment;
  if (env && env instanceof THREE.Texture) {
    env.dispose();
  }
  const bg = scene.scene.background;
  if (bg && bg instanceof THREE.Texture) {
    bg.dispose();
  }

  scene.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((mat) => mat.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
  scene.renderer.dispose();
  scene.renderer.domElement.remove();
}
