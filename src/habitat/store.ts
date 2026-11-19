import { create } from "zustand";
import { CATALOG } from "./catalog.ts";
import {
  canPlace,
  nearestWall,
  openingFits,
  placementIssues,
  snapAngle,
  snapValue,
} from "./geometry.ts";
import { applyLifestyle } from "./recommend.ts";
import { loadArchive, parseDoc, writeArchive, type SavedProject } from "./storage.ts";
import { buildConcept, freshId } from "./templates.ts";
import type { Concept, Doc, Item, Kind, Lifestyle, Material, ZoneKind } from "./types.ts";
import { clamp, clampEnv } from "./types.ts";

export type Tool = "select" | "place" | "wall" | "door" | "window" | "zone";

export type Sel =
  | { type: "item"; id: string }
  | { type: "wall"; id: string }
  | { type: "zone"; id: string };

interface Drag {
  id: string;
  dx: number;
  dz: number;
  px: number;
  pz: number;
  moved: boolean;
}

interface HabitatState {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  projects: SavedProject[];
  selected: Sel | null;
  tool: Tool;
  pendingKind: Kind | null;
  wallStart: { x: number; z: number } | null;
  zoneStart: { x: number; z: number } | null;
  cursor: { x: number; z: number } | null;
  drag: Drag | null;
  dragValid: boolean;
  gesture: Doc | null;
  snap: boolean;
  view: "3d" | "plan";
  quality: "high" | "low";
  welcome: boolean;
  library: boolean;
  mobile: null | "catalog" | "inspect";
  notice: string | null;
  fps: number;
  savedAt: number | null;
  confirmReset: boolean;
  capture: (() => string) | null;
  hydrate: () => void;
  setNotice: (notice: string | null) => void;
  setFps: (fps: number) => void;
  setCapture: (fn: () => string) => void;
  setView: (view: "3d" | "plan") => void;
  setQuality: (quality: "high" | "low") => void;
  setSnap: (snap: boolean) => void;
  setTool: (tool: Tool) => void;
  setMobile: (mobile: null | "catalog" | "inspect") => void;
  setLibrary: (open: boolean) => void;
  setWelcome: (open: boolean) => void;
  chooseConcept: (concept: Concept) => void;
  select: (sel: Sel | null) => void;
  pointerDown: (x: number, z: number, hit?: { type: "item" | "wall"; id: string }) => void;
  pointerMove: (x: number, z: number) => void;
  pointerUp: () => void;
  beginEdit: () => void;
  endEdit: () => void;
  patchLive: (mut: (doc: Doc) => Doc) => void;
  commit: (doc: Doc, notice?: string) => void;
  undo: () => void;
  redo: () => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  rotateSelected: (delta: number) => void;
  updateItem: (id: string, patch: Partial<Item>, live?: boolean) => void;
  updateEnv: (patch: Partial<Doc["env"]>, live?: boolean) => void;
  rename: (name: string) => void;
  addOpening: (wallId: string, type: "door" | "window") => void;
  updateOpening: (wallId: string, openingId: string, patch: { t?: number; width?: number }, live?: boolean) => void;
  removeOpening: (wallId: string, openingId: string) => void;
  setZoneKind: (id: string, kind: ZoneKind) => void;
  applyLife: (lifestyle: Lifestyle) => void;
  resetConcept: () => void;
  setConfirmReset: (v: boolean) => void;
  saveNow: () => void;
  loadProject: (id: string) => void;
  duplicateProject: () => void;
  deleteProject: (id: string) => void;
  importText: (text: string) => void;
  newFromConcept: (concept: Concept) => void;
}

const LIMIT = 40;

function cloneDoc(doc: Doc): Doc {
  return structuredClone(doc);
}

