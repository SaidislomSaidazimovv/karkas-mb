# Mebelchi Каркас — UI integratsiya kontrakti (S3-E0)

> **Maqsad:** Engine (P) · Viewport (T1) · Panellar (T2) — uch trekni **bitta chegara** orqali bog'lash. Hamma shu kontraktga quradi → fayllar to'qnashmaydi, qismlar ulanadi.
> **Egasi:** P (Planner). O'zgartirish faqat P orqali (kanban'da kelishilib).
> **Stack:** Expo (React Native + react-native-web) · react-three-fiber · Zustand · TypeScript.

---

## 1. Yagona haqiqat manbai — Zustand store

Butun ilova holati bitta store'da. T1 va T2 SHU store orqali gaplashadi (bir-birini import qilmaydi).

```ts
// ui/store/appStore.ts  (P yozadi S3-E0 da)
import type { StructuralModel, BlockId, InstanceId, SectionId, LineId, Scope, PartId } from "engine";

export type Mode = "build" | "material" | "hardware" | "frame";
export type ViewLens = "geometry" | "lines" | "glass" | "dimension";

export interface Selection {
  kind: "none" | "single" | "group";   // group-of-1 vs group-of-N (v3 §1)
  componentId?: string;                 // tanlangan Тип (guruh bo'lsa)
  instanceIds: readonly InstanceId[];   // blast-radius (yonadigan birodarlar)
  partIds: readonly PartId[];           // leaf detallar
  isUnique: boolean;                    // true = «Уникальная деталь» (tax yo'q)
  exceptions: number;                   // ✂ N (faqat real guruhda)
}

export interface AppState {
  // --- HOLAT (state) ---
  model: StructuralModel;               // engine strukturaviy modeli
  selection: Selection;                 // joriy tanlov
  mode: Mode;                           // joriy rejim (toolbar)
  view: readonly ViewLens[];            // stackable linzalar
  price_sum: number;                    // narx-tiker («сум»)
  preview: import("engine").PreviewResult | null;  // solvePreview natijasi (render uchun)

  // --- AMALLAR (actions) — UI shularni chaqiradi, ichida engine ishlaydi ---
  tapPart(partId: PartId): void;                    // T1 chaqiradi → selection (adaptiv)
  clearSelection(): void;
  setMode(mode: Mode): void;                        // T2 toolbar
  toggleView(lens: ViewLens): void;                 // T1/T2 rail
  divide(sectionId: SectionId, opts: DivideOpts): void;   // Build
  moveLine(lineId: LineId, delta_mm10: number, scope: Scope): void; // handle drag
  resize(partId: PartId, axis: "x" | "z", value_mm10: number): void;
  addPart(sectionId: SectionId, kind: AddKind): void;
  detach(instanceId: InstanceId): void;             // ✂
  reattach(instanceId: InstanceId): void;
  merge(sectionIds: readonly SectionId[]): void;    // #2 (engine S3-E3)
  // material/hardware/frame action'lari S3-E5/E6 da qo'shiladi (additiv)
}
```

**Qoida:** har `action` ichida engine chaqiriladi (`engine/index.ts` + `engine/structure/operations.ts`), natija yangi `model` bo'ladi (immutable), keyin `solvePreview(model→project)` bilan `preview` yangilanadi. UI faqat store'ni o'qiydi.

---

## 2. Engine API (store → engine chegarasi)

Store FAQAT shularni chaqiradi (boshqa engine ichkarisiga tegmaydi):

```ts
import {
  solvePreview, solveFull, solveAndExportSWJ008,   // index.ts
  divideSection, moveLine, selectByTap, detachInstance, reattachInstance, // structure/operations.ts
  // mergeSections, ... (S3-E3+ da P qo'shadi)
} from "engine";
```

P (engine trek) bu funksiyalarni **barqaror imzo** bilan saqlaydi. Yangi engine ishi (solver, merge, material) shu API ortida ulanadi — UI imzosi o'zgarmaydi.

---

## 3. Trek mas'uliyati va store kirish

| Trek | Papka | Store: O'QIYDI | Store: YOZADI (action) |
|---|---|---|---|
| **T1 · viewport** | `ui/canvas/*`, `ui/rail/*` | `preview`, `selection`, `model`, `view`, `mode` | `tapPart`, `moveLine`, `divide`(gesture), `toggleView` |
| **T2 · panellar** | `ui/chrome/*`, `ui/sheets/*`, `ui/layers/*`, `ui/toolbar/*` | `selection`, `mode`, `model`, `price_sum` | `setMode`, `resize`, `addPart`, `detach`, `reattach`, `merge` |
| **Engine · P** | `engine/*`, `ui/store/*` | — | store action'lari ichidagi engine mantig'i |

**«Bog'langan» mexanizm:** T1 shkafni bossa → `tapPart` → `selection` yangilanadi → **T2 selection-card avtomatik o'zgaradi** (o'qiydi). T2 rejim almashtirsa → `setMode` → **T1 rail+canvas o'zgaradi**. Hech kim bir-birining faylini import qilmaydi — faqat store.

**To'qnashuv yo'qligi:** `ui/store/` = P · `ui/canvas`+`ui/rail` = T1 · `ui/chrome`+`ui/sheets`+`ui/layers`+`ui/toolbar` = T2. Lock-protokol amal qiladi. Umumiy `appStore.ts` ni faqat P o'zgartiradi.

---

## 4. Dizayn manbai (T1/T2 piksel-aniqlik uchun)
- **Vizual:** `karkas-app/design/construction-v3-preview.html` — aniq rang (#7E9BE6 tanlash, #1C1C1D matn, #F6F5F2 maydon…), px, font (Inter), 21 ekran. (Boss nusxasi: `design/Mebelchi-Karkas-dizayn.html`.)
- **Funksiya:** `karkas-app/design/CONSTRUCTION_FRAME_v3.md` — adaptiv guruh, 4 rejim, L8, blokerlar.

---

## 5. S3-E0 DoD (P yetkazadi → T1/T2 ochiladi)
- [ ] Expo app skeleti (`ui/`, RN+RN-Web, `npm run dev` web'da ochiladi)
- [ ] `ui/store/appStore.ts` — yuqoridagi shakl, engine bilan typecheck yashil
- [ ] Engine API binding (stub action'lar — divide/select real, qolganlari TODO)
- [ ] Papka skeleti: `ui/canvas`, `ui/rail`, `ui/chrome`, `ui/sheets`, `ui/layers`, `ui/toolbar` (bo'sh placeholder)
- [ ] `expo export:web` → netlify-tayyor build chiqishini tasdiqlash
