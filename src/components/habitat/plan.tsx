import { useRef } from "react";
import { CATALOG } from "@/habitat/catalog";
import { canPlace, footprintPoly } from "@/habitat/geometry";
import { useHabitat } from "@/habitat/store";
import { ZONE_LABEL } from "@/habitat/templates";
import type { Item, Wall, ZoneKind } from "@/habitat/types";

const ZONE_FILL: Record<ZoneKind, string> = {
  living: "#d9d0c2",
  work: "#c9d2cb",
  rest: "#ddd6cc",
  kitchen: "#d7cbb8",
  garden: "#c5d2c4",
  grow: "#b7c9b4",
  circulation: "#d5d5d0",
};

function openingMarks(wall: Wall) {
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return [];
  const ux = dx / len;
  const uz = dz / len;
  return wall.openings.map((opening) => {
    const center = opening.t * len;
    const a = Math.max(0, center - opening.width / 2);
    const b = Math.min(len, center + opening.width / 2);
    return {
      id: opening.id,
      type: opening.type,
      x1: wall.x1 + ux * a,
      z1: wall.z1 + uz * a,
      x2: wall.x1 + ux * b,
      z2: wall.z1 + uz * b,
    };
  });
}

export function FloorPlan() {
  const doc = useHabitat((s) => s.doc);
  const selected = useHabitat((s) => s.selected);
  const wallStart = useHabitat((s) => s.wallStart);
  const zoneStart = useHabitat((s) => s.zoneStart);
  const cursor = useHabitat((s) => s.cursor);
  const tool = useHabitat((s) => s.tool);
  const pending = useHabitat((s) => s.pendingKind);
  const svgRef = useRef<SVGSVGElement>(null);
  const X = (x: number) => x + doc.width / 2;
  const Y = (z: number) => doc.depth / 2 - z;

  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x - doc.width / 2, z: doc.depth / 2 - p.y };
  };

  return (
    <div className="absolute inset-0 bg-bg p-3">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none"
        viewBox={`-0.6 -0.6 ${doc.width + 1.2} ${doc.depth + 1.2}`}
        role="img"
        aria-label="평면도"
        onPointerMove={(event) => {
          const world = toWorld(event.clientX, event.clientY);
          if (world) useHabitat.getState().pointerMove(world.x, world.z);
        }}
        onPointerUp={() => useHabitat.getState().pointerUp()}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const world = toWorld(event.clientX, event.clientY);
          if (world) useHabitat.getState().pointerDown(world.x, world.z);
        }}
      >
        <rect x={0} y={0} width={doc.width} height={doc.depth} fill="#cfc6b8" />
        {Array.from({ length: Math.ceil(doc.width) + 1 }, (_, i) => (
          <line key={`vx${i}`} x1={i} y1={0} x2={i} y2={doc.depth} stroke="#b7b1a6" strokeWidth={0.02} />
        ))}
        {Array.from({ length: Math.ceil(doc.depth) + 1 }, (_, i) => (
          <line key={`hz${i}`} x1={0} y1={i} x2={doc.width} y2={i} stroke="#b7b1a6" strokeWidth={0.02} />
        ))}
        {doc.zones.map((zone) => {
          const active = selected?.type === "zone" && selected.id === zone.id;
          return (
            <g key={zone.id}>
              <rect
                x={X(zone.x)}
                y={Y(zone.z + zone.d)}
                width={zone.w}
                height={zone.d}
                fill={ZONE_FILL[zone.kind]}
                opacity={active ? 0.95 : 0.72}
                stroke={active ? "#2c3330" : "transparent"}
                strokeWidth={0.06}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (tool !== "select") {
                    const world = toWorld(event.clientX, event.clientY);
                    if (world) useHabitat.getState().pointerDown(world.x, world.z);
                    return;
                  }
                  useHabitat.getState().select({ type: "zone", id: zone.id });
                }}
              />
              <text
                x={X(zone.x + zone.w / 2)}
                y={Y(zone.z + zone.d / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={0.28}
                fill="#2c3330"
                style={{ pointerEvents: "none" }}
              >
                {ZONE_LABEL[zone.kind]}
              </text>
            </g>
          );
        })}
        {doc.walls.map((wall) => {
          const active = selected?.type === "wall" && selected.id === wall.id;
          return (
            <g key={wall.id}>
              <line
                x1={X(wall.x1)}
                y1={Y(wall.z1)}
                x2={X(wall.x2)}
                y2={Y(wall.z2)}
                stroke={active ? "#101412" : "#2c3330"}
                strokeWidth={active ? 0.18 : 0.14}
                strokeLinecap="square"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const world = toWorld(event.clientX, event.clientY);
                  if (!world) return;
                  if (tool === "select") useHabitat.getState().pointerDown(world.x, world.z, { type: "wall", id: wall.id });
                  else useHabitat.getState().pointerDown(world.x, world.z);
                }}
              />
              {openingMarks(wall).map((mark) => (
                <line
                  key={mark.id}
                  x1={X(mark.x1)}
                  y1={Y(mark.z1)}
                  x2={X(mark.x2)}
                  y2={Y(mark.z2)}
                  stroke={mark.type === "door" ? "#c46b62" : "#6d8f9a"}
                  strokeWidth={0.22}
                  strokeLinecap="butt"
                  style={{ pointerEvents: "none" }}
                />
              ))}
            </g>
          );
        })}
        {doc.items.map((item) => {
          const poly = footprintPoly(item)
            .map(([x, z]) => `${X(x)},${Y(z)}`)
            .join(" ");
          const active = selected?.type === "item" && selected.id === item.id;
          return (
            <g key={item.id}>
              <polygon
                points={poly}
                fill={active ? "#8ea894" : "#5e675f"}
                opacity={0.92}
                stroke="#101412"
                strokeWidth={0.03}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const world = toWorld(event.clientX, event.clientY);
                  if (!world) return;
                  if (tool === "select") useHabitat.getState().pointerDown(world.x, world.z, { type: "item", id: item.id });
                  else useHabitat.getState().pointerDown(world.x, world.z);
                }}
              />
              <text
                x={X(item.x)}
                y={Y(item.z)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={0.22}
                fill="#f3f4f2"
                style={{ pointerEvents: "none" }}
              >
                {CATALOG[item.kind].name}
              </text>
            </g>
          );
        })}
        {wallStart && cursor ? (
          <line
            x1={X(wallStart.x)}
            y1={Y(wallStart.z)}
            x2={X(cursor.x)}
            y2={Y(cursor.z)}
            stroke="#8ea894"
            strokeWidth={0.1}
          />
        ) : null}
        {zoneStart && cursor ? (
          <rect
            x={X(Math.min(zoneStart.x, cursor.x))}
            y={Y(Math.max(zoneStart.z, cursor.z))}
            width={Math.abs(cursor.x - zoneStart.x)}
            height={Math.abs(cursor.z - zoneStart.z)}
            fill="#8ea894"
            opacity={0.35}
          />
        ) : null}
        {tool === "place" && pending && cursor ? (
          <PlaceGhost x={cursor.x} z={cursor.z} kind={pending} X={X} Y={Y} />
        ) : null}
        <text x={doc.width / 2} y={-0.18} textAnchor="middle" fontSize={0.28} fill="#5e675f">
          북
        </text>
        <text x={0} y={doc.depth + 0.42} fontSize={0.24} fill="#5e675f">
          {doc.width.toFixed(1)}m × {doc.depth.toFixed(1)}m
        </text>
      </svg>
    </div>
  );
}

function PlaceGhost({
  x,
  z,
  kind,
  X,
  Y,
}: {
  x: number;
  z: number;
  kind: Item["kind"];
  X: (value: number) => number;
  Y: (value: number) => number;
}) {
  const doc = useHabitat((s) => s.doc);
  const spec = CATALOG[kind];
  const probe: Item = {
    id: "__ghost__",
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
  const ok = canPlace(doc, probe);
  const poly = footprintPoly(probe)
    .map(([px, pz]) => `${X(px)},${Y(pz)}`)
    .join(" ");
  return <polygon points={poly} fill={ok ? "#8ea894" : "#c46b62"} opacity={0.45} style={{ pointerEvents: "none" }} />;
}
