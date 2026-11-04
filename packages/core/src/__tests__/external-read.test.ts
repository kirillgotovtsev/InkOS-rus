import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReadTool } from "../agent/agent-tools.js";

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "inkos-input-page-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const text = (result: { content: unknown }) => (result.content as Array<{ text: string }>)[0]!.text;

describe("external input pages", () => {
  it("accepts a line page on an extracted material path and returns a continuation cursor", async () => {
    await mkdir(join(root, ".inkos/materials"), { recursive: true });
    const path = ".inkos/materials/fixture.md";
    const source = "Первая строка.\nВторая строка.\nТретья строка.\n";
    await writeFile(join(root, path), source);
    const read = createReadTool(root, { scope: "project" });
    const first = await read.execute("page", { path, startLine: 2, lineCount: 1 });
    expect(text(first)).toBe("Вторая строка.\n");
    expect(first.details).toMatchObject({ contentScope: "page_excerpt", totalChars: source.length, nextRead: { path, startChar: source.indexOf("Третья"), charCount: 16000 } });
    const next = (first.details as { nextRead: { path: string; startChar: number; charCount: number } }).nextRead;
    expect(text(await read.execute("next", next))).toBe("Третья строка.\n");
    expect(await readFile(join(root, path), "utf8")).toBe(source);
  });

  it("bounds a half-million-character line and reconstructs it exactly through nextRead", async () => {
    const source = "Я😀".repeat(170000);
    await writeFile(join(root, "flat.md"), source);
    const read = createReadTool(root, { scope: "project" });
    let next: { path: string; lineCount?: number; startChar?: number; charCount?: number } | null = { path: "flat.md", lineCount: 40 };
    const pages: string[] = [];
    while (next) {
      const result = await read.execute("page", next);
      const page = text(result);
      expect(page.length).toBeLessThanOrEqual(16000);
      expect(page).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      pages.push(page);
      next = (result.details as { nextRead: typeof next }).nextRead;
    }
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join("")).toBe(source);
  });

  it("keeps small raw files unchanged and preserves path and reference restrictions", async () => {
    await writeFile(join(root, "small.md"), "Original text.\n");
    const read = createReadTool(root, { scope: "project" });
    const result = await read.execute("full", { path: "small.md" });
    expect(text(result)).toBe("Original text.\n");
    expect(result.details).toMatchObject({ contentScope: "full_file", nextRead: null });
    for (const params of [{ path: "small.md", artifactId: "both" }, { path: "small.md", workId: "other" }, { path: "small.md", startLine: 1, startChar: 0 }]) {
      await expect(read.execute("mixed", params)).rejects.toMatchObject({ code: "READ_TARGET_INVALID" });
    }
    await expect(read.execute("escape", { path: "../outside.md" })).rejects.toThrow();
    await expect(read.execute("past", { path: "small.md", startLine: 3 })).rejects.toMatchObject({ code: "FILE_LINE_OUT_OF_RANGE" });
  });
});
