import { CATALOG } from "./catalog.ts";
import type { Concept, Doc, Item, Kind, Opening, Wall, Zone, ZoneKind } from "./types.ts";
import { DEFAULT_ENV } from "./types.ts";

export const CONCEPT_META: Record<
  Concept,
  { title: string; text: string; lifestyle: Doc["lifestyle"] }
> = {
  nature: {
    title: "자연 통합 주택",
    text: "서측 실내 정원과 재배 모듈, 남측의 긴 채광.",
    lifestyle: "nature",
  },
  studio: {
    title: "창작 연구 스튜디오",
    text: "작업면을 중심에 두고 수납과 집중 조명을 둡니다.",
    lifestyle: "research",
  },
  compact: {
    title: "컴팩트 모듈 주거",
    text: "6.4×5m. 잠·일·재배를 최소 가구로 겹칩니다.",
    lifestyle: "multipurpose",
  },
  autonomous: {
    title: "자율 미래 서식지",
    text: "에너지 장치와 재배 띠가 외곽을 두른 개방 평면.",
    lifestyle: "remote",
  },
  custom: {
    title: "빈 대지",
    text: "외벽과 출입문만 있는 10×8m. 구획은 직접 그립니다.",
    lifestyle: "multipurpose",
  },
};

const ZONE_LABEL: Record<ZoneKind, string> = {
  living: "거실",
  work: "작업",
  rest: "휴식",
  kitchen: "주방",
  garden: "실내 정원",
  grow: "재배",
  circulation: "이동",
};

export { ZONE_LABEL };

function op(id: string, type: Opening["type"], t: number, width: number): Opening {
  return { id, type, t, width };
}

function shell(
  w: number,
  d: number,
  spec: Partial<Record<"s" | "e" | "n" | "w", Opening[]>>,
): Wall[] {
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  return [
    { id: "shell-s", x1: x0, z1: z0, x2: x1, z2: z0, openings: spec.s ?? [] },
    { id: "shell-e", x1: x1, z1: z0, x2: x1, z2: z1, openings: spec.e ?? [] },
    { id: "shell-n", x1: x1, z1: z1, x2: x0, z2: z1, openings: spec.n ?? [] },
    { id: "shell-w", x1: x0, z1: z1, x2: x0, z2: z0, openings: spec.w ?? [] },
  ];
}

function wall(id: string, x1: number, z1: number, x2: number, z2: number, openings: Opening[]): Wall {
  return { id, x1, z1, x2, z2, openings };
}

function zone(id: string, kind: ZoneKind, x: number, z: number, w: number, d: number): Zone {
  return { id, kind, x, z, w, d };
}

function item(
  id: string,
  kind: Kind,
  x: number,
  z: number,
  rotY = 0,
  extra?: Partial<Pick<Item, "sx" | "sy" | "sz" | "color" | "material">>,
): Item {
  const spec = CATALOG[kind];
  return {
    id,
    kind,
    x,
    z,
    rotY,
    sx: extra?.sx ?? 1,
    sy: extra?.sy ?? 1,
    sz: extra?.sz ?? 1,
    color: extra?.color ?? spec.color,
    material: extra?.material ?? spec.material,
  };
}

function base(concept: Concept, width: number, depth: number, walls: Wall[], zones: Zone[], items: Item[]): Doc {
  const meta = CONCEPT_META[concept];
  return {
    version: 1,
    id: `project-${concept}`,
    name: meta.title,
    concept,
    lifestyle: meta.lifestyle,
    width,
    depth,
    walls,
    zones,
    items,
    env: { ...DEFAULT_ENV },
  };
}

