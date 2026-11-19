export const KINDS = [
  "bed",
  "desk",
  "chair",
  "cabinet",
  "sofa",
  "table",
  "lamp",
  "plant",
  "grow",
  "energy",
  "mat",
] as const;
export type Kind = (typeof KINDS)[number];

export const ZONE_KINDS = [
  "living",
  "work",
  "rest",
  "kitchen",
  "garden",
  "grow",
  "circulation",
] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];

export const MATERIALS = ["oak", "linen", "stone", "metal", "glass", "living"] as const;
export type Material = (typeof MATERIALS)[number];

export const CONCEPTS = ["nature", "studio", "compact", "autonomous", "custom"] as const;
export type Concept = (typeof CONCEPTS)[number];

export const LIFESTYLES = [
  "reading",
  "research",
  "movement",
  "nature",
  "remote",
  "multipurpose",
  "rest",
] as const;
export type Lifestyle = (typeof LIFESTYLES)[number];

export interface Opening {
  id: string;
  type: "door" | "window";
  /** Center along the wall, 0–1. */
  t: number;
  width: number;
}

export interface Wall {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  openings: Opening[];
}

export interface Zone {
  id: string;
  kind: ZoneKind;
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Item {
  id: string;
  kind: Kind;
  x: number;
  z: number;
  rotY: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  material: Material;
}

export interface Env {
  hour: number;
  azimuth: number;
  temperature: number;
  humidity: number;
  ventilation: number;
  artificial: number;
}

export interface Doc {
  version: 1;
  id: string;
  name: string;
  concept: Concept;
  lifestyle: Lifestyle;
  width: number;
  depth: number;
  walls: Wall[];
  zones: Zone[];
  items: Item[];
  env: Env;
}

export const DEFAULT_ENV: Env = {
  hour: 15,
  azimuth: 198,
  temperature: 22,
  humidity: 48,
  ventilation: 0.62,
  artificial: 0.35,
};

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

export function clampEnv(e: Env): Env {
  return {
    hour: clamp(Number.isFinite(e.hour) ? e.hour : 12, 0, 24),
    azimuth: ((Number.isFinite(e.azimuth) ? e.azimuth : 180) % 360 + 360) % 360,
    temperature: clamp(Number.isFinite(e.temperature) ? e.temperature : 22, 16, 28),
    humidity: clamp(Number.isFinite(e.humidity) ? e.humidity : 45, 25, 75),
    ventilation: clamp(Number.isFinite(e.ventilation) ? e.ventilation : 0.5, 0, 1),
    artificial: clamp(Number.isFinite(e.artificial) ? e.artificial : 0.3, 0, 1),
  };
}
