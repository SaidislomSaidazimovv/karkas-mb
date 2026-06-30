// src/canvas/CanvasScene.web.tsx — the real 3D viewport (react-three-fiber). OWNER: T1.
// Web target only: Metro picks this file for platform "web" (the netlify export goal);
// native gets CanvasScene.tsx (a fallback) so the DOM-bound r3f web canvas is never bundled.
//
// Renders the store's assembled cabinet with a procedural wood material (a CanvasTexture grain
// map), an ACES-tone-mapped soft-shadow rig, and a contact shadow on the floor. The selected
// boards glow in the selection blue. Camera moves on a sphere (Rig) from the `orbit` angles —
// driven by the joystick AND by dragging empty space (an invisible backdrop reports the drag
// delta through onOrbitDelta). The model + floor stay put, so it reads like walking around it.

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  ACESFilmicToneMapping,
  BackSide,
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
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

/** Procedural oak-ish grain drawn to an offscreen canvas → one shared CanvasTexture. */
function makeWoodTexture(): CanvasTexture {
  const w = 128, h = 512;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#c89b62");
  g.addColorStop(0.5, "#b3854f");
  g.addColorStop(1, "#a67a45");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Wavering vertical grain streaks.
  for (let i = 0; i < 80; i++) {
    const alpha = 0.04 + Math.random() * 0.1;
    ctx.strokeStyle = `rgba(${(60 + Math.random() * 40) | 0}, ${(40 + Math.random() * 30) | 0}, 20, ${alpha})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.6;
    let x = Math.random() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 16) {
      x += (Math.random() - 0.5) * 2.4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new CanvasTexture(cv);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(1.4, 5);
  return tex;
}

export function CanvasScene({ scene, selectedIds, onTapPart, orbit, onOrbitDelta }: CanvasSceneProps) {
  const sel = new Set(selectedIds);
  const dist = Math.max(scene.radius, 0.3) * 1.7 + 0.4;
  const floorY = -scene.center[1]; // cabinet is centred at the origin → floor sits below it
  const wood = useMemo(makeWoodTexture, []);

  // Drag empty space to orbit: track the last pointer position, report deltas as radians.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    drag.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current || !onOrbitDelta) return;
    const dx = e.nativeEvent.clientX - drag.current.x;
    const dy = e.nativeEvent.clientY - drag.current.y;
    drag.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    onOrbitDelta(-dy * 0.006, dx * 0.006);
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <Canvas
      shadows="soft"
      camera={{ fov: 35, near: 0.01, far: 100 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={[0xf4f3f0]} />
      <Rig orbit={orbit} dist={dist} />

      {/* Wood rig: warm hemisphere fill + a tight soft-shadow key light + cool rim. */}
      <hemisphereLight args={[0xfff4e2, 0x6b5a40, 0.65]} />
      <directionalLight
        position={[3, 8, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.28} />

      {/* Invisible backdrop — catches drags on empty space without painting or occluding. */}
      <mesh onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <sphereGeometry args={[dist * 4, 8, 8]} />
        <meshBasicMaterial side={BackSide} transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      {/* Floor — catches the shadow so the cabinet feels grounded. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial transparent opacity={0.2} />
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
                map={wood}
                color={on ? C.sel : "#ffffff"}
                emissive={on ? C.selLine : "#000000"}
                emissiveIntensity={on ? 0.3 : 0}
                roughness={0.62}
                metalness={0.04}
              />
            </mesh>
          );
        })}
      </group>
    </Canvas>
  );
}
