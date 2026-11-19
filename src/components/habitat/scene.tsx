import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CATALOG } from "@/habitat/catalog";
import { canPlace, WALL_H, WALL_T, wallAngle, wallLength, wallSolids, type Solid } from "@/habitat/geometry";
import { daylightAltitude, daylightFactor, skyColor, sunVector } from "@/habitat/simulate";
import { materialOf, useHabitat } from "@/habitat/store";
import type { Item, Kind, Material } from "@/habitat/types";

const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const HIT = new THREE.Vector3();
const noRaycast = () => {};

const ZONE_COLOR: Record<string, string> = {
  living: "#d9d0c2",
  work: "#c9d2cb",
  rest: "#ddd6cc",
  kitchen: "#d7cbb8",
  garden: "#c5d2c4",
  grow: "#b7c9b4",
  circulation: "#d5d5d0",
};

const MATS = new Map<string, THREE.MeshStandardMaterial>();

function sharedMat(color: string, material: Material): THREE.MeshStandardMaterial {
  const key = `${material}:${color}`;
  let mat = MATS.get(key);
  if (!mat) {
    const props = materialOf(material);
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: props.roughness,
      metalness: props.metalness,
    });
    MATS.set(key, mat);
  }
  return mat;
}

function groundFromRay(ray: THREE.Ray): { x: number; z: number } | null {
  const point = ray.intersectPlane(FLOOR, HIT);
  if (!point) return null;
  return { x: point.x, z: point.z };
}

function Box({
  args,
  position,
  color,
  material,
  rotation,
  cast = false,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  material: Material;
  rotation?: [number, number, number];
  cast?: boolean;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={sharedMat(color, material)}
      castShadow={cast}
      receiveShadow
    >
      <boxGeometry args={args} />
    </mesh>
  );
}

