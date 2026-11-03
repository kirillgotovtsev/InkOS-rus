import { expect, it } from "vitest";
import { estimateTextTokens } from "../llm/provider.js";
import { splitTextByEstimatedTokens } from "../llm/semantic-input.js";

it("splits a multi-megabyte line losslessly without exceeding the token budget", () => {
  const text = "Русский текст, 中文, emoji 🐈. ".repeat(30_000);
  const chunks = splitTextByEstimatedTokens(text, 10_000);
  expect(chunks.length).toBeGreaterThan(20);
  expect(chunks.join("")).toBe(text);
  for (const chunk of chunks) {
    expect(estimateTextTokens(chunk)).toBeLessThanOrEqual(10_000);
    expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
  }
});

it("preserves newlines and unpaired surrogate code units", () => {
  const text = "first\n\n" + "a\uD800b\uDC00中文🐈".repeat(20) + "\nlast";
  const chunks = splitTextByEstimatedTokens(text, 5);
  expect(chunks.join("")).toBe(text);
  expect(chunks.every(chunk => estimateTextTokens(chunk) <= 5)).toBe(true);
});
