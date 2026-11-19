import assert from "node:assert/strict";
import { test } from "node:test";
import { histCommit, histRedo, histUndo } from "./history.ts";
import { analyzeAreas, canPlace, itemAabb, overlaps, placementIssues } from "./geometry.ts";
import { applyLifestyle } from "./recommend.ts";
import { parseDoc } from "./storage.ts";
import { estimate, outdoorTemp } from "./simulate.ts";
import { buildConcept } from "./templates.ts";
import type { Doc } from "./types.ts";
import { CONCEPTS } from "./types.ts";

test("furniture overlap and clearance", () => {
  const doc = buildConcept("custom");
  const a = {
    id: "a",
    kind: "bed" as const,
    x: 0,
    z: 0,
    rotY: 0,
    sx: 1,
    sy: 1,
    sz: 1,
    color: "#c9beb0",
    material: "linen" as const,
  };
  const b = { ...a, id: "b", x: 0.2 };
  assert.equal(overlaps(itemAabb(a), itemAabb(b)), true);
  const placed: Doc = { ...doc, items: [a] };
  assert.equal(canPlace(placed, b), false);
  assert.equal(canPlace(placed, { ...b, x: 3.2 }), true);
});

test("templates sit inside the shell without collisions", () => {
  for (const concept of CONCEPTS) {
    const doc = buildConcept(concept);
    assert.ok(doc.width * doc.depth > 20, concept);
    for (const item of doc.items) {
      const issues = placementIssues(doc, item);
      assert.deepEqual(issues, [], `${concept} ${item.id} ${item.kind} @ ${item.x},${item.z}`);
    }
    const areas = analyzeAreas(doc);
    assert.ok(areas.gross === doc.width * doc.depth);
    assert.ok(areas.movable > 0, concept);
    assert.ok(areas.movable < areas.gross, concept);
    assert.equal(areas.overlap, false, concept);
    const est = estimate(doc);
    assert.ok(est.costKrw > 1_000_000, concept);
    assert.ok(est.netKwh > 0, concept);
    assert.ok(est.daylightIndex >= 0 && est.daylightIndex <= 100);
  }
});

test("daylight and outdoor temperature follow the hour", () => {
  const noon = buildConcept("nature");
  const night = structuredClone(noon);
  night.env.hour = 1;
  noon.env.hour = 12.5;
  const a = estimate(noon);
  const b = estimate(night);
  assert.ok(a.daylightIndex > b.daylightIndex);
  assert.ok(outdoorTemp(15) !== outdoorTemp(3));
  const bright = structuredClone(noon);
  bright.env.artificial = 1;
  const dim = structuredClone(noon);
  dim.env.artificial = 0;
  assert.ok(estimate(bright).lightKwh > estimate(dim).lightKwh);
});

test("undo and redo restore documents", () => {
  const h0 = { past: [] as string[], present: "a", future: [] as string[] };
  const h1 = histCommit(h0, "b", (a, b) => a === b);
  const h2 = histCommit(h1, "c", (a, b) => a === b);
  assert.equal(histUndo(h2).present, "b");
  assert.equal(histRedo(histUndo(h2)).present, "c");
  assert.equal(histCommit(h2, "c", (a, b) => a === b).past.length, h2.past.length);
});

test("lifestyle edit only adds and stays collision-free", () => {
  const doc = buildConcept("nature");
  const result = applyLifestyle(doc, "reading");
  assert.ok(result.doc.items.length >= doc.items.length);
  assert.equal(result.doc.lifestyle, "reading");
  for (const item of result.doc.items) {
    assert.deepEqual(placementIssues(result.doc, item), [], item.id);
  }
});

test("rejects malformed design files", () => {
  assert.equal(parseDoc("nope").ok, false);
  assert.equal(parseDoc({ version: 1 }).ok, false);
  const doc = buildConcept("custom");
  const bad = structuredClone(doc);
  bad.items = [
    {
      id: "x",
      kind: "bed",
      x: Number.NaN,
      z: 0,
      rotY: 0,
      sx: 1,
      sy: 1,
      sz: 1,
      color: "#ffffff",
      material: "linen",
    },
  ];
  assert.equal(parseDoc(bad).ok, false);
  const wrapped = parseDoc({ format: "nova-habitat", doc });
  assert.equal(wrapped.ok, true);
  if (wrapped.ok) assert.equal(wrapped.doc.name, doc.name);
  const dup = structuredClone(doc);
  dup.items = [
    {
      id: "same",
      kind: "plant",
      x: 0,
      z: 0,
      rotY: 0,
      sx: 1,
      sy: 1,
      sz: 1,
      color: "#6f8f72",
      material: "living",
    },
    {
      id: "same",
      kind: "plant",
      x: 2,
      z: 2,
      rotY: 0,
      sx: 1,
      sy: 1,
      sz: 1,
      color: "#6f8f72",
      material: "living",
    },
  ];
  const rejected = parseDoc(dup);
  assert.equal(rejected.ok, false);
});

test("area model is fast enough for the inspector", () => {
  const t0 = Date.now();
  for (const concept of CONCEPTS) estimate(buildConcept(concept));
  assert.ok(Date.now() - t0 < 1500);
});