function KindMesh({ item }: { item: Item }) {
  const spec = CATALOG[item.kind];
  const { w, d, h } = spec;
  const color = item.color;
  const material = item.material;
  switch (item.kind as Kind) {
    case "bed":
      return (
        <group>
          <Box args={[w * 0.98, 0.18, d * 0.98]} position={[0, 0.14, 0]} color="#a89880" material="oak" cast />
          <Box args={[w * 0.9, 0.18, d * 0.82]} position={[0, 0.3, 0.04]} color={color} material={material} />
          <Box args={[w * 0.96, 0.52, 0.08]} position={[0, 0.42, -d / 2 + 0.05]} color="#b7aa98" material="oak" />
          <Box args={[0.42, 0.1, 0.28]} position={[-0.38, 0.42, -d / 2 + 0.28]} color="#e4e0d8" material="linen" />
          <Box args={[0.42, 0.1, 0.28]} position={[0.38, 0.42, -d / 2 + 0.28]} color="#e4e0d8" material="linen" />
        </group>
      );
    case "desk":
      return (
        <group>
          <Box args={[w, 0.06, d]} position={[0, h - 0.03, 0]} color={color} material={material} cast />
          <Box args={[0.06, h - 0.08, d * 0.86]} position={[-w / 2 + 0.08, (h - 0.08) / 2, 0]} color="#8d7b66" material="oak" />
          <Box args={[0.06, h - 0.08, d * 0.86]} position={[w / 2 - 0.08, (h - 0.08) / 2, 0]} color="#8d7b66" material="oak" />
          <Box args={[w * 0.55, 0.28, 0.03]} position={[0, h + 0.16, -d / 2 + 0.06]} color="#2c3330" material="metal" />
        </group>
      );
    case "chair":
      return (
        <group>
          <Box args={[0.46, 0.06, 0.46]} position={[0, 0.46, 0]} color={color} material={material} />
          <Box args={[0.46, 0.4, 0.05]} position={[0, 0.7, -0.2]} color={color} material={material} />
          <Box args={[0.05, 0.46, 0.05]} position={[-0.18, 0.23, -0.18]} color="#8d7b66" material="oak" />
          <Box args={[0.05, 0.46, 0.05]} position={[0.18, 0.23, -0.18]} color="#8d7b66" material="oak" />
          <Box args={[0.05, 0.46, 0.05]} position={[-0.18, 0.23, 0.18]} color="#8d7b66" material="oak" />
          <Box args={[0.05, 0.46, 0.05]} position={[0.18, 0.23, 0.18]} color="#8d7b66" material="oak" />
        </group>
      );
    case "cabinet":
      return (
        <group>
          <Box args={[w, h, d]} position={[0, h / 2, 0]} color={color} material={material} cast />
          <Box args={[0.015, h * 0.92, d + 0.01]} position={[0, h / 2, 0]} color="#5e675f" material="oak" />
        </group>
      );
    case "sofa":
      return (
        <group>
          <Box args={[w, 0.28, d]} position={[0, 0.22, 0]} color={color} material={material} cast />
          <Box args={[w, 0.36, 0.16]} position={[0, 0.52, -d / 2 + 0.1]} color={color} material={material} />
          <Box args={[0.14, 0.32, d]} position={[-w / 2 + 0.08, 0.42, 0]} color={color} material={material} />
          <Box args={[0.14, 0.32, d]} position={[w / 2 - 0.08, 0.42, 0]} color={color} material={material} />
          <Box args={[w * 0.42, 0.1, d * 0.62]} position={[-w * 0.18, 0.4, 0.06]} color="#e4e0d8" material="linen" />
          <Box args={[w * 0.42, 0.1, d * 0.62]} position={[w * 0.18, 0.4, 0.06]} color="#e4e0d8" material="linen" />
        </group>
      );
    case "table":
      return (
        <group>
          <Box args={[w, 0.06, d]} position={[0, h - 0.03, 0]} color={color} material={material} cast />
          <Box args={[0.06, h - 0.06, 0.06]} position={[-w / 2 + 0.1, (h - 0.06) / 2, -d / 2 + 0.1]} color="#8d7b66" material="oak" />
          <Box args={[0.06, h - 0.06, 0.06]} position={[w / 2 - 0.1, (h - 0.06) / 2, -d / 2 + 0.1]} color="#8d7b66" material="oak" />
          <Box args={[0.06, h - 0.06, 0.06]} position={[-w / 2 + 0.1, (h - 0.06) / 2, d / 2 - 0.1]} color="#8d7b66" material="oak" />
          <Box args={[0.06, h - 0.06, 0.06]} position={[w / 2 - 0.1, (h - 0.06) / 2, d / 2 - 0.1]} color="#8d7b66" material="oak" />
        </group>
      );
    case "lamp":
      return <Lamp item={item} />;
    case "plant":
      return <Plant item={item} />;
    case "grow":
      return <Grow item={item} />;
    case "energy":
      return (
        <group>
          <Box args={[w, h * 0.92, d]} position={[0, h * 0.48, 0]} color={color} material="metal" cast />
          <Box args={[w * 0.7, 0.08, d * 0.7]} position={[0, h * 0.72, 0]} color="#c5d0c8" material="metal" />
          <Box args={[0.16, 0.16, 0.04]} position={[0, h * 0.55, d / 2]} color="#8ea894" material="metal" />
        </group>
      );
    case "mat":
      return <Box args={[w, h, d]} position={[0, h / 2, 0]} color={color} material={material} />;
    default:
      return <Box args={[w, h, d]} position={[0, h / 2, 0]} color={color} material={material} />;
  }
}

function Lamp({ item }: { item: Item }) {
  const spec = CATALOG.lamp;
  const shade = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: item.color,
      roughness: 0.85,
      emissive: new THREE.Color("#f0e2c8"),
      emissiveIntensity: 0.2,
    });
    return mat;
  }, [item.color]);
  const light = useRef<THREE.PointLight>(null);
  useEffect(() => () => shade.dispose(), [shade]);
  useFrame(() => {
    const env = useHabitat.getState().doc.env;
    const night = 1 - daylightFactor(env.hour);
    const level = env.artificial * (0.15 + night * 1.5);
    shade.emissiveIntensity = level;
    if (light.current) light.current.intensity = level * 1.6;
  });
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow material={sharedMat("#8d7b66", "oak")}>
        <cylinderGeometry args={[0.12, 0.14, 0.08, 16]} />
      </mesh>
      <mesh position={[0, spec.h * 0.48, 0]} castShadow material={sharedMat("#8d948f", "metal")}>
        <cylinderGeometry args={[0.025, 0.025, spec.h * 0.78, 10]} />
      </mesh>
      <mesh position={[0, spec.h - 0.08, 0]} material={shade} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.16, 20]} />
      </mesh>
      <pointLight ref={light} position={[0, spec.h - 0.2, 0]} distance={5} decay={2} color="#f3ead8" />
    </group>
  );
}

