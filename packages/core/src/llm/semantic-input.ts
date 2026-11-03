import type { LLMClient } from "./provider.js";
import { estimateTextTokens } from "./provider.js";

export function semanticInputBudget(
  client: LLMClient,
  options: { readonly reservedOutputTokens: number; readonly promptOverheadTokens?: number },
): number | undefined {
  const contextWindow = client._piModel?.contextWindow;
  if (!contextWindow || !Number.isFinite(contextWindow)) return undefined;
  const overhead = options.promptOverheadTokens ?? 4096;
  return Math.max(1, contextWindow - options.reservedOutputTokens - overhead);
}

/** Split an over-budget input into a lossless sequence of model-sized chunks. */
export function splitTextByEstimatedTokens(text: string, budgetTokens: number): string[] {
  if (estimateTextTokens(text) <= budgetTokens) return [text];
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current) chunks.push(current);
    current = "";
  };

  for (const line of lines) {
    if (estimateTextTokens(line) > budgetTokens) {
      flush();
      chunks.push(...splitOversizedUnit(line, budgetTokens));
      continue;
    }
    const candidate = current + line;
    if (current && estimateTextTokens(candidate) > budgetTokens) flush();
    current += line;
  }
  flush();
  return chunks;
}

function splitOversizedUnit(text: string, budgetTokens: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start;
    let units = 0;
    // Match estimateTextTokens: a CJK code unit costs one token, other
    // UTF-16 units cost one quarter. Walk once instead of repeatedly copying
    // multi-megabyte character arrays during binary search.
    while (end < text.length) {
      const code = text.charCodeAt(end);
      const paired = code >= 0xD800 && code <= 0xDBFF
        && text.charCodeAt(end + 1) >= 0xDC00 && text.charCodeAt(end + 1) <= 0xDFFF;
      const width = paired ? 2 : 1;
      const cost = code >= 0x3400 && code <= 0x9FFF ? 4 : width;
      if (end > start && units + cost > budgetTokens * 4) break;
      units += cost;
      end += width;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
