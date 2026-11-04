import { createServer } from "node:http";
import { once } from "node:events";
import { expect, it } from "vitest";
import { Type } from "@sinclair/typebox";
import { chatCompletion, createLLMClient, sanitizeOpenAIModelParameters } from "../llm/provider.js";
import { runWorkerAgentTool } from "../agent/worker-agent.js";

it.each(["gpt-6-astra", "gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-sol", "gpt-6-luna", "gpt-6.1-sol-2026-10-01"])("omits unsupported GPT-6 sampling fields for %s without changing input", id => {
  const input = { temperature: 0.2, top_p: 0.5, logprobs: true, top_logprobs: 2, reasoning: { effort: "low" }, include: ["message.output_text.logprobs", "reasoning.encrypted_content"], input: "fixture", max_output_tokens: 128 };
  expect(sanitizeOpenAIModelParameters(input, { id, api: "openai-responses" })).toEqual({ reasoning: { effort: "low" }, include: ["reasoning.encrypted_content"], input: "fixture", max_output_tokens: 128 });
  expect(input.temperature).toBe(0.2);
});

it("preserves sampling for explicit none and unaffected models/providers", () => {
  const input = { temperature: 0.2, reasoning: { effort: "none" } };
  expect(sanitizeOpenAIModelParameters(input, { id: "gpt-6.1-terra", api: "openai-responses" })).toBe(input);
  expect(sanitizeOpenAIModelParameters({ temperature: 0.2 }, { id: "gpt-4.1", api: "openai-responses" })).toEqual({ temperature: 0.2 });
  expect(sanitizeOpenAIModelParameters({ temperature: 0.2 }, { id: "deepseek-v4-pro", api: "openai-completions" })).toEqual({ temperature: 0.2 });
});

it("runs a structured worker through native Responses without the rejected temperature parameter", async () => {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body); requests.push(payload);
    if ("temperature" in payload) { response.writeHead(400); response.end(JSON.stringify({ error: { message: "Unsupported parameter: temperature" } })); return; }
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const send = (value: { type: string; [key: string]: unknown }) => response.write(`event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`);
    const item = { type: "function_call", id: "fc_value", call_id: "call_value", name: "submit_value", arguments: JSON.stringify({ value: 7 }) };
    send({ type: "response.created", response: { id: "response_value" } });
    send({ type: "response.output_item.added", output_index: 0, item: { ...item, arguments: "" } });
    send({ type: "response.function_call_arguments.delta", item_id: item.id, output_index: 0, delta: item.arguments });
    send({ type: "response.output_item.done", output_index: 0, item });
    send({ type: "response.completed", response: { id: "response_value", status: "completed", usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const client = createLLMClient({ service: "custom", configSource: "studio", provider: "openai", model: "gpt-6.1-sol", apiKey: "fixture", baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, apiFormat: "responses", stream: true, temperature: 0.2, thinkingBudget: 0 });
    expect(await runWorkerAgentTool(client, "gpt-6.1-sol", [{ role: "user", content: "Submit the synthetic value." }], { name: "submit_value", label: "Value", description: "Submit value", parameters: Type.Object({ value: Type.Number() }) }, { maxTokens: 128 })).toEqual({ value: 7 });
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toHaveProperty("temperature");
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}, 15_000);

it.each(["chat", "responses"] as const)("omits temperature on the %s non-streaming transport", async apiFormat => {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body); requests.push(payload);
    response.writeHead("temperature" in payload ? 400 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify("temperature" in payload ? { error: { message: "Unsupported parameter: temperature" } }
      : apiFormat === "responses" ? { output: [{ type: "message", content: [{ type: "output_text", text: "fixture" }] }] }
      : { choices: [{ finish_reason: "stop", message: { role: "assistant", content: "fixture" } }] }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const client = createLLMClient({ service: "custom", configSource: "studio", provider: "openai", model: "gpt-6.1-sol", apiKey: "fixture", baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, apiFormat, stream: false, temperature: 0.2, thinkingBudget: 0 });
    expect((await chatCompletion(client, "gpt-6.1-sol", [{ role: "user", content: "synthetic check" }], { retry: false, maxTokens: 128 })).content).toBe("fixture");
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toHaveProperty("temperature");
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}, 15_000);