function sameDoc(a: Doc, b: Doc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function persistFrom(state: Pick<HabitatState, "doc" | "projects">, savedAt = Date.now()): SavedProject[] {
  const projects = state.projects.some((p) => p.doc.id === state.doc.id)
    ? state.projects.map((p) => (p.doc.id === state.doc.id ? { savedAt, doc: state.doc } : p))
    : [{ savedAt, doc: state.doc }, ...state.projects];
  writeArchive({ version: 1, activeId: state.doc.id, projects });
  return projects;
}

function withHistory(state: HabitatState, next: Doc): Pick<HabitatState, "doc" | "past" | "future"> {
  if (sameDoc(state.doc, next)) return { doc: state.doc, past: state.past, future: state.future };
  return { doc: next, past: [...state.past, state.doc].slice(-LIMIT), future: [] };
}

export const useHabitat = create<HabitatState>((set, get) => ({
  doc: buildConcept("nature"),
  past: [],
  future: [],
  projects: [],
  selected: null,
  tool: "select",
  pendingKind: null,
  wallStart: null,
  zoneStart: null,
  cursor: null,
  drag: null,
  dragValid: true,
  gesture: null,
  snap: true,
  view: "3d",
  quality: "high",
  welcome: true,
  library: false,
  mobile: null,
  notice: null,
  fps: 0,
  savedAt: null,
  confirmReset: false,
  capture: null,

  hydrate: () => {
    const archive = loadArchive();
    const coarse =
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (!archive) {
      set({ welcome: true, quality: coarse ? "low" : "high" });
      return;
    }
    const active = archive.projects.find((p) => p.doc.id === archive.activeId) ?? archive.projects[0]!;
    set({
      doc: active.doc,
      projects: archive.projects,
      welcome: false,
      savedAt: active.savedAt,
      past: [],
      future: [],
      quality: coarse ? "low" : "high",
    });
  },

  setNotice: (notice) => set({ notice }),
  setFps: (fps) => set({ fps }),
  setCapture: (capture) => set({ capture }),
  setView: (view) => set({ view }),
  setQuality: (quality) => set({ quality }),
  setSnap: (snap) => set({ snap }),
  setMobile: (mobile) => set({ mobile }),
  setLibrary: (library) => set({ library }),
  setWelcome: (welcome) => set({ welcome }),
  setConfirmReset: (confirmReset) => set({ confirmReset }),
  select: (selected) => set({ selected }),

  setTool: (tool) =>
    set({
      tool,
      pendingKind: tool === "place" ? get().pendingKind : null,
      wallStart: null,
      zoneStart: null,
      cursor: null,
    }),

  chooseConcept: (concept) => {
    const doc = buildConcept(concept);
    doc.id = freshId("project");
    set({
      ...withHistory({ ...get(), doc: get().doc }, doc),
      welcome: false,
      selected: null,
      wallStart: null,
      zoneStart: null,
      tool: "select",
      notice: `${doc.name} 모형을 열었습니다.`,
    });
    const projects = persistFrom(get());
    set({ projects, savedAt: Date.now() });
  },

  commit: (doc, notice) => {
    set({ ...withHistory(get(), doc), selected: get().selected, notice: notice ?? get().notice });
  },

  beginEdit: () => {
    const s = get();
    if (s.gesture || s.drag) return;
    set({ gesture: cloneDoc(s.doc) });
  },

  endEdit: () => {
    const s = get();
    if (!s.gesture || s.drag) return;
    if (sameDoc(s.gesture, s.doc)) {
      set({ gesture: null });
      return;
    }
    set({ past: [...s.past, s.gesture].slice(-LIMIT), future: [], gesture: null });
  },

  patchLive: (mut) => set({ doc: mut(get().doc) }),

  undo: () => {
    const s = get();
    if (!s.past.length || s.drag) return;
    const doc = s.past[s.past.length - 1]!;
    set({
      doc,
      past: s.past.slice(0, -1),
      future: [s.doc, ...s.future].slice(0, LIMIT),
      selected: null,
      notice: "실행을 취소했습니다.",
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length || s.drag) return;
    const doc = s.future[0]!;
    set({
      doc,
      future: s.future.slice(1),
      past: [...s.past, s.doc].slice(-LIMIT),
      selected: null,
      notice: "다시 실행했습니다.",
    });
  },

  pointerDown: (x, z, hit) => {
    const s = get();
    const sx = snapValue(x, s.snap);
    const sz = snapValue(z, s.snap);

    if (s.tool === "place" && s.pendingKind) {
      const spec = CATALOG[s.pendingKind];
      const next: Item = {
        id: freshId("item"),
        kind: s.pendingKind,
        x: sx,
        z: sz,
        rotY: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        color: spec.color,
        material: spec.material,
      };
      const issues = placementIssues(s.doc, next);
      if (issues.length) {
        set({ notice: `놓을 수 없습니다. ${issues[0]}` });
        return;
      }
      const doc = { ...s.doc, items: [...s.doc.items, next] };
      set({ ...withHistory(s, doc), selected: { type: "item", id: next.id }, notice: `${spec.name}을 배치했습니다.` });
      return;
    }

    if (s.tool === "wall") {
      if (!s.wallStart) {
        set({ wallStart: { x: sx, z: sz }, cursor: { x: sx, z: sz } });
        return;
      }
      const a = s.wallStart;
      const len = Math.hypot(sx - a.x, sz - a.z);
      if (len < 0.6) {
        set({ notice: "벽은 0.6m 이상이어야 합니다.", wallStart: null, cursor: null });
        return;
      }
      const wall = { id: freshId("wall"), x1: a.x, z1: a.z, x2: sx, z2: sz, openings: [] };
      const doc = { ...s.doc, walls: [...s.doc.walls, wall] };
      set({
        ...withHistory(s, doc),
        wallStart: null,
        cursor: null,
        selected: { type: "wall", id: wall.id },
        notice: "벽을 추가했습니다.",
      });
      return;
    }

    if (s.tool === "zone") {
      if (!s.zoneStart) {
        set({ zoneStart: { x: sx, z: sz }, cursor: { x: sx, z: sz } });
        return;
      }
      const a = s.zoneStart;
      const x0 = Math.min(a.x, sx);
      const z0 = Math.min(a.z, sz);
      const ww = Math.abs(sx - a.x);
      const dd = Math.abs(sz - a.z);
      if (ww < 0.8 || dd < 0.8) {
        set({ notice: "구역은 최소 0.8m입니다.", zoneStart: null, cursor: null });
        return;
      }
      const zone = { id: freshId("zone"), kind: "living" as const, x: x0, z: z0, w: ww, d: dd };
      const doc = { ...s.doc, zones: [...s.doc.zones, zone] };
      set({
        ...withHistory(s, doc),
        zoneStart: null,
        cursor: null,
        selected: { type: "zone", id: zone.id },
        notice: "구역을 표시했습니다. 종류는 오른쪽에서 바꿉니다.",
      });
      return;
    }

    if (s.tool === "door" || s.tool === "window") {
      const near = nearestWall(s.doc, x, z);
      if (!near || near.dist > 0.7) {
        set({ notice: "가까운 벽이 없습니다." });
        return;
      }
      const wall = s.doc.walls.find((w) => w.id === near.id);
      if (!wall) return;
      const opening = {
        id: freshId(s.tool),
        type: s.tool,
        t: clamp(near.t, 0.08, 0.92),
        width: s.tool === "door" ? 0.9 : 1.4,
      };
      if (!openingFits(wall, opening)) {
        set({ notice: "이 위치에는 개구부가 들어가지 않습니다." });
        return;
      }
      const doc = {
        ...s.doc,
        walls: s.doc.walls.map((w) => (w.id === wall.id ? { ...w, openings: [...w.openings, opening] } : w)),
      };
      set({
        ...withHistory(s, doc),
        selected: { type: "wall", id: wall.id },
        notice: s.tool === "door" ? "문을 넣었습니다." : "창을 넣었습니다.",
      });
      return;
    }

    if (hit?.type === "item") {
      const item = s.doc.items.find((it) => it.id === hit.id);
      if (!item) return;
      set({
        selected: { type: "item", id: hit.id },
        gesture: cloneDoc(s.doc),
        dragValid: true,
        drag: { id: hit.id, dx: item.x - x, dz: item.z - z, px: x, pz: z, moved: false },
      });
      return;
    }

    if (hit?.type === "wall") {
      set({ selected: { type: "wall", id: hit.id }, drag: null });
      return;
    }

    const near = nearestWall(s.doc, x, z);
    if (near && near.dist < 0.32) {
      set({ selected: { type: "wall", id: near.id } });
      return;
    }
    set({ selected: null });
  },

  pointerMove: (x, z) => {
    const s = get();
    if (s.drag) {
      const item = s.doc.items.find((it) => it.id === s.drag!.id);
      if (!item || !s.gesture) return;
      if (!s.drag.moved && Math.hypot(x - s.drag.px, z - s.drag.pz) < 0.05) return;
      const nx = snapValue(x + s.drag.dx, s.snap);
      const nz = snapValue(z + s.drag.dz, s.snap);
      const next = { ...item, x: nx, z: nz };
      const valid = canPlace(s.doc, next);
      set({
        drag: { ...s.drag, moved: true },
        dragValid: valid,
        doc: { ...s.doc, items: s.doc.items.map((it) => (it.id === item.id ? next : it)) },
      });
      return;
    }
    const snapped = { x: snapValue(x, s.snap), z: snapValue(z, s.snap) };
    if (s.tool === "place" && s.pendingKind) {
      set({ cursor: snapped });
      return;
    }
    if ((s.tool === "wall" && s.wallStart) || (s.tool === "zone" && s.zoneStart)) {
      set({ cursor: snapped });
    }
  },

  pointerUp: () => {
    const s = get();
    if (!s.drag || !s.gesture) {
      set({ drag: null });
      return;
    }
    const item = s.doc.items.find((it) => it.id === s.drag!.id);
    if (!s.drag.moved) {
      set({ drag: null, gesture: null, dragValid: true });
      return;
    }
    if (!item || !canPlace(s.doc, item)) {
      set({
        doc: s.gesture,
        drag: null,
        gesture: null,
        dragValid: true,
        notice: "겹치거나 경계를 벗어나 원래 위치로 되돌렸습니다.",
      });
      return;
    }
    if (sameDoc(s.doc, s.gesture)) {
      set({ drag: null, gesture: null, dragValid: true });
      return;
    }
    set({
      past: [...s.past, s.gesture].slice(-LIMIT),
      future: [],
      drag: null,
      gesture: null,
      dragValid: true,
    });
  },

  removeSelected: () => {
    const s = get();
    if (!s.selected) return;
    const sel = s.selected;
    let doc = s.doc;
    if (sel.type === "item") doc = { ...doc, items: doc.items.filter((it) => it.id !== sel.id) };
    if (sel.type === "wall") {
      if (sel.id.startsWith("shell-")) {
        set({ notice: "외곽 벽은 지우지 않습니다. 개구부만 바꿀 수 있습니다." });
        return;
      }
      doc = { ...doc, walls: doc.walls.filter((w) => w.id !== sel.id) };
    }
    if (sel.type === "zone") doc = { ...doc, zones: doc.zones.filter((z) => z.id !== sel.id) };
    set({ ...withHistory(s, doc), selected: null, notice: "삭제했습니다." });
  },

  duplicateSelected: () => {
    const s = get();
    if (s.selected?.type !== "item") return;
    const item = s.doc.items.find((it) => it.id === s.selected!.id);
    if (!item) return;
    const offsets = [0.6, -0.6, 0.9, -0.9, 1.2, -1.2];
    for (const dx of offsets) {
      for (const dz of [0, 0.6, -0.6]) {
        const copy: Item = { ...item, id: freshId("item"), x: item.x + dx, z: item.z + dz };
        if (canPlace(s.doc, copy)) {
          const doc = { ...s.doc, items: [...s.doc.items, copy] };
          set({ ...withHistory(s, doc), selected: { type: "item", id: copy.id }, notice: "복제했습니다." });
          return;
        }
      }
    }
    set({ notice: "복제할 빈 자리가 없습니다." });
  },

  rotateSelected: (delta) => {
    const s = get();
    if (s.selected?.type !== "item") return;
    const item = s.doc.items.find((it) => it.id === s.selected!.id);
    if (!item) return;
    const rotY = snapAngle(item.rotY + delta, true);
    const next = { ...item, rotY };
    if (!canPlace(s.doc, next)) {
      set({ notice: "회전하면 벽이나 가구와 겹칩니다." });
      return;
    }
    const doc = { ...s.doc, items: s.doc.items.map((it) => (it.id === item.id ? next : it)) };
    set({ ...withHistory(s, doc) });
  },

  updateItem: (id, patch, live) => {
    const s = get();
    const item = s.doc.items.find((it) => it.id === id);
    if (!item) return;
    const next: Item = { ...item, ...patch };
    if (patch.rotY !== undefined) next.rotY = snapAngle(patch.rotY, s.snap);
    if (patch.x !== undefined) next.x = snapValue(patch.x, s.snap);
    if (patch.z !== undefined) next.z = snapValue(patch.z, s.snap);
    next.sx = clamp(next.sx, 0.4, 2.4);
    next.sy = clamp(next.sy, 0.4, 2.4);
    next.sz = clamp(next.sz, 0.4, 2.4);
    if (!canPlace(s.doc, next)) {
      if (!live) set({ notice: "그 크기·위치는 겹칩니다." });
      return;
    }
    const doc = { ...s.doc, items: s.doc.items.map((it) => (it.id === id ? next : it)) };
    if (live) set({ doc });
    else set(withHistory(s, doc));
  },

  updateEnv: (patch, live) => {
    const s = get();
    const doc = { ...s.doc, env: clampEnv({ ...s.doc.env, ...patch }) };
    if (live) set({ doc });
    else set(withHistory(s, doc));
  },

  rename: (name) => {
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 48);
    if (!clean) {
      set({ notice: "이름을 비울 수 없습니다." });
      return;
    }
    const s = get();
    set(withHistory(s, { ...s.doc, name: clean }));
  },

  addOpening: (wallId, type) => {
    const s = get();
    const wall = s.doc.walls.find((w) => w.id === wallId);
    if (!wall) return;
    const opening = { id: freshId(type), type, t: 0.5, width: type === "door" ? 0.9 : 1.4 };
    if (!openingFits(wall, opening)) {
      set({ notice: "벽 중앙에 개구부를 넣을 여유가 없습니다." });
      return;
    }
    const doc = {
      ...s.doc,
      walls: s.doc.walls.map((w) => (w.id === wallId ? { ...w, openings: [...w.openings, opening] } : w)),
    };
    set(withHistory(s, doc));
  },

  updateOpening: (wallId, openingId, patch, live) => {
    const s = get();
    const wall = s.doc.walls.find((w) => w.id === wallId);
    const current = wall?.openings.find((o) => o.id === openingId);
    if (!wall || !current) return;
    const next = {
      ...current,
      t: patch.t === undefined ? current.t : clamp(patch.t, 0, 1),
      width: patch.width === undefined ? current.width : clamp(patch.width, 0.4, 4),
    };
    if (!openingFits(wall, next)) {
      if (!live) set({ notice: "개구부가 벽 끝이나 다른 개구부와 겹칩니다." });
      return;
    }
    const doc = {
      ...s.doc,
      walls: s.doc.walls.map((w) =>
        w.id === wallId ? { ...w, openings: w.openings.map((o) => (o.id === openingId ? next : o)) } : w,
      ),
    };
    if (live) set({ doc });
    else set(withHistory(s, doc));
  },

  removeOpening: (wallId, openingId) => {
    const s = get();
    const doc = {
      ...s.doc,
      walls: s.doc.walls.map((w) =>
        w.id === wallId ? { ...w, openings: w.openings.filter((o) => o.id !== openingId) } : w,
      ),
    };
    set(withHistory(s, doc));
  },

  setZoneKind: (id, kind) => {
    const s = get();
    const doc = { ...s.doc, zones: s.doc.zones.map((z) => (z.id === id ? { ...z, kind } : z)) };
    set(withHistory(s, doc));
  },

  applyLife: (lifestyle) => {
    const s = get();
    const result = applyLifestyle(s.doc, lifestyle);
    set({ ...withHistory(s, result.doc), notice: result.note, welcome: false });
  },

  resetConcept: () => {
    const s = get();
    const fresh = buildConcept(s.doc.concept);
    fresh.id = s.doc.id;
    fresh.name = s.doc.name;
    set({
      ...withHistory(s, fresh),
      selected: null,
      confirmReset: false,
      notice: "이 콘셉트의 기본 배치로 되돌렸습니다.",
    });
  },

  saveNow: () => {
    const projects = persistFrom(get());
    set({ projects, savedAt: Date.now(), notice: "이 브라우저에 저장했습니다." });
  },

  loadProject: (id) => {
    const found = get().projects.find((p) => p.doc.id === id);
    if (!found) return;
    set({
      doc: cloneDoc(found.doc),
      past: [],
      future: [],
      selected: null,
      library: false,
      welcome: false,
      notice: `${found.doc.name}을 불러왔습니다.`,
    });
    const projects = persistFrom(get(), found.savedAt);
    set({ projects });
  },

  duplicateProject: () => {
    const s = get();
    const doc = cloneDoc(s.doc);
    doc.id = freshId("project");
    doc.name = `${s.doc.name} 복제`.slice(0, 48);
    const projects = persistFrom({ doc, projects: s.projects });
    set({
      doc,
      projects,
      past: [],
      future: [],
      selected: null,
      savedAt: Date.now(),
      notice: "설계를 복제했습니다.",
    });
  },

  deleteProject: (id) => {
    const s = get();
    const projects = s.projects.filter((p) => p.doc.id !== id);
    if (!projects.length) {
      const doc = buildConcept("nature");
      doc.id = freshId("project");
      writeArchive({ version: 1, activeId: doc.id, projects: [{ savedAt: Date.now(), doc }] });
      set({
        doc,
        projects: [{ savedAt: Date.now(), doc }],
        past: [],
        future: [],
        selected: null,
        notice: "마지막 설계를 지우고 기본 모형을 열었습니다.",
      });
      return;
    }
    const next = s.doc.id === id ? projects[0]!.doc : s.doc;
    writeArchive({ version: 1, activeId: next.id, projects });
    set({
      doc: next,
      projects,
      past: [],
      future: [],
      selected: null,
      notice: "설계를 삭제했습니다.",
    });
  },

  importText: (text) => {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      set({ notice: "JSON을 읽을 수 없습니다." });
      return;
    }
    const parsed = parseDoc(json);
    if (!parsed.ok) {
      set({ notice: parsed.error });
      return;
    }
    const doc = parsed.doc;
    doc.id = freshId("project");
    const projects = persistFrom({ doc, projects: get().projects });
    set({
      doc,
      projects,
      past: [],
      future: [],
      selected: null,
      library: false,
      welcome: false,
      savedAt: Date.now(),
      notice: "설계를 가져왔습니다.",
    });
  },

  newFromConcept: (concept) => {
    const doc = buildConcept(concept);
    doc.id = freshId("project");
    const projects = persistFrom({ doc, projects: get().projects });
    set({
      doc,
      projects,
      past: [],
      future: [],
      selected: null,
      welcome: false,
      library: false,
      savedAt: Date.now(),
      notice: `${doc.name}을 새로 시작했습니다.`,
    });
  },
}));

export function scheduleAutosave(): () => void {
  let timer = 0;
  const unsub = useHabitat.subscribe((state, prev) => {
    if (state.drag || state.gesture) return;
    if (state.doc === prev.doc && !prev.gesture && !prev.drag) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const current = useHabitat.getState();
      if (current.drag || current.gesture) return;
      const projects = persistFrom(current);
      useHabitat.setState({ projects, savedAt: Date.now() });
    }, 500);
  });
  return () => {
    unsub();
    window.clearTimeout(timer);
  };
}

export function materialOf(material: Material): { roughness: number; metalness: number } {
  switch (material) {
    case "oak":
      return { roughness: 0.72, metalness: 0 };
    case "linen":
      return { roughness: 0.94, metalness: 0 };
    case "stone":
      return { roughness: 0.42, metalness: 0.04 };
    case "metal":
      return { roughness: 0.32, metalness: 0.78 };
    case "glass":
      return { roughness: 0.08, metalness: 0.05 };
    case "living":
      return { roughness: 0.8, metalness: 0 };
  }
}
