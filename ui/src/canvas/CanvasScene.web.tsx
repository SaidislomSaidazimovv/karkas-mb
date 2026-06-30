// src/canvas/CanvasScene.web.tsx — the real 3D viewport (react-three-fiber). OWNER: T1.
// Web target only: Metro picks this file for platform "web" (the netlify export goal);
// native gets CanvasScene.tsx (a fallback) so the DOM-bound r3f web canvas is never bundled
// for a device. Each board is a centred box; the selected boards glow in the selection blue.

import { Canvas } from "@react-three/fiber";
import type { CanvasSceneProps } from "./cabinet";
import { C } from "../../theme";

export function CanvasScene({ scene, selectedIds, onTapPart }: CanvasSceneProps) {
  const sel = new Set(selectedIds);
  const dist = Math.max(scene.radius, 0.3);
  // 3/4 view; the scene group is shifted so the cabinet centre sits at the origin the
  // camera looks at (set once in onCreated — no OrbitControls dependency).
  return (
    <Canvas
      camera={{ position: [dist * 0.95, dist * 0.75, dist * 1.35], fov: 35, near: 0.01, far: 100 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={[0xf4f3f0]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 9, 6]} intensity={1.15} />
      <directionalLight position={[-5, 3, -4]} intensity={0.35} />
      <group position={[-scene.center[0], -scene.center[1], -scene.center[2]]}>
        {scene.boards.map((b) => {
          const on = sel.has(b.id);
          return (
            <mesh
              key={b.id}
              position={b.pos}
              onClick={(e) => {
                e.stopPropagation();
                onTapPart(b.id);
              }}
            >
              <boxGeometry args={b.size} />
              <meshStandardMaterial
                color={on ? C.sel : "#b88a52"}
                emissive={on ? C.selLine : "#000000"}
                emissiveIntensity={on ? 0.28 : 0}
                roughness={0.72}
                metalness={0.02}
              />
            </mesh>
          );
        })}
      </group>
    </Canvas>
  );
}
