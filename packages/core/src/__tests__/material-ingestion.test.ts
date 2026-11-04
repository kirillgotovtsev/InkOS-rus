import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ingestMaterial } from "../materials/ingest.js";
import { loadChaptersFromPath } from "../agent/chapter-import-source.js";

/** Minimal real PDF with separate pages and text lines; no manuscript fixture. */
function chapterPdf(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    "",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const [index, number] of [[3, 1], [5, 2]] as const) {
    const stream = `BT /F1 12 Tf 50 750 Td (Chapter ${number}: Fixture ${number}) Tj 0 -24 Td (Original source paragraph ${number}.) Tj ET`;
    objects[index] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  }
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(Buffer.byteLength(document)); document += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(document);
  document += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  document += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(document);
}

describe("material ingestion", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-material-ingest-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("archives a project text file as traceable markdown material", async () => {
    await writeFile(join(root, "brief.md"), "# Brief\n\n第一人称，县城冷库旧账。", "utf-8");

    const asset = await ingestMaterial(root, {
      sourceKind: "file",
      filePath: "brief.md",
      mimeType: "text/markdown",
      purpose: "worldbuilding",
    }, {
      now: () => new Date("2026-07-03T00:00:00.000Z"),
    });

    expect(asset.kind).toBe("text");
    expect(asset.markdownPath).toMatch(/^\.inkos\/materials\//);
    expect(asset.source).toBe("brief.md");
    const markdown = await readFile(join(root, asset.markdownPath), "utf-8");
    expect(markdown).toContain("## Metadata");
    expect(markdown).toContain("- purpose: worldbuilding");
    expect(markdown).toContain("第一人称，县城冷库旧账。");
    const manifest = JSON.parse(await readFile(join(root, asset.manifestPath), "utf-8")) as { markdownPath?: string };
    expect(manifest.markdownPath).toBe(asset.markdownPath);
  });

  it("extracts and archives HTML fetched from a URL", async () => {
    const fetchImpl = async () => new Response(
      "<html><head><title>旧账资料</title><style>x{}</style></head><body><h1>冷库流程</h1><script>bad()</script><p>入库单需要签字。</p></body></html>",
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );

    const asset = await ingestMaterial(root, {
      sourceKind: "url",
      url: "https://example.com/cold-storage",
      purpose: "research",
    }, {
      fetch: fetchImpl as typeof fetch,
      now: () => new Date("2026-07-03T00:00:00.000Z"),
    });

    expect(asset.kind).toBe("webpage");
    expect(asset.title).toBe("旧账资料");
    expect(asset.source).toBe("https://example.com/cold-storage");
    const markdown = await readFile(join(root, asset.markdownPath), "utf-8");
    expect(markdown).toContain("入库单需要签字");
    expect(markdown).not.toContain("bad()");
  });

  it("preserves PDF line and page boundaries so chapter import sees separate chapters", async () => {
    const original = chapterPdf();
    await writeFile(join(root, "chapters.pdf"), original);
    const asset = await ingestMaterial(root, { sourceKind: "file", filePath: "chapters.pdf", purpose: "import" });
    expect(asset.totalPages).toBe(2);
    const chapters = await loadChaptersFromPath(join(root, asset.markdownPath));
    expect(chapters).toEqual([
      { title: "Fixture 1", content: "Original source paragraph 1." },
      { title: "Fixture 2", content: "Original source paragraph 2." },
    ]);
    expect(await readFile(join(root, "chapters.pdf"))).toEqual(original);
  });
});