function Plant({ item }: { item: Item }) {
  const sway = useRef<THREE.Group>(null);
  const phase = useMemo(() => item.id.length * 0.7, [item.id]);
  useFrame(({ clock }, dt) => {
    const d = Math.min(dt, 0.1);
    void d;
    const vent = useHabitat.getState().doc.env.ventilation;
    if (sway.current) {
      sway.current.rotation.z = Math.sin(clock.elapsedTime * 1.1 + phase) * 0.045 * (0.25 + vent);
    }
  });
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow material={sharedMat("#a89880", "stone")}>
        <cylinderGeometry args={[0.16, 0.13, 0.32, 16]} />
      </mesh>
      <group ref={sway} position={[0, 0.32, 0]}>
        <mesh position={[0, 0.28, 0]} material={sharedMat("#5d6b52", "living")}>
          <cylinderGeometry args={[0.02, 0.03, 0.46, 8]} />
        </mesh>
        <mesh position={[0.08, 0.48, 0.02]} material={sharedMat(item.color, "living")}>
          <sphereGeometry args={[0.18, 16, 12]} />
        </mesh>
        <mesh position={[-0.1, 0.4, -0.04]} material={sharedMat("#7d9a84", "living")}>
          <sphereGeometry args={[0.14, 14, 10]} />
        </mesh>
        <mesh position={[0.02, 0.62, -0.06]} material={sharedMat("#6f8f72", "living")}>
          <sphereGeometry args={[0.12, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}

function Grow({ item }: { item: Item }) {
  const bar = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d7e2c8",
        emissive: new THREE.Color("#dfe8d4"),
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0.2,
      }),
    [],
  );
  useEffect(() => () => bar.dispose(), [bar]);
  useFrame(() => {
    const env = useHabitat.getState().doc.env;
    bar.emissiveIntensity = 0.2 + env.artificial * 0.4 + (1 - daylightFactor(env.hour)) * 0.25;
  });
  const spec = CATALOG.grow;
  return (
    <group>
      <Box args={[spec.w, spec.h, 0.04]} position={[0, spec.h / 2, -spec.d / 2 + 0.02]} color={item.color} material="metal" />
      <Box args={[0.04, spec.h, spec.d]} position={[-spec.w / 2 + 0.02, spec.h / 2, 0]} color={item.color} material="metal" />
      <Box args={[0.04, spec.h, spec.d]} position={[spec.w / 2 - 0.02, spec.h / 2, 0]} color={item.color} material="metal" />
      {[0.35, 0.75, 1.15].map((y) => (
        <group key={y}>
          <Box args={[spec.w * 0.9, 0.04, spec.d * 0.8]} position={[0, y, 0]} color="#6d5c48" material="oak" />
          <mesh position={[-0.22, y + 0.1, 0]} material={sharedMat("#6f8f72", "living")}>
            <sphereGeometry args={[0.08, 10, 8]} />
          </mesh>
          <mesh position={[0.18, y + 0.1, 0.04]} material={sharedMat("#7d9a84", "living")}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, spec.h - 0.08, 0]} material={bar}>
        <boxGeometry args={[spec.w * 0.7, 0.04, spec.d * 0.45]} />
      </mesh>
    </group>
  );
}

