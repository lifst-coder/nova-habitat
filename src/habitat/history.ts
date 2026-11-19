export interface Hist<T> {
  past: T[];
  present: T;
  future: T[];
}

export function histCommit<T>(h: Hist<T>, next: T, same: (a: T, b: T) => boolean, limit = 40): Hist<T> {
  if (same(h.present, next)) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}

export function histUndo<T>(h: Hist<T>): Hist<T> {
  if (!h.past.length) return h;
  const present = h.past[h.past.length - 1]!;
  return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future] };
}

export function histRedo<T>(h: Hist<T>): Hist<T> {
  if (!h.future.length) return h;
  const present = h.future[0]!;
  return { past: [...h.past, h.present], present, future: h.future.slice(1) };
}
