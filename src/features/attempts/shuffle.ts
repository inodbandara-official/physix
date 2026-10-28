/**
 * Deterministic shuffling.
 *
 * Option order is derived from a seed (the attempt question's id) rather
 * than stored, so a reload, a language switch, the results page and the
 * teacher's review all show the options in the same order — "you chose C"
 * has to mean the same C everywhere — without a column to keep in sync.
 */

/** 32-bit FNV-1a: a small, well-distributed string hash. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — a fast PRNG with a full 32-bit period, plenty for ordering four options. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates driven by the seed. Never mutates its input. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const random = mulberry32(hashSeed(seed));
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}
