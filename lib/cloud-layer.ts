import { CanvasTexture, Color, Sprite, SpriteMaterial, type Scene, type Texture } from "three";
import { cloudState, puffDepth, type Cloud } from "@/lib/clouds";

/** One puff that is showing this frame, with the depth the draw order needs. */
export type VisiblePuff = { id: number; z: number };

export type CloudLayer = {
  /** All the puff sprites, indexed by the ids in `update`'s result. */
  readonly sprites: readonly Sprite[];
  /** Positions, sizes and colours every Cloud for this scroll progress; returns the puffs that are showing. */
  update(progress: number, tint: readonly [number, number, number]): VisiblePuff[];
  dispose(): void;
};

/** A soft white disc that fades to nothing at its edge. Falls back to nothing if canvas is unavailable. */
function createPuffTexture(): Texture | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.9)");
  g.addColorStop(0.7, "rgba(255,255,255,0.6)");
  g.addColorStop(0.88, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

/** Builds a sprite per puff for every Cloud and adds them (hidden) to the scene. */
export function createCloudLayer(scene: Scene, clouds: readonly Cloud[]): CloudLayer {
  const texture = createPuffTexture();
  const sprites: Sprite[] = [];
  const owner: { cloud: Cloud; puff: Cloud["puffs"][number] }[] = [];
  const colour = new Color();

  for (const cloud of clouds) {
    for (const puff of cloud.puffs) {
      const material = new SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      });
      const sprite = new Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      sprites.push(sprite);
      owner.push({ cloud, puff });
    }
  }

  const stateByCloud = new Map<Cloud, ReturnType<typeof cloudState>>();

  return {
    sprites,

    update(progress, tint) {
      colour.setRGB(tint[0], tint[1], tint[2]);
      stateByCloud.clear();
      const showing: VisiblePuff[] = [];
      sprites.forEach((sprite, id) => {
        const { cloud, puff } = owner[id];
        let state = stateByCloud.get(cloud);
        if (!state) {
          state = cloudState(cloud, progress);
          stateByCloud.set(cloud, state);
        }
        const alpha = state.alpha * puff.alpha;
        if (alpha < 0.004) {
          sprite.visible = false;
          return;
        }
        const size = puff.size * state.scale;
        sprite.position.set(state.x + puff.x * state.scale, cloud.y + puff.y * state.scale, puffDepth(cloud, puff));
        sprite.scale.set(size, size, 1);
        const material = sprite.material as SpriteMaterial;
        material.color.copy(colour);
        material.opacity = alpha;
        // Visibility is switched on layer by layer when drawing; here we only say which puffs exist this frame.
        showing.push({ id, z: sprite.position.z });
      });
      return showing;
    },

    dispose() {
      for (const sprite of sprites) {
        scene.remove(sprite);
        (sprite.material as SpriteMaterial).dispose();
      }
      texture?.dispose();
      sprites.length = 0;
    },
  };
}
