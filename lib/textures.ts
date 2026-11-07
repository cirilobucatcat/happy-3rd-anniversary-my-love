/**
 * A small pool for the Memories' photo textures, to protect an iPhone's memory: a photo is loaded only when its
 * Memory is about to be needed, and released (its GPU memory freed) once it is far away again. At most `max` photos
 * are held at once, and nothing is kept after `dispose()`.
 */

export type Disposable = { dispose(): void };

export type TexturePool<T extends Disposable> = {
  /** The photo for `key`, if it has loaded and is still held. */
  get(key: number): T | null;
  /**
   * Says which Memories are wanted now (nearest first). Loads the ones not held yet, and releases every held photo
   * that is not wanted. A request for a photo that is released before it arrives is thrown away when it lands.
   */
  want(keys: readonly number[]): void;
  /** How many photos are held or loading, for tests and the debug overlay. */
  readonly size: number;
  dispose(): void;
};

export function createTexturePool<T extends Disposable>(options: {
  load: (key: number) => Promise<T>;
  max?: number;
}): TexturePool<T> {
  const { load, max = 4 } = options;
  const held = new Map<number, T>();
  const loading = new Map<number, object>(); // key -> token of the load in flight
  let disposed = false;

  const release = (key: number) => {
    held.get(key)?.dispose();
    held.delete(key);
    loading.delete(key); // an in-flight load notices it was dropped when it lands
  };

  return {
    get: (key) => held.get(key) ?? null,

    want(keys) {
      if (disposed) return;
      const wanted = new Set(keys.slice(0, max));
      for (const key of [...held.keys(), ...loading.keys()]) if (!wanted.has(key)) release(key);
      for (const key of wanted) {
        if (held.has(key) || loading.has(key)) continue;
        const token = {};
        loading.set(key, token);
        load(key)
          .then((texture) => {
            if (disposed || loading.get(key) !== token) {
              texture.dispose(); // released (or the pool closed) while it was loading
              return;
            }
            loading.delete(key);
            held.set(key, texture);
          })
          .catch(() => {
            if (loading.get(key) === token) loading.delete(key); // a photo that fails to load simply stays a placeholder
          });
      }
    },

    get size() {
      return held.size + loading.size;
    },

    dispose() {
      disposed = true;
      for (const key of [...held.keys()]) release(key);
      loading.clear();
    },
  };
}
