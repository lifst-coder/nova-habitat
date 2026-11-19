import type { Kind, Material, ZoneKind } from "./types.ts";

export interface Spec {
  name: string;
  w: number;
  d: number;
  h: number;
  color: string;
  material: Material;
  price: number;
  watts: number;
  blurb: string;
}

export const CATALOG: Record<Kind, Spec> = {
  bed: {
    name: "침대",
    w: 2.05,
    d: 1.55,
    h: 0.55,
    color: "#c9beb0",
    material: "linen",
    price: 1_450_000,
    watts: 0,
    blurb: "낮은 프레임",
  },
  desk: {
    name: "책상",
    w: 1.6,
    d: 0.72,
    h: 0.75,
    color: "#b9a58d",
    material: "oak",
    price: 820_000,
    watts: 18,
    blurb: "작업면",
  },
  chair: {
    name: "의자",
    w: 0.52,
    d: 0.52,
    h: 0.9,
    color: "#d5d0c8",
    material: "linen",
    price: 280_000,
    watts: 0,
    blurb: "좌석",
  },
  cabinet: {
    name: "수납장",
    w: 1.15,
    d: 0.42,
    h: 1.85,
    color: "#b7aa98",
    material: "oak",
    price: 960_000,
    watts: 0,
    blurb: "벽면 수납",
  },
  sofa: {
    name: "소파",
    w: 2.15,
    d: 0.9,
    h: 0.78,
    color: "#c3b7a6",
    material: "linen",
    price: 1_680_000,
    watts: 0,
    blurb: "긴 좌석",
  },
  table: {
    name: "식탁",
    w: 1.5,
    d: 0.85,
    h: 0.74,
    color: "#c4b39a",
    material: "oak",
    price: 740_000,
    watts: 0,
    blurb: "공유 테이블",
  },
  lamp: {
    name: "조명",
    w: 0.28,
    d: 0.28,
    h: 1.45,
    color: "#ddd6cc",
    material: "linen",
    price: 220_000,
    watts: 9,
    blurb: "스탠드",
  },
  plant: {
    name: "식물",
    w: 0.46,
    d: 0.46,
    h: 1.15,
    color: "#6f8f72",
    material: "living",
    price: 90_000,
    watts: 0,
    blurb: "화분",
  },
  grow: {
    name: "재배 모듈",
    w: 1.15,
    d: 0.58,
    h: 1.7,
    color: "#8ea894",
    material: "metal",
    price: 2_400_000,
    watts: 48,
    blurb: "다단 재배",
  },
  energy: {
    name: "에너지 장치",
    w: 0.62,
    d: 0.38,
    h: 1.35,
    color: "#8d948f",
    material: "metal",
    price: 3_200_000,
    watts: -140,
    blurb: "축전·제어",
  },
  mat: {
    name: "운동 매트",
    w: 1.8,
    d: 0.7,
    h: 0.06,
    color: "#8f8680",
    material: "linen",
    price: 160_000,
    watts: 0,
    blurb: "바닥 운동",
  },
};

export const SWATCHES = [
  "#cfc6b8",
  "#b9a58d",
  "#d9d3c9",
  "#8d948f",
  "#6f8f72",
  "#a89880",
  "#e4e0d8",
  "#5e675f",
];

export const KIND_ZONE: Record<Kind, ZoneKind> = {
  bed: "rest",
  desk: "work",
  chair: "work",
  cabinet: "work",
  sofa: "living",
  table: "kitchen",
  lamp: "living",
  plant: "garden",
  grow: "grow",
  energy: "work",
  mat: "living",
};

export const GROUPS: { label: string; kinds: Kind[] }[] = [
  { label: "휴식", kinds: ["bed", "sofa", "lamp", "mat"] },
  { label: "작업·식사", kinds: ["desk", "chair", "table", "cabinet"] },
  { label: "자연·기반", kinds: ["plant", "grow", "energy"] },
];

export const MATERIAL_LABEL: Record<Material, string> = {
  oak: "목재",
  linen: "직물",
  stone: "석재",
  metal: "금속",
  glass: "유리",
  living: "식생",
};
