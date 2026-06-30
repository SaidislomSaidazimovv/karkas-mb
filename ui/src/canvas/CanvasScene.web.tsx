// src/canvas/CanvasScene.web.tsx — the real 3D viewport (react-three-fiber). OWNER: T1.
// Web target only: Metro picks this file for platform "web" (the netlify export goal);
// native gets CanvasScene.tsx (a fallback) so the DOM-bound r3f web canvas is never bundled
// for a device.
//
// Renders the store's assembled cabinet: each PanelPlacement is a centred box, lit with a
// soft 3-light wood rig + contact shadow on the floor. The selected boards glow in the
// selection blue. The joystick-driven `orbit` angles move the CAMERA on a sphere around the
// cabinet (Rig) — the model + floor stay put, so it reads like walking around the piece.

import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { CanvasSceneProps } from "./cabinet";
import { C } from "../../theme";

/** Drive the camera from orbit angles (polar pitch, azimuth yaw) on a sphere of radius `dist`. */
function Rig({ orbit, dist }: { orbit: [number, number]; dist: number }) {
  const camera = useThree((s) => s.camera);
  const [pol, az] = orbit;
  useLayoutEffect(() => {
    const cp = Math.cos(pol), sp = Math.sin(pol);
    camera.position.set(dist * cp * Math.sin(az), dist * sp, dist * cp * Math.cos(az));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, pol, az, dist]);
  return null;
}

/** Deterministic ±lightness jitter per board id so the panels don't read as one flat colour. */
function woodTone(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const base = 0xb8, g = 0x8a, b = 0x52;
  const k = ((h % 13) - 6) * 4; // ~ ±24
  const cl = (v: number) => Math.max(0, Math.min(255, v + k));
  return `rgb(${cl(base)}, ${cl(g)}, ${cl(b)})`;
}

export function CanvasScene({ scene, selectedIds, onTapPart, orbit }: CanvasSceneProps) {
  const sel = new Set(selectedIds);
  const dist = Math.max(scene.radius, 0.3) * 1.7 + 0.4;
  const floorY = -scene.center[1]; // cabinet is centred at the origin → floor sits below it

  return (
    <Canvas
      shadows
      camera={{ fov: 35, near: 0.01, far: 100 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={[0xf4f3f0]} />
      <Rig orbit={orbit} dist={dist} />

      {/* Wood rig: warm hemisphere fill + a key light that casts the contact shadow + cool rim. */}
      <hemisphereLight args={[0xfff4e2, 0x6b5a40, 0.7]} />
      <directionalLight
        position={[3, 8, 5]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.3} />

      {/* Floor — catches the shadow so the cabinet feels grounded. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial transparent opacity={0.18} />
      </mesh>

      {/* Cabinet — shifted so its centre is the origin the camera orbits. */}
      <group position={[-scene.center[0], -scene.center[1], -scene.center[2]]}>
        {scene.boards.map((b) => {
          const on = sel.has(b.id);
          return (
            <mesh
              key={b.id}
              position={b.pos}
              castShadow
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                onTapPart(b.id);
              }}
            >
              <boxGeometry args={b.size} />
              <meshStandardMaterial
                color={on ? C.sel : woodTone(b.id)}
                emissive={on ? C.selLine : "#000000"}
                emissiveIntensity={on ? 0.3 : 0}
                roughness={0.66}
                metalness={0.04}
              />
            </mesh>
          );
        })}
      </group>
    </Canvas>
  );
}
