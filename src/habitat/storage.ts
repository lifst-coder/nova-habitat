import { z } from "zod";
import { CATALOG } from "./catalog.ts";
import type { Doc } from "./types.ts";
import { CONCEPTS, KINDS, LIFESTYLES, MATERIALS, ZONE_KINDS, clampEnv } from "./types.ts";

const OpeningSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["door", "window"]),
  t: z.number().finite().min(0).max(1),
  width: z.number().finite().min(0.4).max(4),
});

const WallSchema = z.object({
  id: z.string().min(1).max(80),
  x1: z.number().finite(),
  z1: z.number().finite(),
  x2: z.number().finite(),
  z2: z.number().finite(),
  openings: z.array(OpeningSchema).max(8),
});

const ZoneSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(ZONE_KINDS),
  x: z.number().finite(),
  z: z.number().finite(),
  w: z.number().finite().min(0.4).max(40),
  d: z.number().finite().min(0.4).max(40),
});

const ItemSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(KINDS),
  x: z.number().finite().min(-40).max(40),
  z: z.number().finite().min(-40).max(40),
  rotY: z.number().finite(),
  sx: z.number().finite().min(0.35).max(2.6),
  sy: z.number().finite().min(0.35).max(2.6),
  sz: z.number().finite().min(0.35).max(2.6),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  material: z.enum(MATERIALS),
});

const EnvSchema = z.object({
  hour: z.number().finite(),
  azimuth: z.number().finite(),
  temperature: z.number().finite(),
  humidity: z.number().finite(),
  ventilation: z.number().finite(),
  artificial: z.number().finite(),
});

const DocSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(48),
  concept: z.enum(CONCEPTS),
  lifestyle: z.enum(LIFESTYLES),
  width: z.number().finite().min(4).max(24),
  depth: z.number().finite().min(4).max(24),
  walls: z.array(WallSchema).max(48),
  zones: z.array(ZoneSchema).max(24),
  items: z.array(ItemSchema).max(80),
  env: EnvSchema,
});

export type ParseResult = { ok: true; doc: Doc } | { ok: false; error: string };

function uniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

export function parseDoc(input: unknown): ParseResult {
  const source =
    input && typeof input === "object" && "doc" in input ? (input as { doc: unknown }).doc : input;
  const parsed = DocSchema.safeParse(source);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `설계 형식이 아닙니다. ${issue.path.join(".")}` : "설계 형식이 아닙니다." };
  }
  const doc = parsed.data;
  const ids = [
    doc.id,
    ...doc.walls.map((w) => w.id),
    ...doc.walls.flatMap((w) => w.openings.map((o) => o.id)),
    ...doc.zones.map((z) => z.id),
    ...doc.items.map((it) => it.id),
  ];
  if (!uniqueIds(ids)) return { ok: false, error: "식별자가 중복되어 불러올 수 없습니다." };
  for (const item of doc.items) {
    if (!CATALOG[item.kind]) return { ok: false, error: "알 수 없는 가구입니다." };
  }
  return { ok: true, doc: { ...doc, env: clampEnv(doc.env), version: 1 } };
}

export interface SavedProject {
  savedAt: number;
  doc: Doc;
}

export interface Archive {
  version: 1;
  activeId: string;
  projects: SavedProject[];
}

const KEY = "nova-habitat.v1";

export function loadArchive(): Archive | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const json = JSON.parse(raw) as { activeId?: unknown; projects?: unknown };
    if (!json || !Array.isArray(json.projects)) return null;
    const projects: SavedProject[] = [];
    for (const entry of json.projects) {
      if (!entry || typeof entry !== "object") continue;
      const parsed = parseDoc((entry as { doc?: unknown }).doc);
      if (!parsed.ok) continue;
      const savedAt = Number((entry as { savedAt?: unknown }).savedAt);
      projects.push({ savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(), doc: parsed.doc });
    }
    if (!projects.length) return null;
    const activeId = projects.some((p) => p.doc.id === json.activeId) ? String(json.activeId) : projects[0]!.doc.id;
    return { version: 1, activeId, projects };
  } catch {
    return null;
  }
}

export function writeArchive(archive: Archive): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(KEY, JSON.stringify(archive));
    return { ok: true };
  } catch {
    return { ok: false, error: "이 브라우저 저장 공간이 가득 찼습니다." };
  }
}

export function exportPayload(doc: Doc): string {
  return JSON.stringify(
    {
      format: "nova-habitat",
      version: 1,
      disclaimer: "가상 추정치를 포함하지 않는 설계 데이터입니다. 성능 인증이 아닙니다.",
      doc,
    },
    null,
    2,
  );
}