function nature(): Doc {
  const w = 12;
  const d = 9;
  const walls = [
    ...shell(w, d, {
      s: [op("n-door-s", "door", 0.42, 0.96), op("n-win-s", "window", 0.74, 2.2)],
      e: [op("n-win-e", "window", 0.62, 1.8)],
      n: [op("n-win-n1", "window", 0.28, 1.7), op("n-win-n2", "window", 0.72, 2.1)],
      w: [op("n-win-w1", "window", 0.32, 1.8), op("n-win-w2", "window", 0.7, 1.8)],
    }),
    wall("n-part-g", -3.05, -4.5, -3.05, 4.5, [op("n-door-g", "door", 0.42, 0.9)]),
    wall("n-part-c", -3.05, 0.85, 6, 0.85, [op("n-door-c1", "door", 0.22, 0.9), op("n-door-c2", "door", 0.68, 0.9)]),
    wall("n-part-r", 1.15, 0.85, 1.15, 4.5, [op("n-door-r", "door", 0.5, 0.86)]),
  ];
  const zones = [
    zone("z-garden", "garden", -6, -4.5, 2.95, 5.35),
    zone("z-grow", "grow", -6, 0.85, 2.95, 3.65),
    zone("z-living", "living", -3.05, -4.5, 5.5, 5.35),
    zone("z-kitchen", "kitchen", 2.45, -4.5, 3.55, 5.35),
    zone("z-rest", "rest", -3.05, 0.85, 4.2, 3.65),
    zone("z-work", "work", 1.15, 0.85, 4.85, 3.65),
  ];
  const items = [
    item("n-p1", "plant", -4.7, -2.7),
    item("n-p2", "plant", -4.55, -0.55),
    item("n-p3", "plant", -4.65, 0.15),
    item("n-g1", "grow", -4.55, 2.15),
    item("n-g2", "grow", -4.55, 3.5),
    item("n-bed", "bed", -0.95, 2.7),
    item("n-lamp-r", "lamp", 0.4, 3.75),
    item("n-p4", "plant", -2.35, 3.7),
    item("n-desk", "desk", 3.55, 3.4),
    item("n-chair-w", "chair", 3.55, 2.5),
    item("n-cab", "cabinet", 5.2, 2.15, Math.PI / 2),
    item("n-lamp-w", "lamp", 2.15, 3.55),
    item("n-energy", "energy", 5.15, 3.55),
    item("n-sofa", "sofa", -1.15, -1.85),
    item("n-table-l", "table", -1.15, -3.4, 0, { sx: 0.85, sz: 0.9 }),
    item("n-p5", "plant", 0.85, -3.45),
    item("n-table-k", "table", 4.35, -2.05),
    item("n-chair-k", "chair", 3.15, -2.05),
  ];
  return base("nature", w, d, walls, zones, items);
}

function studio(): Doc {
  const w = 10;
  const d = 8;
  const walls = [
    ...shell(w, d, {
      s: [op("s-door", "door", 0.3, 0.9), op("s-win", "window", 0.68, 1.8)],
      e: [op("s-win-e", "window", 0.55, 1.6)],
      n: [op("s-win-n", "window", 0.5, 2.4)],
      w: [op("s-win-w", "window", 0.45, 1.5)],
    }),
    wall("s-cross", -5, 0.4, 5, 0.4, [op("s-door-c", "door", 0.32, 0.9), op("s-door-c2", "door", 0.72, 0.9)]),
    wall("s-split", 1.6, -4, 1.6, 0.4, [op("s-door-k", "door", 0.55, 0.86)]),
  ];
  const zones = [
    zone("s-work", "work", -5, 0.4, 8.3, 3.6),
    zone("s-rest", "rest", -5, -4, 6.6, 4.4),
    zone("s-kit", "kitchen", 1.6, -4, 3.4, 4.4),
    zone("s-garden", "garden", 3.3, 0.4, 1.7, 3.6),
  ];
  const items = [
    item("s-desk1", "desk", -2.6, 2.55),
    item("s-desk2", "desk", 0.2, 2.55),
    item("s-c1", "chair", -2.6, 1.65),
    item("s-c2", "chair", 0.2, 1.65),
    item("s-cab1", "cabinet", -4.15, 2.7, Math.PI / 2),
    item("s-cab2", "cabinet", 2.35, 1.35, Math.PI / 2),
    item("s-lamp1", "lamp", -1.05, 3.15),
    item("s-lamp2", "lamp", 1.15, 3.15),
    item("s-energy", "energy", 4.15, 3.15),
    item("s-plant", "plant", 4.15, 1.35),
    item("s-bed", "bed", -2.4, -1.7),
    item("s-lamp-b", "lamp", -0.55, -0.7),
    item("s-sofa", "sofa", -1.2, -3.15, 0, { sx: 0.85 }),
    item("s-table", "table", 3.35, -2.2, Math.PI / 2, { sx: 0.8 }),
    item("s-chair-k", "chair", 3.35, -1.15),
  ];
  return base("studio", w, d, walls, zones, items);
}

