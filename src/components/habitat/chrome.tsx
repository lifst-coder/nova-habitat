import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Copy,
  DoorOpen,
  Download,
  Leaf,
  PanelRight,
  Redo2,
  RotateCw,
  Save,
  Square,
  SunMedium,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { CATALOG, GROUPS, MATERIAL_LABEL, SWATCHES } from "@/habitat/catalog";
import { wallLength } from "@/habitat/geometry";
import { LIFESTYLE_META } from "@/habitat/recommend";
import { dayPhase, estimate, formatHour, krw, MODEL_NOTES } from "@/habitat/simulate";
import { exportPayload } from "@/habitat/storage";
import { useHabitat, type Tool } from "@/habitat/store";
import { CONCEPT_META, ZONE_LABEL } from "@/habitat/templates";
import type { Concept, Lifestyle, Material, ZoneKind } from "@/habitat/types";
import { CONCEPTS, LIFESTYLES, MATERIALS, ZONE_KINDS } from "@/habitat/types";

function Btn({
  children,
  onClick,
  variant = "ghost",
  active,
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const look =
    variant === "primary"
      ? "bg-accent text-accent-fg"
      : variant === "danger"
        ? "border border-line text-danger"
        : "border border-line bg-subtle text-fg";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`motion inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 ${look} ${active ? "ring-2 ring-accent" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: "select", label: "선택", icon: <Box className="size-4" /> },
  { id: "wall", label: "벽", icon: <Square className="size-4" /> },
  { id: "door", label: "문", icon: <DoorOpen className="size-4" /> },
  { id: "window", label: "창", icon: <SunMedium className="size-4" /> },
  { id: "zone", label: "구역", icon: <Leaf className="size-4" /> },
];

export function TopBar() {
  const name = useHabitat((s) => s.doc.name);
  const canUndo = useHabitat((s) => s.past.length > 0);
  const canRedo = useHabitat((s) => s.future.length > 0);
  const savedAt = useHabitat((s) => s.savedAt);
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const savedLabel = savedAt
    ? `저장됨 ${new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
    : "저장 전";

  const downloadJson = () => {
    const doc = useHabitat.getState().doc;
    const blob = new Blob([exportPayload(doc)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMenu(false);
  };

  const capture = () => {
    const url = useHabitat.getState().capture?.();
    if (!url) {
      useHabitat.getState().setNotice("3D 장면이 준비된 뒤에 캡처할 수 있습니다.");
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = `${useHabitat.getState().doc.name}.png`;
    link.click();
    setMenu(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-elev px-3">
      <p className="hidden font-display text-lg text-fg sm:block">NOVA</p>
      <input
        aria-label="설계 이름"
        className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-3 text-sm text-fg"
        value={name}
        maxLength={48}
        onFocus={() => useHabitat.getState().beginEdit()}
        onBlur={(event) => {
          const clean = event.target.value.replace(/\s+/g, " ").trim().slice(0, 48);
          if (clean) useHabitat.getState().patchLive((doc) => ({ ...doc, name: clean }));
          useHabitat.getState().endEdit();
        }}
        onChange={(event) => {
          const next = event.target.value.slice(0, 48);
          if (!next.trim()) return;
          useHabitat.getState().patchLive((doc) => ({ ...doc, name: next }));
        }}
      />
      <Btn title="실행 취소" disabled={!canUndo} onClick={() => useHabitat.getState().undo()}>
        <Undo2 className="size-4" />
      </Btn>
      <Btn title="다시 실행" disabled={!canRedo} onClick={() => useHabitat.getState().redo()}>
        <Redo2 className="size-4" />
      </Btn>
      <Btn title={savedLabel} onClick={() => useHabitat.getState().saveNow()}>
        <Save className="size-4" />
        <span className="hidden md:inline">저장</span>
      </Btn>
      <div className="relative">
        <Btn title="파일" onClick={() => setMenu((v) => !v)}>
          <Download className="size-4" />
        </Btn>
        {menu ? (
          <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-line bg-elev p-2 shadow-none">
            <button type="button" className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-subtle" onClick={downloadJson}>
              <Download className="size-4" /> JSON 내보내기
            </button>
            <button type="button" className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-subtle" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> JSON 가져오기
            </button>
            <button type="button" className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-subtle" onClick={capture}>
              <PanelRight className="size-4" /> 장면 캡처
            </button>
            <button
              type="button"
              className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-subtle"
              onClick={() => {
                useHabitat.getState().duplicateProject();
                setMenu(false);
              }}
            >
              <Copy className="size-4" /> 설계 복제
            </button>
            <button
              type="button"
              className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-subtle"
              onClick={() => {
                useHabitat.getState().setLibrary(true);
                setMenu(false);
              }}
            >
              보관함
            </button>
          </div>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => useHabitat.getState().importText(String(reader.result ?? ""));
          reader.readAsText(file);
          setMenu(false);
        }}
      />
    </header>
  );
}

export function Catalog({ onPick }: { onPick?: () => void }) {
  const tool = useHabitat((s) => s.tool);
  const pending = useHabitat((s) => s.pendingKind);
  const items = useHabitat((s) => s.doc.items);
  const selectedId = useHabitat((s) => (s.selected?.type === "item" ? s.selected.id : null));
  return (
    <div className="flex h-full min-h-0 flex-col bg-elev">
      <div className="flex gap-1 overflow-x-auto border-b border-line p-3">
        {TOOLS.map((entry) => (
          <Btn
            key={entry.id}
            active={tool === entry.id}
            onClick={() => {
              useHabitat.getState().setTool(entry.id);
              onPick?.();
            }}
          >
            {entry.icon}
            {entry.label}
          </Btn>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-sm text-muted">가구를 고른 뒤 바닥을 누르면 배치됩니다. 겹치면 거절합니다.</p>
        {GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-sm font-medium text-muted">{group.label}</h2>
            <div className="grid grid-cols-2 gap-2">
              {group.kinds.map((kind) => {
                const spec = CATALOG[kind];
                const active = tool === "place" && pending === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      useHabitat.setState({ tool: "place", pendingKind: kind, wallStart: null, zoneStart: null });
                      onPick?.();
                    }}
                    className={`rounded-lg border border-line bg-bg p-3 text-left ${active ? "ring-2 ring-accent" : ""}`}
                  >
                    <span className="block text-sm font-medium">{spec.name}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {spec.w.toFixed(2)}×{spec.d.toFixed(2)}m
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">배치된 요소</h2>
          <ul className="space-y-1">
            {items.length === 0 ? <li className="text-sm text-muted">아직 없습니다.</li> : null}
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex h-11 w-full items-center rounded-md px-2 text-left text-sm ${selectedId === item.id ? "bg-subtle" : ""}`}
                  onClick={() => useHabitat.getState().select({ type: "item", id: item.id })}
                >
                  {CATALOG[item.kind].name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Range({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number, live: boolean) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex justify-between text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-fg">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => useHabitat.getState().beginEdit()}
        onPointerUp={() => useHabitat.getState().endEdit()}
        onChange={(event) => onChange(Number(event.target.value), true)}
      />
    </label>
  );
}

export function Inspector() {
  const [tab, setTab] = useState<"item" | "env" | "life" | "stats">("item");
  const doc = useHabitat((s) => s.doc);
  const selected = useHabitat((s) => s.selected);
  const fps = useHabitat((s) => s.fps);
  const confirmReset = useHabitat((s) => s.confirmReset);
  const item = selected?.type === "item" ? doc.items.find((it) => it.id === selected.id) : undefined;
  const wall = selected?.type === "wall" ? doc.walls.find((w) => w.id === selected.id) : undefined;
  const zone = selected?.type === "zone" ? doc.zones.find((z) => z.id === selected.id) : undefined;
  const stats = useMemo(() => estimate(doc), [doc]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-elev">
      <div className="flex gap-1 overflow-x-auto border-b border-line p-3">
        {(
          [
            ["item", "선택"],
            ["env", "환경"],
            ["life", "생활"],
            ["stats", "지표"],
          ] as const
        ).map(([id, label]) => (
          <Btn key={id} active={tab === id} onClick={() => setTab(id)}>
            {label}
          </Btn>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "item" ? (
          <>
            {item ? (
              <section className="space-y-3 rounded-xl border border-line p-4">
                <h2 className="font-display text-xl">{CATALOG[item.kind].name}</h2>
                <p className="text-sm text-muted">{CATALOG[item.kind].blurb}</p>
                <label className="block text-sm text-muted">
                  재질
                  <select
                    className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-fg"
                    value={item.material}
                    onChange={(event) =>
                      useHabitat.getState().updateItem(item.id, { material: event.target.value as Material })
                    }
                  >
                    {MATERIALS.map((material) => (
                      <option key={material} value={material}>
                        {MATERIAL_LABEL[material]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`색 ${color}`}
                      className="size-11 rounded-md border border-line"
                      style={{ background: color }}
                      onClick={() => useHabitat.getState().updateItem(item.id, { color })}
                    />
                  ))}
                </div>
                <Range
                  label="회전"
                  min={-180}
                  max={180}
                  step={15}
                  value={(item.rotY * 180) / Math.PI}
                  onChange={(value, live) =>
                    useHabitat.getState().updateItem(item.id, { rotY: (value * Math.PI) / 180 }, live)
                  }
                />
                <Range
                  label="너비 배율"
                  min={0.5}
                  max={1.8}
                  step={0.05}
                  value={item.sx}
                  onChange={(value, live) => useHabitat.getState().updateItem(item.id, { sx: value }, live)}
                />
                <Range
                  label="깊이 배율"
                  min={0.5}
                  max={1.8}
                  step={0.05}
                  value={item.sz}
                  onChange={(value, live) => useHabitat.getState().updateItem(item.id, { sz: value }, live)}
                />
                <Range
                  label="높이 배율"
                  min={0.5}
                  max={1.8}
                  step={0.05}
                  value={item.sy}
                  onChange={(value, live) => useHabitat.getState().updateItem(item.id, { sy: value }, live)}
                />
                <div className="flex gap-2">
                  <Btn onClick={() => useHabitat.getState().rotateSelected(Math.PI / 12)}>
                    <RotateCw className="size-4" /> 15°
                  </Btn>
                  <Btn onClick={() => useHabitat.getState().duplicateSelected()}>
                    <Copy className="size-4" /> 복제
                  </Btn>
                  <Btn variant="danger" onClick={() => useHabitat.getState().removeSelected()}>
                    <Trash2 className="size-4" />
                  </Btn>
                </div>
              </section>
            ) : null}
            {wall ? (
              <section className="space-y-3 rounded-xl border border-line p-4">
                <h2 className="font-display text-xl">벽</h2>
                <p className="text-sm tabular-nums text-muted">{wallLength(wall).toFixed(2)}m</p>
                <div className="flex gap-2">
                  <Btn onClick={() => useHabitat.getState().addOpening(wall.id, "door")}>문</Btn>
                  <Btn onClick={() => useHabitat.getState().addOpening(wall.id, "window")}>창</Btn>
                  <Btn variant="danger" onClick={() => useHabitat.getState().removeSelected()}>
                    삭제
                  </Btn>
                </div>
                <ul className="space-y-3">
                  {wall.openings.map((opening) => (
                    <li key={opening.id} className="rounded-lg border border-line p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{opening.type === "door" ? "문" : "창"}</span>
                        <button
                          type="button"
                          className="h-11 px-2 text-danger"
                          onClick={() => useHabitat.getState().removeOpening(wall.id, opening.id)}
                        >
                          제거
                        </button>
                      </div>
                      <Range
                        label="위치"
                        min={0.08}
                        max={0.92}
                        step={0.01}
                        value={opening.t}
                        onChange={(value, live) =>
                          useHabitat.getState().updateOpening(wall.id, opening.id, { t: value }, live)
                        }
                      />
                      <Range
                        label="폭 m"
                        min={0.5}
                        max={Math.max(0.6, wallLength(wall) - 0.3)}
                        step={0.05}
                        value={opening.width}
                        onChange={(value, live) =>
                          useHabitat.getState().updateOpening(wall.id, opening.id, { width: value }, live)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {zone ? (
              <section className="space-y-3 rounded-xl border border-line p-4">
                <h2 className="font-display text-xl">구역</h2>
                <select
                  className="h-11 w-full rounded-md border border-line bg-bg px-2"
                  value={zone.kind}
                  onChange={(event) => useHabitat.getState().setZoneKind(zone.id, event.target.value as ZoneKind)}
                >
                  {ZONE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {ZONE_LABEL[kind]}
                    </option>
                  ))}
                </select>
                <Btn variant="danger" onClick={() => useHabitat.getState().removeSelected()}>
                  구역 삭제
                </Btn>
              </section>
            ) : null}
            {!item && !wall && !zone ? (
              <section className="space-y-3">
                <p className="text-sm text-muted">바닥의 가구를 끌거나, 평면에서 구역을 고르세요. Q·E로 15° 회전합니다.</p>
                <ul className="space-y-1">
                  {doc.zones.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className="flex h-11 w-full items-center rounded-md px-2 text-left text-sm hover:bg-subtle"
                        onClick={() => useHabitat.getState().select({ type: "zone", id: entry.id })}
                      >
                        {ZONE_LABEL[entry.kind]}
                      </button>
                    </li>
                  ))}
                  {doc.walls.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className="flex h-11 w-full items-center rounded-md px-2 text-left text-sm text-muted hover:bg-subtle"
                        onClick={() => useHabitat.getState().select({ type: "wall", id: entry.id })}
                      >
                        벽 {wallLength(entry).toFixed(1)}m
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {tab === "env" ? (
          <section className="space-y-3 rounded-xl border border-line p-4">
            <h2 className="font-display text-xl">
              {dayPhase(doc.env.hour)} {formatHour(doc.env.hour)}
            </h2>
            <p className="text-sm text-muted">바깥 {stats.nowOutdoor.toFixed(1)}°C · 태양고도 {stats.nowSunDeg.toFixed(0)}°</p>
            <Range label="시각" min={0} max={24} step={0.25} value={doc.env.hour} onChange={(value, live) => useHabitat.getState().updateEnv({ hour: value }, live)} />
            <Range label="태양 방위" min={0} max={360} step={5} value={doc.env.azimuth} onChange={(value, live) => useHabitat.getState().updateEnv({ azimuth: value }, live)} />
            <Range label="실내 설정 온도" min={16} max={28} step={0.5} value={doc.env.temperature} onChange={(value, live) => useHabitat.getState().updateEnv({ temperature: value }, live)} />
            <Range label="습도" min={25} max={75} step={1} value={doc.env.humidity} onChange={(value, live) => useHabitat.getState().updateEnv({ humidity: value }, live)} />
            <Range label="환기 열회수" min={0} max={1} step={0.05} value={doc.env.ventilation} onChange={(value, live) => useHabitat.getState().updateEnv({ ventilation: value }, live)} />
            <Range label="인공 조명" min={0} max={1} step={0.05} value={doc.env.artificial} onChange={(value, live) => useHabitat.getState().updateEnv({ artificial: value }, live)} />
            <p className="text-xs leading-relaxed text-faint">시각과 방위는 모형 햇빛입니다. 인증 일사량이 아닙니다.</p>
          </section>
        ) : null}

        {tab === "life" ? (
          <section className="space-y-2">
            {LIFESTYLES.map((life) => (
              <button
                key={life}
                type="button"
                onClick={() => useHabitat.getState().applyLife(life)}
                className={`block w-full rounded-xl border border-line p-4 text-left ${doc.lifestyle === life ? "ring-2 ring-accent" : ""}`}
              >
                <span className="block text-sm font-medium">{LIFESTYLE_META[life].title}</span>
                <span className="mt-1 block text-sm text-muted">{LIFESTYLE_META[life].text}</span>
              </button>
            ))}
          </section>
        ) : null}

        {tab === "stats" ? (
          <section className="space-y-3">
            <p className="text-xs leading-relaxed text-faint">가상 추정치입니다. 건물 성능 인증이나 견적이 아닙니다.</p>
            <dl className="grid grid-cols-2 gap-2">
              <Stat label="바닥 면적" value={`${stats.gross.toFixed(1)}㎡`} />
              <Stat label="이동 가능" value={`${stats.movable.toFixed(1)}㎡`} />
              <Stat label="가구 점유" value={`${Math.round(stats.occupancy * 100)}%`} />
              <Stat label="재배 공간" value={`${stats.grow.toFixed(1)}㎡`} />
              <Stat label="창 면적" value={`${stats.glazing.toFixed(1)}㎡`} />
              <Stat label="자연광 지표" value={`${stats.daylightIndex}`} />
              <Stat label="하루 에너지" value={`${stats.netKwh.toFixed(1)} kWh`} />
              <Stat label="설계 비용" value={krw(stats.costKrw)} />
            </dl>
            <div className="rounded-xl border border-line p-4 text-sm">
              <p className="text-muted">구역별 바닥</p>
              <ul className="mt-2 space-y-1">
                {ZONE_KINDS.filter((kind) => stats.byZone[kind] > 0.2).map((kind) => (
                  <li key={kind} className="flex justify-between tabular-nums">
                    <span>{ZONE_LABEL[kind]}</span>
                    <span>{stats.byZone[kind].toFixed(1)}㎡</span>
                  </li>
                ))}
                <li className="flex justify-between tabular-nums text-muted">
                  <span>구획 밖</span>
                  <span>{stats.unzoned.toFixed(1)}㎡</span>
                </li>
              </ul>
              {stats.overlap ? <p className="mt-2 text-danger">구역이 겹칩니다. 면적은 우선순위로 한 번만 셉니다.</p> : null}
            </div>
            <div className="rounded-xl border border-line p-4 text-sm tabular-nums">
              <p>냉난방 {stats.hvacKwh.toFixed(1)} · 조명 {stats.lightKwh.toFixed(1)}</p>
              <p>기기 {stats.plugKwh.toFixed(1)} · 발전 상쇄 {stats.generationKwh.toFixed(1)}</p>
              <p className="mt-2 text-muted">외피 {krw(stats.shellKrw)}</p>
              <p className="text-muted">가구 {krw(stats.furnKrw)}</p>
              <p className="text-muted">창 {krw(stats.glazingKrw)} · 정원 {krw(stats.gardenKrw)}</p>
            </div>
            <p className="text-sm text-muted">이 화면 {fps > 0 ? `${fps} fps` : "측정 중"}</p>
            <details className="text-sm text-faint">
              <summary className="cursor-pointer text-muted">계산 가정</summary>
              <ul className="mt-2 space-y-2">
                {MODEL_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
            {confirmReset ? (
              <div className="flex gap-2">
                <Btn variant="danger" onClick={() => useHabitat.getState().resetConcept()}>
                  기본 배치로
                </Btn>
                <Btn onClick={() => useHabitat.getState().setConfirmReset(false)}>취소</Btn>
              </div>
            ) : (
              <Btn onClick={() => useHabitat.getState().setConfirmReset(true)}>콘셉트 초기화</Btn>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function Welcome() {
  const open = useHabitat((s) => s.welcome);
  if (!open) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-4 sm:items-center">
      <div className="pointer-events-auto max-h-[86%] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-elev p-5">
      <p className="text-xs tracking-wide text-muted">NOVA HABITAT</p>
      <h1 className="mt-2 font-display text-3xl leading-tight">생활이 평면을 바꿉니다.</h1>
      <p className="mt-3 text-sm text-muted">
        다섯 가지 시작점 중 하나를 고르세요. 벽, 문, 가구를 직접 고치고 채광과 에너지를 비교할 수 있습니다. 저장은 이 브라우저에 남습니다.
      </p>
      <div className="mt-5 grid gap-2">
        {CONCEPTS.map((concept) => (
          <button
            key={concept}
            type="button"
            className="rounded-xl border border-line bg-bg p-4 text-left"
            onClick={() => useHabitat.getState().chooseConcept(concept as Concept)}
          >
            <span className="block text-sm font-medium">{CONCEPT_META[concept].title}</span>
            <span className="mt-1 block text-sm text-muted">{CONCEPT_META[concept].text}</span>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

export function Library() {
  const open = useHabitat((s) => s.library);
  const projects = useHabitat((s) => s.projects);
  const active = useHabitat((s) => s.doc.id);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-bg/80 p-4 lg:items-center" role="dialog" aria-modal="true" aria-label="보관함">
      <div className="max-h-[80%] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-elev p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">보관함</h2>
          <Btn onClick={() => useHabitat.getState().setLibrary(false)}>닫기</Btn>
        </div>
        <ul className="space-y-2">
          {projects.length === 0 ? <li className="text-sm text-muted">저장된 설계가 없습니다. 저장을 누르면 여기에 남습니다.</li> : null}
          {projects.map((project) => (
            <li key={project.doc.id} className="flex items-center gap-2 rounded-lg border border-line p-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => useHabitat.getState().loadProject(project.doc.id)}>
                <span className="block truncate text-sm font-medium">{project.doc.name}</span>
                <span className="text-xs text-muted">{project.doc.id === active ? "현재" : CONCEPT_META[project.doc.concept].title}</span>
              </button>
              <Btn variant="danger" onClick={() => useHabitat.getState().deleteProject(project.doc.id)}>
                삭제
              </Btn>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {CONCEPTS.map((concept) => (
            <Btn key={concept} onClick={() => useHabitat.getState().newFromConcept(concept)}>
              {CONCEPT_META[concept].title}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Notice() {
  const notice = useHabitat((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => useHabitat.getState().setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <p role="status" className="pointer-events-none absolute bottom-20 left-1/2 z-20 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-line bg-elev px-4 py-3 text-center text-sm text-fg lg:bottom-6">
      {notice}
    </p>
  );
}

export function ViewportBar() {
  const view = useHabitat((s) => s.view);
  const snap = useHabitat((s) => s.snap);
  const quality = useHabitat((s) => s.quality);
  const tool = useHabitat((s) => s.tool);
  const hint =
    tool === "wall"
      ? "두 점을 찍어 벽을 놓습니다."
      : tool === "zone"
        ? "두 점으로 구역 사각형을 만듭니다."
        : tool === "door" || tool === "window"
          ? "벽에 가깝게 누르면 개구부가 생깁니다."
          : tool === "place"
            ? "바닥에 누르면 배치됩니다."
            : "드래그로 옮기고, 방향키로 밀고, 휠로 확대합니다. 우클릭으로 화면을 밉니다.";
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
      <p className="pointer-events-none max-w-md rounded-md bg-elev/90 px-3 py-2 text-xs text-muted">{hint}</p>
      <div className="pointer-events-auto flex flex-wrap gap-1">
        <Btn active={view === "3d"} onClick={() => useHabitat.getState().setView("3d")}>
          3D
        </Btn>
        <Btn active={view === "plan"} onClick={() => useHabitat.getState().setView("plan")}>
          평면도
        </Btn>
        <Btn active={snap} onClick={() => useHabitat.getState().setSnap(!snap)}>
          {snap ? "0.25m" : "자유"}
        </Btn>
        <Btn active={quality === "low"} onClick={() => useHabitat.getState().setQuality(quality === "high" ? "low" : "high")}>
          {quality === "high" ? "그림자" : "경량"}
        </Btn>
      </div>
    </div>
  );
}

export function MobileNav() {
  const mobile = useHabitat((s) => s.mobile);
  return (
    <>
      <nav className="flex h-14 shrink-0 items-center gap-2 border-t border-line bg-elev px-3 lg:hidden">
        <Btn className="flex-1" active={mobile === "catalog"} onClick={() => useHabitat.getState().setMobile(mobile === "catalog" ? null : "catalog")}>
          물건
        </Btn>
        <Btn className="flex-1" active={mobile === "inspect"} onClick={() => useHabitat.getState().setMobile(mobile === "inspect" ? null : "inspect")}>
          속성
        </Btn>
        <Btn className="flex-1" onClick={() => useHabitat.getState().setLibrary(true)}>
          보관
        </Btn>
      </nav>
      {mobile ? (
        <div className="absolute inset-x-0 bottom-14 z-20 max-h-[58%] overflow-hidden border-t border-line bg-elev lg:hidden">
          {mobile === "catalog" ? <Catalog onPick={() => useHabitat.getState().setMobile(null)} /> : <Inspector />}
        </div>
      ) : null}
    </>
  );
}