function Furniture({ id }: { id: string }) {
  const item = useHabitat((s) => s.doc.items.find((it) => it.id === id));
  const selected = useHabitat((s) => s.selected?.type === "item" && s.selected.id === id);
  const dragging = useHabitat((s) => s.drag?.id === id);
  const valid = useHabitat((s) => (s.drag?.id === id ? s.dragValid : true));
  if (!item) return null;
  const spec = CATALOG[item.kind];
  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const point = groundFromRay(event.ray);
    if (!point) return;
    const tool = useHabitat.getState().tool;
    if (tool === "select") useHabitat.getState().pointerDown(point.x, point.z, { type: "item", id });
    else useHabitat.getState().pointerDown(point.x, point.z);
  };
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotY, 0]}>
      <group scale={[item.sx, item.sy, item.sz]} onPointerDown={onPointerDown}>
        <KindMesh item={item} />
      </group>
      {selected || dragging ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <planeGeometry args={[spec.w * item.sx + 0.16, spec.d * item.sz + 0.16]} />
          <meshBasicMaterial color={valid ? "#8ea894" : "#c46b62"} transparent opacity={0.38} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function placedGeometry(solids: Solid[], kind: Solid["kind"]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  for (const solid of solids) {
    if (solid.kind !== kind) continue;
    const geo = new THREE.BoxGeometry(solid.len, solid.h, WALL_T);
    geo.translate(0, solid.y, 0);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationY(solid.rotY));
    geo.translate(solid.cx, 0, solid.cz);
    parts.push(geo);
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

function Shell() {
  const walls = useHabitat((s) => s.doc.walls);
  const plaster = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e4e0d8", roughness: 0.92, metalness: 0 }),
    [],
  );
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c9d4d0",
        roughness: 0.08,
        metalness: 0.04,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    [],
  );
  const solidGeo = useMemo(() => placedGeometry(walls.flatMap(wallSolids), "solid"), [walls]);
  const glassGeo = useMemo(() => placedGeometry(walls.flatMap(wallSolids), "glass"), [walls]);
  useEffect(() => () => plaster.dispose(), [plaster]);
  useEffect(() => () => glass.dispose(), [glass]);
  useEffect(() => () => solidGeo?.dispose(), [solidGeo]);
  useEffect(() => () => glassGeo?.dispose(), [glassGeo]);
  return (
    <group>
      {solidGeo ? <mesh geometry={solidGeo} material={plaster} castShadow receiveShadow /> : null}
      {glassGeo ? <mesh geometry={glassGeo} material={glass} /> : null}
    </group>
  );
}