function compact(): Doc {
  const w = 6.4;
  const d = 5;
  const walls = [
    ...shell(w, d, {
      s: [op("c-door", "door", 0.72, 0.86)],
      e: [op("c-win-e", "window", 0.55, 1.2)],
      n: [op("c-win-n", "window", 0.45, 1.4)],
      w: [op("c-win-w", "window", 0.4, 1.1)],
    }),
    wall("c-part", -0.2, -2.5, -0.2, 0.15, [op("c-door-p", "door", 0.62, 0.8)]),
  ];
  const zones = [
    zone("c-rest", "rest", -3.2, 0.15, 6.4, 2.35),
    zone("c-grow", "grow", -3.2, -2.5, 1.5, 2.65),
    zone("c-live", "living", -1.7, -2.5, 1.5, 2.65),
    zone("c-kit", "kitchen", -0.2, -2.5, 3.4, 2.65),
  ];
  const items = [
    item("c-bed", "bed", -0.85, 1.15, 0, { sx: 0.82, sz: 0.86 }),
    item("c-desk", "desk", 1.55, 1.25, 0, { sx: 0.85 }),
    item("c-chair", "chair", 1.55, 0.5),
    item("c-lamp", "lamp", -2.45, 1.55),
    item("c-cab", "cabinet", 2.45, -0.55, Math.PI / 2, { sy: 0.85 }),
    item("c-grow", "grow", 1.15, -1.45),
    item("c-plant", "plant", -2.45, -0.35),
    item("c-mat", "mat", -1.7, -1.45, 0, { sx: 0.75 }),
    item("c-energy", "energy", 2.55, 0.45),
  ];
  return base("compact", w, d, walls, zones, items);
}

function autonomous(): Doc {
  const w = 11;
  const d = 11;
  const walls = [
    ...shell(w, d, {
      s: [op("a-door", "door", 0.5, 1.1), op("a-win-s", "window", 0.22, 1.8), op("a-win-s2", "window", 0.78, 1.8)],
      e: [op("a-win-e", "window", 0.35, 2), op("a-win-e2", "window", 0.72, 1.6)],
      n: [op("a-win-n", "window", 0.3, 2.2), op("a-win-n2", "window", 0.7, 2)],
      w: [op("a-win-w", "window", 0.32, 2), op("a-win-w2", "window", 0.7, 1.6)],
    }),
    wall("a-fin-w", -2.2, -1.2, -2.2, 2.6, []),
    wall("a-fin-e", 2.4, -2.4, 2.4, 1.2, [op("a-door-e", "door", 0.5, 0.9)]),
  ];
  const zones = [
    zone("a-live", "living", -2.2, -2.2, 4.6, 4.4),
    zone("a-south", "living", -2.2, -5.5, 4.6, 3.3),
    zone("a-work", "work", -2.2, 2.2, 4.6, 3.3),
    zone("a-rest", "rest", -5.5, -1.2, 3.3, 3.4),
    zone("a-kit", "kitchen", 2.4, -2.2, 3.1, 4.4),
    zone("a-g1", "garden", -5.5, -5.5, 3.3, 4.3),
    zone("a-g2", "grow", -5.5, 2.2, 3.3, 3.3),
    zone("a-g3", "grow", 2.4, 2.2, 3.1, 3.3),
    zone("a-g4", "garden", 2.4, -5.5, 3.1, 3.3),
  ];
  const items = [
    item("a-sofa", "sofa", 0.1, -0.6),
    item("a-table", "table", 0.1, -2.55, 0, { sx: 0.9 }),
    item("a-desk", "desk", 1.2, 3.55),
    item("a-chair", "chair", 1.2, 2.65),
    item("a-bed", "bed", -3.9, 1.5, Math.PI / 2),
    item("a-lamp", "lamp", -3.15, 3.4),
    item("a-cab", "cabinet", -4.55, -0.2, Math.PI / 2),
    item("a-p1", "plant", -4.5, -3.6),
    item("a-p2", "plant", -3.5, -4.4),
    item("a-p3", "plant", 3.6, -4.3),
    item("a-g1", "grow", -4.35, 3.7),
    item("a-g2", "grow", 3.7, 3.55),
    item("a-e1", "energy", -4.7, 2.9),
    item("a-e2", "energy", 4.15, -1.15),
    item("a-mat", "mat", 3.5, -2.7, Math.PI / 2, { sx: 0.8 }),
    item("a-lamp2", "lamp", 3.2, 0.2),
  ];
  return base("autonomous", w, d, walls, zones, items);
}

function custom(): Doc {
  const w = 10;
  const d = 8;
  return base(
    "custom",
    w,
    d,
    shell(w, d, {
      s: [op("u-door", "door", 0.5, 0.96)],
      n: [op("u-win", "window", 0.5, 2)],
      e: [op("u-win-e", "window", 0.5, 1.4)],
    }),
    [zone("u-live", "living", -5, -4, 10, 8)],
    [],
  );
}

const BUILDERS: Record<Concept, () => Doc> = {
  nature,
  studio,
  compact,
  autonomous,
  custom,
};

export function buildConcept(concept: Concept): Doc {
  return BUILDERS[concept]();
}

export function freshId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}-${rand}${time}`;
}
