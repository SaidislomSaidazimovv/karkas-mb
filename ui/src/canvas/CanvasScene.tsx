// src/canvas/CanvasScene.tsx — NATIVE fallback for the 3D viewport. OWNER: T1.
// Metro serves this on ios/android; the real r3f canvas lives in CanvasScene.web.tsx.
// Native 3D needs expo-gl + @react-three/fiber/native (not wired yet) — until then a
// device shows a clear notice but the store wiring (props) stays identical, so swapping
// in the native renderer later touches only this file.

import { View, Text, Pressable, StyleSheet } from "react-native";
import type { CanvasSceneProps } from "./cabinet";
import { C, FONT } from "../../theme";

export function CanvasScene({ scene, selectedIds, onTapPart }: CanvasSceneProps) {
  const first = scene.boards[0];
  return (
    <Pressable style={styles.wrap} onPress={() => first && onTapPart(first.id)}>
      <Text style={styles.title}>3D вид — в браузере</Text>
      <Text style={styles.sub}>
        деталей: {scene.boards.length} · выбрано: {selectedIds.length}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  title: { fontFamily: FONT, color: C.ink2, fontWeight: "700", fontSize: 14 },
  sub: { fontFamily: FONT, color: C.ink2, fontSize: 12 },
});