function Doors() {
  const walls = useHabitat((s) => s.doc.walls);
  const leaves = useMemo(() => {
    const list: { key: string; x: number; z: number; rot: number }[] = [];
    for (const wall of walls) {
      const len = wallLength(wall);
      const rot = wallAngle(wall);
      const ux = (wall.x2 - wall.x1) / len;
      const uz = (wall.z2 - wall.z1) / len;
      const nx = -uz;
      const nz = ux;
      for (const opening of wall.openings) {
        if (opening.type !== "door") continue;
        const mid = opening.t * len;
        list.push({
          key: opening.id,
          x: wall.x1 + ux * mid + nx * 0.08,
          z: wall.z1 + uz * mid + nz * 0.08,
          rot: rot + 0.55,
        });
      }
    }
    return list;
  }, [walls]);
  return (
    <group>
      {leaves.map((leaf) => (
        <mesh
          key={leaf.key}
          position={[leaf.x, 1.02, leaf.z]}
          rotation={[0, leaf.rot, 0]}
          material={sharedMat("#b7aa98", "oak")}
          castShadow
          onPointerDown={(event) => {
            event.stopPropagation();
            const point = groundFromRay(event.ray);
            if (!point) return;
            useHabitat.getState().pointerDown(point.x, point.z);
          }}
        >
          <boxGeometry args={[0.78, 2.02, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}

function Zones() {
  const zones = useHabitat((s) => s.doc.zones);
  const selected = useHabitat((s) => (s.selected?.type === "zone" ? s.selected.id : null));
  return (
    <group>
      {zones.map((zone) => (
        <mesh
          key={zone.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[zone.x + zone.w / 2, 0.012, zone.z + zone.d / 2]}
          raycast={noRaycast}
        >
          <planeGeometry args={[zone.w, zone.d]} />
          <meshStandardMaterial
            color={ZONE_COLOR[zone.kind] ?? "#d9d0c2"}
            transparent
            opacity={selected === zone.id ? 0.55 : 0.32}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function Floor() {
  const width = useHabitat((s) => s.doc.width);
  const depth = useHabitat((s) => s.doc.depth);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#cfc6b8";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2800; i++) {
      const v = 176 + Math.random() * 36;
      ctx.fillStyle = `rgba(${v}, ${v - 8}, ${v - 18}, 0.16)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    ctx.strokeStyle = "rgba(80, 64, 48, 0.08)";
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(width / 2.2, depth / 2.2);
    texture.needsUpdate = true;
  }, [texture, width, depth]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[48, 48]} />
        <meshStandardMaterial color="#1a1e1b" roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerDown={(event) => {
          if (event.nativeEvent.button !== 0) return;
          const tool = useHabitat.getState().tool;
          if (tool !== "select") event.stopPropagation();
          useHabitat.getState().pointerDown(event.point.x, event.point.z);
        }}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#cfc6b8" map={texture ?? undefined} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.12, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[width, 0.18, depth]} />
        <meshStandardMaterial color="#b7aa98" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Ghost() {
  const tool = useHabitat((s) => s.tool);
  const kind = useHabitat((s) => s.pendingKind);
  const cursor = useHabitat((s) => s.cursor);
  const doc = useHabitat((s) => s.doc);
  if (tool !== "place" || !kind || !cursor) return null;
  const spec = CATALOG[kind];
  const probe: Item = {
    id: "__ghost__",
    kind,
    x: cursor.x,
    z: cursor.z,
    rotY: 0,
    sx: 1,
    sy: 1,
    sz: 1,
    color: spec.color,
    material: spec.material,
  };
  const ok = canPlace(doc, probe);
  return (
    <mesh position={[cursor.x, spec.h / 2, cursor.z]} raycast={noRaycast}>
      <boxGeometry args={[spec.w, spec.h, spec.d]} />
      <meshStandardMaterial color={ok ? "#8ea894" : "#c46b62"} transparent opacity={0.38} depthWrite={false} />
    </mesh>
  );
}

function WallPicks() {
  const walls = useHabitat((s) => s.doc.walls);
  return (
    <group>
      {walls.map((wall) => {
        const len = wallLength(wall);
        if (len < 0.05) return null;
        const rot = wallAngle(wall);
        const cx = (wall.x1 + wall.x2) / 2;
        const cz = (wall.z1 + wall.z2) / 2;
        return (
          <mesh
            key={wall.id}
            position={[cx, WALL_H / 2, cz]}
            rotation={[0, rot, 0]}
            onPointerDown={(event) => {
              event.stopPropagation();
              const tool = useHabitat.getState().tool;
              if (tool === "select") {
                useHabitat.getState().select({ type: "wall", id: wall.id });
                return;
              }
              useHabitat.getState().pointerDown(event.point.x, event.point.z);
            }}
          >
            <boxGeometry args={[len, WALL_H, WALL_T + 0.12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function Drafts() {
  const wallStart = useHabitat((s) => s.wallStart);
  const zoneStart = useHabitat((s) => s.zoneStart);
  const cursor = useHabitat((s) => s.cursor);
  if (!cursor) return null;
  if (wallStart) {
    const len = Math.hypot(cursor.x - wallStart.x, cursor.z - wallStart.z);
    const rot = Math.atan2(cursor.z - wallStart.z, cursor.x - wallStart.x);
    const cx = (cursor.x + wallStart.x) / 2;
    const cz = (cursor.z + wallStart.z) / 2;
    return (
      <mesh position={[cx, WALL_H / 2, cz]} rotation={[0, rot, 0]}>
        <boxGeometry args={[Math.max(len, 0.05), WALL_H, WALL_T]} />
        <meshStandardMaterial color="#8ea894" transparent opacity={0.35} />
      </mesh>
    );
  }
  if (zoneStart) {
    const x0 = Math.min(zoneStart.x, cursor.x);
    const z0 = Math.min(zoneStart.z, cursor.z);
    const w = Math.abs(cursor.x - zoneStart.x);
    const d = Math.abs(cursor.z - zoneStart.z);
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x0 + w / 2, 0.04, z0 + d / 2]}>
        <planeGeometry args={[Math.max(w, 0.05), Math.max(d, 0.05)]} />
        <meshBasicMaterial color="#8ea894" transparent opacity={0.35} toneMapped={false} />
      </mesh>
    );
  }
  return null;
}

function SelectedWall() {
  const wall = useHabitat((s) =>
    s.selected?.type === "wall" ? s.doc.walls.find((w) => w.id === s.selected?.id) : undefined,
  );
  if (!wall) return null;
  const len = wallLength(wall);
  const rot = wallAngle(wall);
  const cx = (wall.x1 + wall.x2) / 2;
  const cz = (wall.z1 + wall.z2) / 2;
  return (
    <mesh position={[cx, 0.03, cz]} rotation={[-Math.PI / 2, rot, 0]}>
      <planeGeometry args={[len, WALL_T + 0.12]} />
      <meshBasicMaterial color="#8ea894" toneMapped={false} />
    </mesh>
  );
}

function Items() {
  const ids = useHabitat((s) => s.doc.items.map((item) => item.id).join("|"));
  return (
    <group>
      {ids.split("|").filter(Boolean).map((id) => (
        <Furniture key={id} id={id} />
      ))}
    </group>
  );
}

function Sun() {
  const hour = useHabitat((s) => s.doc.env.hour);
  const azimuth = useHabitat((s) => s.doc.env.azimuth);
  const quality = useHabitat((s) => s.quality);
  const pos = sunVector(hour, azimuth);
  const alt = daylightAltitude(hour);
  const intensity = Math.max(0, Math.sin(Math.max(alt, 0))) * 2.6;
  const sky = skyColor(hour);
  const hemi = hour < 5 || hour > 20 ? 0.28 : 0.55;
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 26, 64]} />
      <hemisphereLight args={["#d7deda", "#6a6156", hemi]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={pos}
        intensity={intensity}
        castShadow={quality === "high"}
        shadow-mapSize={[512, 512]}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.00035}
      />
    </>
  );
}

function Rig() {
  const width = useHabitat((s) => s.doc.width);
  const depth = useHabitat((s) => s.doc.depth);
  const id = useHabitat((s) => s.doc.id);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const dist = Math.max(width, depth) * 0.92;
    camera.position.set(dist * 0.72, dist * 0.58, dist * 0.84);
    if (controls) {
      controls.target.set(0, 0.4, 0);
      controls.update();
    }
  }, [width, depth, id, camera, controls]);
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.04}
      minDistance={2.2}
      maxDistance={32}
      target={[0, 0.4, 0]}
    />
  );
}

function Bridges() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  useEffect(() => {
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    useHabitat.getState().setCapture(() => gl.domElement.toDataURL("image/png"));
  }, [gl]);
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const point = groundFromRay(raycaster.ray);
      if (point) useHabitat.getState().pointerMove(point.x, point.z);
    };
    const onUp = () => useHabitat.getState().pointerUp();
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera]);
  useEffect(() => {
    return useHabitat.subscribe((state, prev) => {
      const orbit = controlsRef.current;
      if (!orbit) return;
      if (Boolean(state.drag) !== Boolean(prev.drag)) orbit.enabled = !state.drag;
    });
  }, []);
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    acc.current.t += d;
    acc.current.n += 1;
    if (acc.current.t >= 0.5) {
      useHabitat.getState().setFps(Math.round(acc.current.n / acc.current.t));
      acc.current.t = 0;
      acc.current.n = 0;
    }
  });
  return null;
}

export function HabitatScene() {
  const quality = useHabitat((s) => s.quality);
  const view = useHabitat((s) => s.view);
  const width = useHabitat((s) => s.doc.width);
  const depth = useHabitat((s) => s.doc.depth);
  return (
    <Canvas
      shadows={quality === "high"}
      frameloop={view === "3d" ? "always" : "never"}
      dpr={quality === "high" ? [1, 1.6] : [1, 1]}
      camera={{ position: [8, 6.2, 9.2], fov: 40, near: 0.1, far: 80 }}
      gl={{
        antialias: quality === "high",
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
    >
      <Sun />
      <Floor />
      <Zones />
      <Shell />
      <Doors />
      <Items />
      <WallPicks />
      <Ghost />
      <Drafts />
      <SelectedWall />
      <Grid
        position={[0, 0.018, 0]}
        args={[width, depth]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor="#b7b1a6"
        sectionSize={1}
        sectionThickness={0.9}
        sectionColor="#8d867c"
        fadeDistance={28}
        fadeStrength={1}
        infiniteGrid={false}
        followCamera={false}
      />
      <mesh position={[0, 0.9, depth / 2 + 0.45]} raycast={noRaycast}>
        <coneGeometry args={[0.12, 0.34, 4]} />
        <meshStandardMaterial color="#8ea894" />
      </mesh>
      <Rig />
      <Bridges />
    </Canvas>
  );
}
