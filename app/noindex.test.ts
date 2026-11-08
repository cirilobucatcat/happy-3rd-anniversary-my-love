import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/layout";

/** The rules in a Netlify `_headers` file: each starts at an unindented path, followed by indented `Name: value` lines. */
function parseHeaders(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) current?.push(line.trim());
    else rules.set(line.trim(), (current = []));
  }
  return rules;
}

describe("keeping the site out of search engines", () => {
  it("the page asks not to be indexed or followed", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("every file the site serves, photos included, also carries the same instruction as a header", () => {
    const text = readFileSync(path.join(import.meta.dirname, "..", "public", "_headers"), "utf8");
    const everything = parseHeaders(text).get("/*") ?? [];
    const robots = everything.find((h) => h.toLowerCase().startsWith("x-robots-tag:"));
    expect(robots).toBeDefined();
    expect(robots!.toLowerCase()).toContain("noindex");
    expect(robots!.toLowerCase()).toContain("nofollow");
  });
});
