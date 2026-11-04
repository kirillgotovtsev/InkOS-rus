import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileImportSource, renderCompleteImportSource } from "../agents/import-context.js";
import { runWorkerAgent } from "../agent/worker-agent.js";
import { createBuiltInWorkProfileRegistry } from "../harness/builtin-profiles.js";
import { createWorkManifest } from "../harness/work-store.js";
import { withExecutionEvidence } from "../harness/execution-evidence.js";
import { ProtectedContextOverflowError } from "../harness/context-compiler.js";
import type { LLMClient } from "../llm/provider.js";

vi.mock("../agent/worker-agent.js", () => ({ runWorkerAgent: vi.fn() }));
const worker = vi.mocked(runWorkerAgent);
const roots: string[] = [];
const client = {
  defaults: { maxTokens: 24_576, temperature: 0.2, thinkingBudget: 0, extra: {} },
  _piModel: { contextWindow: 128_000 },
} as LLMClient;

beforeEach(() => worker.mockReset().mockResolvedValue({
  content: "Source events retained with their chapter references.",
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
}));
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

async function fixture() {
  const projectRoot = await mkdtemp(join(tmpdir(), "inkos-import-budget-"));
  roots.push(projectRoot);
  const profile = createBuiltInWorkProfileRegistry().require("longform-novel");
  const work = createWorkManifest({ id: "fixture", title: "Fixture", profileId: profile.id, language: "ru" });
  const chapters = [{ title: "Начало", content: "Вымышленный текст для проверки. ".repeat(18000) }];
  return { projectRoot, profile, work, input: { client, model: "fixture", projectRoot, chapters, language: "ru" as const } };
}

describe("import source budgets", () => {
  it("fits the real worker envelope and preserves every source character in a flattened Russian manuscript", async () => {
    const { input, profile, work } = await fixture();
    const traces: Array<{ protectedTokens: number; budgetTokens: number }> = [];
    const result = await withExecutionEvidence((type, payload) => {
      if (type === "context-compiled") traces.push(payload.trace as typeof traces[number]);
    }, () => compileImportSource(input), profile, work, "Не изменять исходную рукопись.");
    expect(result.compiled).toBe(true);
    expect(result.chunkCount).toBe(worker.mock.calls.length);
    expect(result.chunkCount).toBeGreaterThan(1);
    const source = worker.mock.calls.map(call => call[2].find(message => message.role === "user" && message.content.startsWith("Source chunk "))!.content.replace(/^Source chunk \d+\n\n/, "")).join("");
    expect(source).toBe(renderCompleteImportSource(input.chapters, "ru"));
    expect(traces.length).toBe(result.chunkCount);
    expect(traces.every(trace => trace.protectedTokens <= trace.budgetTokens && trace.budgetTokens === 101376)).toBe(true);
    for (const call of worker.mock.calls) {
      expect(call[3]?.maxTokens).toBe(24576);
      expect(call[2].some(message => message.content.includes("Не изменять исходную рукопись."))).toBe(true);
    }
  });

  it("rejects an oversized author instruction before starting any model call", async () => {
    const { input, profile, work } = await fixture();
    await expect(withExecutionEvidence(() => {}, () => compileImportSource(input), profile, work, "Не менять. ".repeat(50000)))
      .rejects.toBeInstanceOf(ProtectedContextOverflowError);
    expect(worker).not.toHaveBeenCalled();
  });

  it("stops remaining chunks after cancellation", async () => {
    const { input } = await fixture();
    const controller = new AbortController();
    worker.mockImplementationOnce(async () => {
      controller.abort(new Error("Stopped"));
      return { content: "First chunk.", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
    });
    await expect(compileImportSource({ ...input, signal: controller.signal })).rejects.toThrow("Stopped");
    expect(worker).toHaveBeenCalledTimes(1);
  });

  it("returns a small complete source without calling a model", async () => {
    const { input } = await fixture();
    const chapters = [{ title: "Одна глава", content: "Короткий исходный текст." }];
    expect(await compileImportSource({ ...input, chapters })).toEqual({ markdown: renderCompleteImportSource(chapters, "ru"), compiled: false, chunkCount: 0 });
    expect(worker).not.toHaveBeenCalled();
  });
});
