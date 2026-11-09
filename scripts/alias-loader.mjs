// A Node module-resolution hook so scripts can load the project's TypeScript files, which import each other
// through the "@/..." alias (`paths` in tsconfig.json: "@/" is the repo root). It only knows ".ts" files, which is
// all the content and lib modules the scripts load are. Register it before importing them:
//   register("./alias-loader.mjs", import.meta.url);  then  await import("../content/memories.ts");
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
}
