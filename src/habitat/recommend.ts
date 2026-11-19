import { CATALOG, KIND_ZONE } from "./catalog.ts";
import { blockersFor, canPlace, zoneAt } from "./geometry.ts";
import type { Doc, Item, Kind, Lifestyle, ZoneKind } from "./types.ts";
import { freshId } from "./templates.ts";

export const LIFESTYLE_META: Record<Lifestyle, { title: string; text: string }> = {
  reading: {
    title: "독서 중심",
    text: "낮은 조명과 의자, 수납을 여유 바닥에 더합니다.",
  },
  research: {
    title: "연구·창작",
    text: "책상과 수납, 작업 조명을 빈 작업 영역에 더합니다.",
  },
  movement: {
    title: "운동 중심",
    text: "매트를 두고 가구를 새로 채우지 않습니다. 비울 자리는 직접 지우세요.",
  },
  nature: {
    title: "자연 친화",
    text: "식물과 재배 모듈을 정원·재배 구역 쪽에 더합니다.",
  },
  remote: {
    title: "재택 업무",
    text: "책상 하나와 수납, 집중 조명을 확보합니다.",
  },
  multipurpose: {
    title: "다목적",
    text: "식탁, 작업, 휴식을 한 평면에서 나누어 둡니다.",
  },
  rest: {
    title: "개인 휴식",
    text: "침실 쪽 조명과 식물을 우선합니다.",
  },
};

const TARGETS: Record<Lifestyle, Partial<Record<Kind, number>>> = {
  reading: { chair: 2, lamp: 2, cabinet: 1, plant: 2, sofa: 1 },
  research: { desk: 2, chair: 2, lamp: 2, cabinet: 2, plant: 1 },
  movement: { mat: 1, plant: 1, lamp: 1 },
  nature: { plant: 5, grow: 2, lamp: 1, sofa: 1 },
  remote: { desk: 1, chair: 1, cabinet: 1, lamp: 2, plant: 2 },
  multipurpose: { table: 1, desk: 1, sofa: 1, plant: 2, cabinet: 1 },
  rest: { bed: 1, lamp: 2, plant: 2, sofa: 1, chair: 1 },
};

const MIX: Record<Lifestyle, ZoneKind[]> = {
  reading: ["rest", "living", "work", "garden", "kitchen", "grow"],
  research: ["work", "rest", "living", "kitchen", "garden", "grow"],
  movement: ["living", "garden", "rest", "work", "kitchen", "grow"],
  nature: ["garden", "grow", "living", "rest", "kitchen", "work"],
  remote: ["work", "rest", "living", "kitchen", "garden", "grow"],
  multipurpose: ["living", "work", "rest", "kitchen", "garden", "grow"],
  rest: ["rest", "living", "garden", "kitchen", "work", "grow"],
};

function makeItem(kind: Kind, x: number, z: number): Item {
  const spec = CATALOG[kind];
  return {
    id: freshId(kind),
    kind,
    x,
    z,
    rotY: 0,
    sx: 1,
    sy: 1,
    sz: 1,
    color: spec.color,
    material: spec.material,
  };
}

export function findSpot(doc: Doc, kind: Kind): { x: number; z: number } | null {
  const prefer = KIND_ZONE[kind];
  const step = 0.5;
  const blocks = blockersFor(doc);
  let best: { x: number; z: number; score: number } | null = null;
  const x0 = -doc.width / 2 + 0.4;
  const x1 = doc.width / 2 - 0.4;
  const z0 = -doc.depth / 2 + 0.4;
  const z1 = doc.depth / 2 - 0.4;
  for (let x = x0; x <= x1; x += step) {
    for (let z = z0; z <= z1; z += step) {
      const probe = makeItem(kind, x, z);
      probe.id = "__probe__";
      if (!canPlace(doc, probe, blocks)) continue;
      const zone = zoneAt(doc.zones, x, z);
      const score = (zone === prefer ? 8 : 0) - Math.hypot(x, z) * 0.05;
      if (!best || score > best.score) best = { x, z, score };
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

export function applyLifestyle(doc: Doc, lifestyle: Lifestyle): { doc: Doc; note: string } {
  const next: Doc = structuredClone(doc);
  next.lifestyle = lifestyle;
  const ranked = [...next.zones].sort((a, b) => b.w * b.d - a.w * a.d);
  const pref = MIX[lifestyle];
  ranked.forEach((zone, index) => {
    const found = next.zones.find((z) => z.id === zone.id);
    if (found) found.kind = pref[Math.min(index, pref.length - 1)]!;
  });
  const targets = TARGETS[lifestyle];
  let added = 0;
  for (const kind of Object.keys(targets) as Kind[]) {
    const want = targets[kind] ?? 0;
    let have = next.items.filter((it) => it.kind === kind).length;
    while (have < want) {
      const spot = findSpot(next, kind);
      if (!spot) break;
      next.items.push(makeItem(kind, spot.x, spot.z));
      have++;
      added++;
    }
  }
  const note = added
    ? `${LIFESTYLE_META[lifestyle].title}: 빈 자리에 ${added}개를 더했습니다. 기존 가구는 지우지 않습니다. 실행 취소로 되돌릴 수 있습니다.`
    : `${LIFESTYLE_META[lifestyle].title}: 더 넣을 빈 자리가 없거나 이미 권장 수량입니다. 기존 가구는 유지됩니다.`;
  return { doc: next, note };
}
