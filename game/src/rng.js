// Deterministic randomness: one seeded generator per game, so a screenshot seed
// reproduces the same bot placements and the same round every time.
export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

// Weighted pick: entries are [value, weight]. Used for bot role and buy choices.
export function pickWeighted(random, entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = random() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Fisher-Yates shuffle of a copy; the economy and the round setup use it to deal
// roles and sites without bias.
export function shuffled(random, array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
