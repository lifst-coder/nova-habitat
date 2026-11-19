import { CATALOG } from "./catalog.ts";
import type { Doc, Item, Opening, Wall, Zone, ZoneKind } from "./types.ts";
import { ZONE_KINDS } from "./types.ts";

export const WALL_H = 2.7;
export const WALL_T = 0.14;
export const DOOR_H = 2.08;
export const WIN_SILL = 0.92;
export const WIN_HEAD = 2.15;

export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Solid {
  id: string;
  cx: number;
  cz: number;
  y: number;
  len: number;
  h: number;
  rotY: number;
  kind: "solid" | "glass";
}

export function wallLength(wall: Wall): number {
  return Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
}

export function wallAngle(wall: Wall): number {
  return Math.atan2(wall.z2 - wall.z1, wall.x2 - wall.x1);
}

export function overlaps(a: Aabb, b: Aabb, gap = 0.02): boolean {
  return a.minX < b.maxX - gap && a.maxX > b.minX + gap && a.minZ < b.maxZ - gap && a.maxZ > b.minZ + gap;
}

export function containsPoint(box: Aabb, x: number, z: number): boolean {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

export function itemAabb(item: Item): Aabb {
  const spec = CATALOG[item.kind];
  const hw = (spec.w * item.sx) / 2;
  const hd = (spec.d * item.sz) / 2;
  const c = Math.abs(Math.cos(item.rotY));
  const s = Math.abs(Math.sin(item.rotY));
  return {
    minX: item.x - (hw * c + hd * s),
    maxX: item.x + (hw * c + hd * s),
    minZ: item.z - (hw * s + hd * c),
    maxZ: item.z + (hw * s + hd * c),
  };
}

export function footprintArea(item: Item): number {
  const spec = CATALOG[item.kind];
  return spec.w * item.sx * spec.d * item.sz;
}

export function footprintPoly(item: Item): [number, number][] {
  const spec = CATALOG[item.kind];
  const hw = (spec.w * item.sx) / 2;
  const hd = (spec.d * item.sz) / 2;
  const c = Math.cos(item.rotY);
  const s = Math.sin(item.rotY);
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return corners.map(([lx, lz]) => [item.x + lx * c + lz * s, item.z - lx * s + lz * c]);
}

export function wallSolids(wall: Wall): Solid[] {
  const len = wallLength(wall);
  if (len < 0.05) return [];
  const rotY = wallAngle(wall);
  const ux = (wall.x2 - wall.x1) / len;
  const uz = (wall.z2 - wall.z1) / len;
  const openings = [...wall.openings].sort((a, b) => a.t - b.t);
  const spans: { a: number; b: number; opening?: Opening }[] = [];
  let cursor = 0;
  for (const op of openings) {
    const half = Math.min(op.width, len) / 2;
    const c = Math.min(1, Math.max(0, op.t)) * len;
    const a = Math.max(0, c - half);
    const b = Math.min(len, c + half);
    if (b - a < 0.15) continue;
    if (a > cursor + 0.02) spans.push({ a: cursor, b: a });
    spans.push({ a, b, opening: op });
    cursor = Math.max(cursor, b);
  }
  if (cursor < len - 0.02) spans.push({ a: cursor, b: len });

  const solids: Solid[] = [];
  const place = (a: number, b: number, y0: number, y1: number, kind: Solid["kind"], suffix: string) => {
    const h = y1 - y0;
    const sl = b - a;
    if (h < 0.02 || sl < 0.02) return;
    const mid = (a + b) / 2;
    solids.push({
      id: `${wall.id}:${suffix}`,
      cx: wall.x1 + ux * mid,
      cz: wall.z1 + uz * mid,
      y: y0 + h / 2,
      len: sl,
      h,
      rotY,
      kind,
    });
  };

  spans.forEach((sp, i) => {
    if (!sp.opening) {
      place(sp.a, sp.b, 0, WALL_H, "solid", `s${i}`);
      return;
    }
    if (sp.opening.type === "door") {
      place(sp.a, sp.b, DOOR_H, WALL_H, "solid", `d${i}`);
      return;
    }
    place(sp.a, sp.b, 0, WIN_SILL, "solid", `wb${i}`);
    place(sp.a, sp.b, WIN_HEAD, WALL_H, "solid", `wt${i}`);
    place(sp.a, sp.b, WIN_SILL, WIN_HEAD, "glass", `g${i}`);
  });
  return solids;
}

export function solidAabb(s: Solid, thick = WALL_T): Aabb {
  const hx = s.len / 2;
  const hz = thick / 2;
  const c = Math.abs(Math.cos(s.rotY));
  const sn = Math.abs(Math.sin(s.rotY));
  const rx = hx * c + hz * sn;
  const rz = hx * sn + hz * c;
  return { minX: s.cx - rx, maxX: s.cx + rx, minZ: s.cz - rz, maxZ: s.cz + rz };
}

/** Floor-level blockers. Lintels and glazing above the sill are ignored. */
export function blockingSolids(wall: Wall): Solid[] {
  return wallSolids(wall).filter((s) => s.kind === "solid" && s.y - s.h / 2 < 0.2);
}

export interface Blockers {
  hw: number;
  hd: number;
  items: { id: string; box: Aabb }[];
  walls: Aabb[];
}

export function blockersFor(doc: Doc): Blockers {
  const inset = WALL_T / 2 + 0.04;
  return {
    hw: doc.width / 2 - inset,
    hd: doc.depth / 2 - inset,
    items: doc.items.map((it) => ({ id: it.id, box: itemAabb(it) })),
    walls: doc.walls.flatMap((w) => blockingSolids(w).map((s) => solidAabb(s))),
  };
}

export function placementIssues(doc: Doc, item: Item, cache?: Blockers): string[] {
  const blocks = cache ?? blockersFor(doc);
  const box = itemAabb(item);
  const issues: string[] = [];
  if (box.minX < -blocks.hw || box.maxX > blocks.hw || box.minZ < -blocks.hd || box.maxZ > blocks.hd) {
    issues.push("경계 밖");
  }
  for (const other of blocks.items) {
    if (other.id === item.id) continue;
    if (overlaps(box, other.box, 0.04)) {
      issues.push("가구 겹침");
      break;
    }
  }
  for (const wall of blocks.walls) {
    if (overlaps(box, wall, 0.02)) {
      issues.push("벽과 충돌");
      break;
    }
  }
  return issues;
}

export function canPlace(doc: Doc, item: Item, cache?: Blockers): boolean {
  return placementIssues(doc, item, cache).length === 0;
}

export function openingFits(wall: Wall, op: Opening): boolean {
  const len = wallLength(wall);
  if (op.width < 0.4 || op.width > len - 0.2) return false;
  const c = op.t * len;
  const a = c - op.width / 2;
  const b = c + op.width / 2;
  if (a < 0.08 || b > len - 0.08) return false;
  for (const other of wall.openings) {
    if (other.id === op.id) continue;
    const oc = other.t * len;
    const oa = oc - other.width / 2;
    const ob = oc + other.width / 2;
    if (a < ob - 0.06 && b > oa + 0.06) return false;
  }
  return true;
}

export function nearestWall(doc: Doc, x: number, z: number): { id: string; t: number; dist: number } | null {
  let best: { id: string; t: number; dist: number } | null = null;
  for (const w of doc.walls) {
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-6) continue;
    let t = ((x - w.x1) * dx + (z - w.z1) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = w.x1 + t * dx;
    const pz = w.z1 + t * dz;
    const dist = Math.hypot(x - px, z - pz);
    if (!best || dist < best.dist) best = { id: w.id, t, dist };
  }
  return best;
}

export function glazingArea(doc: Doc): number {
  const paneH = WIN_HEAD - WIN_SILL;
  let area = 0;
  for (const w of doc.walls) {
    const len = wallLength(w);
    for (const op of w.openings) {
      if (op.type !== "window") continue;
      area += Math.min(op.width, len) * paneH;
    }
  }
  return area;
}

export function wallPlanArea(doc: Doc): number {
  let area = 0;
  for (const w of doc.walls) {
    const len = wallLength(w);
    let voidLen = 0;
    for (const op of w.openings) {
      if (op.type === "door") voidLen += Math.min(op.width, len);
    }
    area += Math.max(0, len - voidLen) * WALL_T;
  }
  return area;
}

const ZONE_PRIORITY: ZoneKind[] = ["grow", "garden", "kitchen", "rest", "work", "living", "circulation"];

export function zoneAt(zones: Zone[], x: number, z: number): ZoneKind | null {
  const hits = zones.filter((zn) => x >= zn.x && x <= zn.x + zn.w && z >= zn.z && z <= zn.z + zn.d);
  if (!hits.length) return null;
  hits.sort((a, b) => ZONE_PRIORITY.indexOf(a.kind) - ZONE_PRIORITY.indexOf(b.kind));
  return hits[0]!.kind;
}

export function zonesOverlap(a: Zone, b: Zone): boolean {
  return a.x < b.x + b.w - 0.02 && a.x + a.w > b.x + 0.02 && a.z < b.z + b.d - 0.02 && a.z + a.d > b.z + 0.02;
}

export interface AreaReport {
  gross: number;
  wall: number;
  furniture: number;
  movable: number;
  byZone: Record<ZoneKind, number>;
  unzoned: number;
  grow: number;
  glazing: number;
  overlap: boolean;
}

export function analyzeAreas(doc: Doc, step = 0.25): AreaReport {
  const gross = doc.width * doc.depth;
  const byZone = Object.fromEntries(ZONE_KINDS.map((k) => [k, 0])) as Record<ZoneKind, number>;
  const hw = doc.width / 2;
  const hd = doc.depth / 2;
  let inside = 0;
  let unzonedCells = 0;
  for (let x = -hw + step / 2; x < hw - 1e-6; x += step) {
    for (let z = -hd + step / 2; z < hd - 1e-6; z += step) {
      inside++;
      const kind = zoneAt(doc.zones, x, z);
      if (kind) byZone[kind] += 1;
      else unzonedCells += 1;
    }
  }
  const cell = step * step;
  const sampled = inside * cell;
  const scale = sampled > 0 ? gross / sampled : 1;
  for (const k of ZONE_KINDS) byZone[k] *= cell * scale;
  const unzoned = unzonedCells * cell * scale;
  const wall = wallPlanArea(doc);
  const furniture = doc.items.reduce((sum, it) => sum + footprintArea(it), 0);
  const growModules = doc.items
    .filter((it) => it.kind === "grow" && zoneAt(doc.zones, it.x, it.z) !== "grow")
    .reduce((sum, it) => sum + footprintArea(it), 0);
  let overlap = false;
  for (let i = 0; i < doc.zones.length; i++) {
    for (let j = i + 1; j < doc.zones.length; j++) {
      if (zonesOverlap(doc.zones[i]!, doc.zones[j]!)) overlap = true;
    }
  }
  return {
    gross,
    wall,
    furniture,
    movable: Math.max(0, gross - wall - furniture),
    byZone,
    unzoned,
    grow: byZone.grow + growModules,
    glazing: glazingArea(doc),
    overlap,
  };
}

export function snapValue(v: number, on: boolean, step = 0.25): number {
  if (!Number.isFinite(v)) return 0;
  if (!on) return Math.round(v * 100) / 100;
  return Math.round(v / step) * step;
}

export function snapAngle(rad: number, on: boolean): number {
  if (!on) return rad;
  const step = Math.PI / 12;
  return Math.round(rad / step) * step;
}
