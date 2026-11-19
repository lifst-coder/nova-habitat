import { CATALOG } from "./catalog.ts";
import { analyzeAreas, WALL_H } from "./geometry.ts";
import type { Doc } from "./types.ts";

/** Indicative model only — not a rating, audit, or measured bill. */
export const MODEL_NOTES = [
  "인증·실측·고지서 값이 아닙니다. 같은 모형을 둔 설계안끼리 비교하는 가상 계산입니다.",
  "외피 열관류율 U=0.28 W/㎡·K, 냉난방 COP=3.5 로 고정했습니다. 실제 창호·기밀·설비와 다릅니다.",
  "바깥 기온은 온대 설계일의 사인파입니다. 시각만 바뀌며, 기상 데이터를 쓰지 않습니다.",
  "채광은 창면적과 태양고도만 봅니다. 인동, 차양, 실내 반사, 향별 일사는 생략합니다.",
  "환기 슬라이더는 열회수 정도로 선형 반영합니다. 습도는 쾌적 가중(45%에서 최소)만 줍니다.",
  "기기 전력은 카탈로그 와트를 하루 일정 비율로 더한 값이고, 에너지 장치의 발전은 상쇄 한도가 있습니다.",
  "비용은 2026년 기준이 아닌 비교용 단가입니다. 외벽 모서리 면적은 중복 차감하지 않습니다.",
  "바닥 면적은 외벽 중심선 사이 가로×세로입니다.",
];

export function daylightFactor(hour: number): number {
  if (hour <= 5.2 || hour >= 19.2) return 0;
  const x = (hour - 5.2) / (19.2 - 5.2);
  return Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
}

export function daylightAltitude(hour: number): number {
  if (hour < 5 || hour > 19.4) return -0.12;
  const s = Math.sin(((hour - 6) / 12) * Math.PI);
  return Math.max(-0.12, s * 1.05);
}

export function outdoorTemp(hour: number): number {
  return 16 + 9 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
}

export function sunVector(hour: number, azimuthDeg: number): [number, number, number] {
  const alt = daylightAltitude(hour);
  const az = (azimuthDeg * Math.PI) / 180;
  const r = 18;
  const y = Math.sin(alt) * r;
  const horiz = Math.cos(Math.max(alt, -0.2)) * r;
  const x = Math.sin(az) * horiz;
  const z = -Math.cos(az) * horiz;
  return [x, Math.max(y, 1.2), z];
}

export function skyColor(hour: number): string {
  if (hour < 5 || hour >= 20.2) return "#15191c";
  if (hour < 7) return "#c4a08c";
  if (hour < 17) return "#c5d0d4";
  if (hour < 19.4) return "#c98b73";
  return "#1b2430";
}

export function formatHour(hour: number): string {
  if (hour >= 24) return "24:00";
  const hh = Math.floor(hour);
  const mm = Math.min(59, Math.round((hour - hh) * 60));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function dayPhase(hour: number): string {
  if (hour < 5 || hour >= 20) return "밤";
  if (hour < 8) return "새벽";
  if (hour < 11) return "아침";
  if (hour < 14) return "정오";
  if (hour < 17) return "오후";
  return "저녁";
}

export interface Estimate {
  hvacKwh: number;
  lightKwh: number;
  plugKwh: number;
  generationKwh: number;
  netKwh: number;
  daylightIndex: number;
  nowOutdoor: number;
  nowSunDeg: number;
  shellKrw: number;
  furnKrw: number;
  glazingKrw: number;
  gardenKrw: number;
  costKrw: number;
  gross: number;
  movable: number;
  furniture: number;
  grow: number;
  glazing: number;
  byZone: ReturnType<typeof analyzeAreas>["byZone"];
  unzoned: number;
  overlap: boolean;
  occupancy: number;
}

const SHELL_PER_M2 = 2_850_000;
const GLAZING_PER_M2 = 420_000;
const GARDEN_PER_M2 = 160_000;

export function estimate(doc: Doc): Estimate {
  const areas = analyzeAreas(doc);
  const envelope = 2 * (doc.width + doc.depth) * WALL_H + doc.width * doc.depth;
  const glazingRatio = Math.min(1, areas.glazing / Math.max(6, areas.gross * 0.22));
  let hvac = 0;
  let light = 0;
  for (let h = 0; h < 24; h++) {
    const tout = outdoorTemp(h + 0.5);
    const delta = Math.abs(tout - doc.env.temperature);
    const vent = 1 - doc.env.ventilation * 0.55;
    const hum = 1 + Math.abs(doc.env.humidity - 45) / 220;
    const watts = (Math.max(0, delta - 1.2) * 0.28 * envelope * vent * hum) / 3.5;
    hvac += watts / 1000;
    const df = daylightFactor(h + 0.5);
    const daylightUse = df * glazingRatio;
    const lightW = areas.gross * 6 * doc.env.artificial * (1 - daylightUse);
    light += lightW / 1000;
  }
  let plugW = 0;
  let genW = 0;
  for (const item of doc.items) {
    const w = CATALOG[item.kind].watts;
    if (w >= 0) plugW += w;
    else genW += -w;
  }
  const plugKwh = (plugW * 10) / 1000;
  const generationKwh = Math.min((genW * 8) / 1000, (hvac + light + plugKwh) * 0.7);
  const net = Math.max(0, hvac + light + plugKwh - generationKwh);
  const now = daylightFactor(doc.env.hour);
  const noon = daylightFactor(12.5);
  const glazingScore = (areas.glazing / Math.max(areas.gross, 1)) * 130 * (0.4 + noon * 0.35);
  const daylightIndex = Math.max(0, Math.min(100, Math.round(glazingScore + now * 38)));
  const furnKrw = doc.items.reduce((sum, it) => {
    const spec = CATALOG[it.kind];
    const scale = (it.sx + it.sy + it.sz) / 3;
    return sum + spec.price * (0.82 + 0.18 * scale);
  }, 0);
  const shellKrw = areas.gross * SHELL_PER_M2;
  const glazingKrw = areas.glazing * GLAZING_PER_M2;
  const gardenKrw = (areas.byZone.garden + areas.byZone.grow) * GARDEN_PER_M2;
  return {
    hvacKwh: hvac,
    lightKwh: light,
    plugKwh,
    generationKwh,
    netKwh: net,
    daylightIndex,
    nowOutdoor: outdoorTemp(doc.env.hour),
    nowSunDeg: (daylightAltitude(doc.env.hour) * 180) / Math.PI,
    shellKrw,
    furnKrw,
    glazingKrw,
    gardenKrw,
    costKrw: shellKrw + furnKrw + glazingKrw + gardenKrw,
    gross: areas.gross,
    movable: areas.movable,
    furniture: areas.furniture,
    grow: areas.grow,
    glazing: areas.glazing,
    byZone: areas.byZone,
    unzoned: areas.unzoned,
    overlap: areas.overlap,
    occupancy: areas.gross > 0 ? areas.furniture / areas.gross : 0,
  };
}

export function krw(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.round(Math.abs(n)).toLocaleString("ko-KR")}원`;
}
