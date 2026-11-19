import { lazy, Suspense, useEffect, useState } from "react";
import { Catalog, Inspector, Library, MobileNav, Notice, TopBar, ViewportBar, Welcome } from "@/components/habitat/chrome";
import { FloorPlan } from "@/components/habitat/plan";
import { scheduleAutosave, useHabitat } from "@/habitat/store";

const HabitatScene = lazy(() => import("@/components/habitat/scene").then((mod) => ({ default: mod.HabitatScene })));

export default function Studio() {
  const view = useHabitat((s) => s.view);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    setSceneReady(true);
    useHabitat.getState().hydrate();
    const stop = scheduleAutosave();
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        useHabitat.getState().saveNow();
        return;
      }
      if (typing) return;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) useHabitat.getState().redo();
        else useHabitat.getState().undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        useHabitat.getState().redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        useHabitat.getState().duplicateSelected();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        useHabitat.getState().removeSelected();
        return;
      }
      if (event.key === "q" || event.key === "Q" || event.key === "[") {
        useHabitat.getState().rotateSelected(-Math.PI / 12);
      }
      if (event.key === "e" || event.key === "E" || event.key === "]") {
        useHabitat.getState().rotateSelected(Math.PI / 12);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        const state = useHabitat.getState();
        if (state.selected?.type !== "item") return;
        const item = state.doc.items.find((it) => it.id === state.selected?.id);
        if (!item) return;
        event.preventDefault();
        const step = state.snap ? 0.25 : 0.1;
        const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
        const dz = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
        state.updateItem(item.id, { x: item.x + dx, z: item.z + dz });
        return;
      }
      if (event.key === "Escape") {
        useHabitat.setState({
          wallStart: null,
          zoneStart: null,
          cursor: null,
          tool: "select",
          pendingKind: null,
          selected: null,
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <TopBar />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[272px_minmax(0,1fr)_320px]">
        <aside className="hidden min-h-0 border-r border-line lg:block">
          <Catalog />
        </aside>
        <section className="relative min-h-0">
          <div className="absolute inset-0">
            {sceneReady ? (
              <Suspense fallback={<ViewportWait />}>
                <HabitatScene />
              </Suspense>
            ) : (
              <ViewportWait />
            )}
          </div>
          {view === "plan" ? <FloorPlan /> : null}
          <ViewportBar />
          <Welcome />
          <Notice />
        </section>
        <aside className="hidden min-h-0 border-l border-line lg:block">
          <Inspector />
        </aside>
      </div>
      <MobileNav />
      <Library />
    </div>
  );
}

function ViewportWait() {
  return (
    <div className="flex h-full items-end p-4">
      <p className="text-sm text-muted">3D 모형을 그리는 중입니다.</p>
    </div>
  );
}
