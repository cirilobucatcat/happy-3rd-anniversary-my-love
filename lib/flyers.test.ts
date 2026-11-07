import { Box3, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { MODEL_LIMITS, buildPlaceholderCouple, countTriangles, loadCouple } from "@/lib/flyers";

/** A minimal binary glTF holding `triangles` loose triangles. Built by hand so the test needs no asset file. */
function makeGlb(triangles: number): ArrayBuffer {
  const vertices = triangles * 3;
  const bin = new Float32Array(vertices * 3);
  for (let i = 0; i < vertices; i++) bin[i * 3] = i % 3; // a flat sliver; the shape does not matter
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: vertices, type: "VEC3", min: [0, 0, 0], max: [2, 0, 0] }],
    bufferViews: [{ buffer: 0, byteLength: bin.byteLength }],
    buffers: [{ byteLength: bin.byteLength }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(Math.ceil(jsonBytes.length / 4) * 4).fill(0x20);
  jsonPadded.set(jsonBytes);
  const total = 12 + 8 + jsonPadded.length + 8 + bin.byteLength;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  new Uint8Array(out, 20, jsonPadded.length).set(jsonPadded);
  const binAt = 20 + jsonPadded.length;
  view.setUint32(binAt, bin.byteLength, true);
  view.setUint32(binAt + 4, 0x004e4942, true); // "BIN\0"
  new Uint8Array(out, binAt + 8, bin.byteLength).set(new Uint8Array(bin.buffer));
  return out;
}

const respond = (body: ArrayBuffer, ok = true) => async () => ({ ok, arrayBuffer: async () => body });

describe("buildPlaceholderCouple", () => {
  const couple = buildPlaceholderCouple();

  it("is two people, her and him", () => {
    expect(couple.getObjectByName("her")).toBeDefined();
    expect(couple.getObjectByName("him")).toBeDefined();
  });

  it("stays well inside the triangle budget", () => {
    expect(countTriangles(couple)).toBeGreaterThan(100);
    expect(countTriangles(couple)).toBeLessThan(MODEL_LIMITS.triangles / 5);
  });

  it("is about one unit tall and centred, so the scene can scale it to any viewport", () => {
    const box = new Box3().setFromObject(couple);
    const size = box.getSize(box.min.clone());
    const centre = box.getCenter(box.min.clone());
    expect(size.y).toBeGreaterThan(0.85);
    expect(size.y).toBeLessThan(1.35); // the lean and her trailing hair add a little
    expect(Math.abs(centre.x)).toBeLessThan(0.15);
    expect(Math.abs(centre.y)).toBeLessThan(0.15);
  });

  it("trails her hair and dress behind her, further back than his short hair", () => {
    const her = new Box3().setFromObject(couple.getObjectByName("her") as Object3D);
    const him = new Box3().setFromObject(couple.getObjectByName("him") as Object3D);
    expect(her.min.x).toBeLessThan(him.min.x);
  });

  it("is black and matte", () => {
    let meshes = 0;
    couple.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      meshes++;
      const m = o.material as MeshStandardMaterial;
      expect(m.color.r + m.color.g + m.color.b).toBeLessThan(0.1);
      expect(m.roughness).toBeGreaterThan(0.8);
      expect(m.metalness).toBe(0);
    });
    expect(meshes).toBeGreaterThan(5);
  });
});

describe("loadCouple (optional couple.glb)", () => {
  it("uses the placeholder when there is no file (404)", async () => {
    const result = await loadCouple({ fetchFn: respond(new ArrayBuffer(0), false) });
    expect(result.source).toBe("placeholder");
  });

  it("uses the placeholder when the request fails", async () => {
    const result = await loadCouple({
      fetchFn: async () => {
        throw new Error("offline");
      },
    });
    expect(result.source).toBe("placeholder");
  });

  it("uses the placeholder when the file is not a glb (a 200 HTML fallback page, say)", async () => {
    const html = new TextEncoder().encode("<!doctype html><title>Not found</title>").buffer;
    const result = await loadCouple({ fetchFn: respond(html as ArrayBuffer) });
    expect(result.source).toBe("placeholder");
  });

  it("uses the placeholder when the glb header is fine but the contents are corrupt", async () => {
    const good = new Uint8Array(makeGlb(1));
    const corrupt = good.slice(0, 40); // cut off mid-JSON
    const result = await loadCouple({ fetchFn: respond(corrupt.buffer as ArrayBuffer) });
    expect(result.source).toBe("placeholder");
  });

  it("uses the placeholder when the file is over the 2 MB budget", async () => {
    const big = new ArrayBuffer(MODEL_LIMITS.bytes + 1);
    new DataView(big).setUint32(0, 0x46546c67, true);
    const result = await loadCouple({ fetchFn: respond(big) });
    expect(result.source).toBe("placeholder");
  });

  it("uses the placeholder when the model is over the 30,000 triangle budget", async () => {
    const result = await loadCouple({ fetchFn: respond(makeGlb(MODEL_LIMITS.triangles + 1)) });
    expect(result.source).toBe("placeholder");
  });

  it("uses a valid glb instead of the placeholder, normalised to about one unit tall and centred", async () => {
    const result = await loadCouple({ fetchFn: respond(makeGlb(12)) });
    expect(result.source).toBe("glb");
    expect(countTriangles(result.model)).toBe(12);
    expect(result.model.getObjectByName("her")).toBeUndefined();
    const box = new Box3().setFromObject(result.model);
    const centre = box.getCenter(box.min.clone());
    expect(Math.abs(centre.x)).toBeLessThan(1e-6);
  });

  it("gives a loaded glb the same black matte look", async () => {
    const result = await loadCouple({ fetchFn: respond(makeGlb(12)) });
    result.model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const m = o.material as MeshStandardMaterial;
      expect(m.color.r + m.color.g + m.color.b).toBeLessThan(0.1);
    });
  });
});
