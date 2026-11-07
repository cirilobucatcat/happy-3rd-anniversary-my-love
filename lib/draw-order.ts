/**
 * Draw order for the Sky: back to front, with the one rule that makes the story work.
 *
 * Clouds are sorted by their real depth against each Memory's real depth, so a Memory can pop out from behind a Cloud
 * and a Cloud can drift in front of it. The Flyers are the exception: they are always drawn in front of every
 * Memory, and only a Cloud that is nearer than they are can veil them. If a Cloud would sit between a Memory and
 * the Flyers (nearer than the Memory, further than the Flyers), the Flyers win and are placed after the Memory.
 *
 * The result is a list of layers. Consecutive puffs share a layer (they need no depth buffer, being soft sprites);
 * each Memory and the Flyers get a layer of their own, so each can use the depth buffer inside itself.
 */

export type Item =
  | { kind: "puff"; id: number; z: number }
  | { kind: "memory"; id: number; z: number }
  | { kind: "flyers"; z: number };

export type Layer =
  | { kind: "puffs"; ids: number[] }
  | { kind: "memory"; id: number }
  | { kind: "flyers" };

/** Returns the layers in the order to draw them, furthest first. */
export function drawOrder(items: readonly Item[]): Layer[] {
  // The Flyers' effective depth is at least that of the nearest Memory, so they never fall behind one.
  const memoryFront = items.reduce((front, it) => (it.kind === "memory" ? Math.max(front, it.z) : front), -Infinity);
  const keyed = items.map((it, i) => ({ it, i, key: it.kind === "flyers" ? Math.max(it.z, memoryFront) : it.z }));

  // Furthest first. On a tie, puffs go before Memories and the Flyers go last (they are in front), then input order.
  const rank = (k: Item["kind"]) => (k === "puff" ? 0 : k === "memory" ? 1 : 2);
  keyed.sort((a, b) => a.key - b.key || rank(a.it.kind) - rank(b.it.kind) || a.i - b.i);

  const layers: Layer[] = [];
  for (const { it } of keyed) {
    if (it.kind === "puff") {
      const last = layers[layers.length - 1];
      if (last && last.kind === "puffs") last.ids.push(it.id);
      else layers.push({ kind: "puffs", ids: [it.id] });
    } else if (it.kind === "memory") {
      layers.push({ kind: "memory", id: it.id });
    } else {
      layers.push({ kind: "flyers" });
    }
  }
  return layers;
}
