import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { evictAgentCache } from "@actalk/inkos-core";
import { createStudioServer } from "../api/server.js";

it.each([256, 13_278_065])("resumes a session with %i characters of historical tool data through the context budget", async (size) => {
  const root = await mkdtemp(join(tmpdir(), "inkos-restored-context-"));
  const calls: Array<{ compilation: boolean; system: string; inputChars: number; userText: string }> = [];
  let sessionId: string | undefined;
  const upstream = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    const messages = payload.messages as Array<{ role: string; content: string }>;
    const compilation = !payload.tools?.length;
    const system = messages.find(message => message.role === "system")?.content ?? "";
    const userText = messages.filter(message => message.role === "user").map(message => message.content).join("\n");
    calls.push({ compilation, system, inputChars: userText.length, userText: size < 1_000 || !compilation ? userText : "" });
    if (messages.some(message => message.content.length > 10_485_760)) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "input content string too long" } }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ finish_reason: compilation ? "stop" : "tool_calls", message: compilation
      ? { role: "assistant", content: "Historical reference fixture.txt was read. A follow-up explanation remains pending." }
      : { role: "assistant", tool_calls: [{ id: "new-completion", type: "function", function: {
        name: "finish_turn", arguments: JSON.stringify({ status: "answered", message: "Продолжение работает." }),
      } }] },
    }] }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  try {
    const baseUrl = `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1`;
    await mkdir(join(root, ".inkos"));
    await writeFile(join(root, "inkos.json"), JSON.stringify({ name: "fixture", version: "0.1.0", language: "ru", llm: {
      defaultModel: "fixture-model", services: [{ service: "custom", name: "fixture", baseUrl, apiFormat: "chat", stream: false, models: ["fixture-model"] }],
    } }));
    await writeFile(join(root, ".inkos/secrets.json"), JSON.stringify({ services: { "custom:fixture": { apiKey: "fixture" } } }));
    const app = createStudioServer({} as never, root);
    const post = (value: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    const { session } = await (await app.request("/api/v1/sessions", post({ sessionKind: "book-create" }))).json();
    sessionId = session.sessionId;
    const path = join(root, ".inkos/sessions", `${sessionId}.jsonl`);
    const original = await readFile(path, "utf8");
    let seq = Math.max(...original.trim().split("\n").map(line => JSON.parse(line).seq));
    const event = (value: object) => ({ version: 1, sessionId, requestId: "historical-request", seq: ++seq, timestamp: seq, ...value });
    const history = [
      event({ type: "request_started", sessionKind: "book-create", input: "Read the synthetic reference." }),
      event({ type: "message", uuid: "old-user", parentUuid: null, role: "user", message: { role: "user", content: "Read the synthetic reference.", timestamp: 1 } }),
      event({ type: "message", uuid: "old-assistant", parentUuid: "old-user", role: "assistant", message: {
        role: "assistant", content: [{ type: "toolCall", id: "historical-read", name: "workspace__retrieve_material", arguments: { query: "fixture" } }],
        api: "openai-completions", provider: "openai", model: "old-model", stopReason: "toolUse", timestamp: 2,
      } }),
      event({ type: "message", uuid: "old-result", parentUuid: "old-assistant", role: "toolResult", message: {
        role: "toolResult", toolCallId: "historical-read", toolName: "workspace__retrieve_material", isError: false,
        content: [{ type: "text", text: `fixture.txt\n${"x".repeat(size)}` }], timestamp: 3,
      } }),
      event({ type: "request_committed" }),
    ];
    const seeded = original + history.map(value => JSON.stringify(value)).join("\n") + "\n";
    await writeFile(path, seeded);

    const reply = await app.request("/api/v1/agent", post({ sessionId, instruction: "Объясни прочитанное по-русски.", model: "fixture-model", service: "custom:fixture" }));
    expect(reply.status).toBe(200);
    expect(await reply.json()).toMatchObject({ completionStatus: "answered", response: "Продолжение работает." });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(call => call.system.length < 100_000 && !call.system.includes("[Historical tool results]"))).toBe(true);
    const agentCalls = calls.filter(call => !call.compilation);
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]!.system).toContain("Отвечай пользователю по-русски");
    expect(agentCalls[0]!.userText).toContain("Объясни прочитанное по-русски.");
    expect(agentCalls[0]!.userText).toContain("fixture.txt");
    if (size > 1_000) {
      const compilations = calls.filter(call => call.compilation);
      expect(compilations.length).toBeGreaterThan(1);
      expect(Math.max(...compilations.map(call => call.inputChars))).toBeLessThanOrEqual(128_000 * 4);
      expect(compilations.reduce((total, call) => total + call.inputChars, 0)).toBeGreaterThan(size);
      expect(agentCalls[0]!.userText).toContain("<conversation_summary>");
    } else {
      expect(calls.some(call => call.compilation)).toBe(false);
      expect(agentCalls[0]!.userText).toContain("x".repeat(size));
    }
    expect((await readFile(path, "utf8")).startsWith(seeded)).toBe(true);
  } finally {
    if (sessionId) evictAgentCache(sessionId);
    upstream.closeAllConnections();
    await new Promise<void>((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
