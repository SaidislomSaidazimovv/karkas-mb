// src/canvas/CanvasScene.web.tsx — the real 3D viewport (react-three-fiber). OWNER: T1.
// Web target only: Metro picks this file for platform "web" (the netlify export goal);
// native gets CanvasScene.tsx (a fallback) so the DOM-bound r3f web canvas is never bundled.
//
// Renders the store's assembled cabinet with a procedural wood material (a CanvasTexture grain
// map), an ACES-tone-mapped soft-shadow rig, and a contact shadow on the floor. The selected
// boards glow in the selection blue. Camera moves on a sphere (Rig) from the `orbit` angles —
// driven by the joystick AND by dragging empty space (an invisible backdrop reports the drag
// delta through onOrbitDelta). The model + floor stay put, so it reads like walking around it.

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  EdgesGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import type { CanvasSceneProps } from "./cabinet";
import { C } from "../../theme";

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

export function CanvasScene({
  scene, selectedIds, onTapPart, lenses, hiddenIds, controlsRef,
  sectionPicks = [], selectedSectionId,
}: CanvasSceneProps) {
  const sel = new Set(selectedIds);
  const hidden = new Set(hiddenIds); // boards toggled off in Zone 5 — skipped below (view-only)
  // Distance that frames the whole cabinet with margin (fov 35°). OrbitControls zooms within bounds.
  const r = Math.max(scene.radius, 0.3);
  const fitDist = r * 3.0 + 0.5;
  const camPos: [number, number, number] = [fitDist * 0.5, fitDist * 0.42, fitDist * 0.76];
  const floorY = -scene.center[1]; // cabinet is centred at the origin → floor sits below it
  const wood = useMemo(makeWoodTexture, []);
  const glass = lenses.includes("glass"); // translucent panels
  const lines = lenses.includes("lines"); // crisp edge overlay
  const xray = lenses.includes("xray"); // «Разрез» — see-through the OUTER carcass to work inside
  // Edge geometries (one per board) for the "lines" lens — memoised so we don't rebuild each frame.
  const edges = useMemo(
    () => scene.boards.map((b) => new EdgesGeometry(new BoxGeometry(b.size[0], b.size[1], b.size[2]))),
    [scene.boards],
  );

  return (
    <Canvas
      shadows="soft"
      camera={{ fov: 35, near: 0.01, far: 100, position: camPos }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={[0xf4f3f0]} />
      {/* Camera controller — drag to orbit, mouse-wheel / pinch to zoom (no pan). The joystick drives
          it through controlsRef. Damping = smooth, reference-quality feel. */}
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.65}
        zoomSpeed={0.9}
        minDistance={fitDist * 0.35}
        maxDistance={fitDist * 2.4}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI * 0.49}
      />

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

      {/* Floor — catches the shadow so the cabinet feels grounded. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>

      {/* Selected interior section — a translucent blue block drawn OVER the carcass (depthTest off)
          so you can see which section you picked even though it's inside an opaque box. Picking is
          done from the tap's hit-point (walls occlude, so an invisible pick-mesh can't be raycast). */}
      <group position={[-scene.center[0], -scene.center[1], -scene.center[2]]}>
        {sectionPicks
          .filter((s) => s.id === selectedSectionId)
          .map((s) => (
            <mesh key={s.id} position={s.pos} renderOrder={999}>
              <boxGeometry args={s.size} />
              <meshBasicMaterial transparent opacity={0.28} color={C.sel} depthTest={false} depthWrite={false} />
            </mesh>
          ))}
      </group>

      {/* Cabinet — shifted so its centre is the origin the camera orbits. */}
      <group position={[-scene.center[0], -scene.center[1], -scene.center[2]]}>
        {scene.boards.map((b, i) => {
          if (hidden.has(b.id)) return null; // eye toggled off — drop from the view (export keeps it)
          const on = sel.has(b.id);
          // «Разрез» (xray) fades the OUTER carcass (sides/top/bottom/back) so you see + work inside;
          // the interior content (shelves/doors/dividers — `__inst_`) stays solid.
          const isCarcass = /(?:__side_|__top|__bottom|__back)/.test(b.id);
          const seeThrough = glass || (xray && isCarcass);
          const opacity = seeThrough ? (xray && isCarcass && !glass ? 0.1 : 0.42) : 1;
          return (
            <group key={b.id} position={b.pos}>
              <mesh
                castShadow={!seeThrough}
                receiveShadow={!seeThrough}
                // In «Разрез» the faded carcass is view-only (no handler) so a tap passes THROUGH it
                // to the interior content behind — that's how you select an inner shelf/divider that
                // a solid wall would otherwise occlude. Normal mode keeps the wall tappable (→ section).
                onClick={
                  xray && isCarcass
                    ? undefined
                    : (e) => {
                        e.stopPropagation();
                        // Ignore a click that was actually a drag (OrbitControls just orbited the
                        // camera); only a real tap selects. Pass the 3D hit-point so the caller can
                        // resolve which interior SECTION the tap falls in.
                        if (e.delta < 5) onTapPart(b.id, [e.point.x, e.point.y, e.point.z]);
                      }
                }
              >
                <boxGeometry args={b.size} />
                <meshStandardMaterial
                  key={seeThrough ? "see" : "solid"}
                  map={wood}
                  color={on ? C.sel : "#ffffff"}
                  emissive={on ? C.selLine : "#000000"}
                  emissiveIntensity={on ? 0.3 : 0}
                  roughness={0.62}
                  metalness={0.04}
                  transparent={seeThrough}
                  opacity={opacity}
                  depthWrite={!seeThrough}
                />
              </mesh>
              {/* "lines" lens — outline every panel; in «Разрез» also outline the faded carcass so
                  the cabinet's box shape stays readable while you see inside it. */}
              {(lines || (xray && isCarcass)) && (
                <lineSegments geometry={edges[i]}>
                  <lineBasicMaterial color={on ? C.selLine : "#3a352c"} />
                </lineSegments>
              )}
            </group>
          );
        })}
      </group>
    </Canvas>
  );
}
