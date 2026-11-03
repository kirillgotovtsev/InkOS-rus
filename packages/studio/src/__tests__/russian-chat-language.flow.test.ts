import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { evictAgentCache, StateManager } from "@actalk/inkos-core";
import { createStudioServer } from "../api/server.js";

it("sends Russian chat policy to the provider, restores Russian attachments, and keeps an English book's language", async () => {
  const root = await mkdtemp(join(tmpdir(), "inkos-ru-chat-"));
  const requests: Array<{ messages: Array<{ role: string; content?: string }> }> = [];
  const sessionIds: string[] = [];
  const upstream = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    requests.push(payload);
    const tool = requests.length === 1
      ? { name: "workspace__use_skill", arguments: JSON.stringify({ skillId: "inkos-long-story-analysis" }) }
      : { name: "finish_turn", arguments: JSON.stringify({ status: "answered", message: "Проверка завершена." }) };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{
      id: `call-${requests.length}`, type: "function", function: tool,
    }] } }] }));
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
    const post = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const { session } = await (await app.request("/api/v1/sessions", post({ sessionKind: "book-create" }))).json();
    sessionIds.push(session.sessionId);
    const reply = await app.request("/api/v1/agent", post({
      sessionId: session.sessionId, instruction: "Объясни, как ты работаешь с текстом.", model: "fixture-model", service: "custom:fixture",
      attachments: [{ id: "fixture-text", filename: "sample.txt", dataUrl: `data:text/plain;base64,${Buffer.from("Synthetic source, not a manuscript.").toString("base64")}` }],
    }));
    expect(reply.status).toBe(200);
    expect(await reply.json()).toMatchObject({ completionStatus: "answered", response: "Проверка завершена." });
    expect(requests.length).toBe(2);
    for (const request of requests) {
      expect(request.messages.find(message => message.role === "system")?.content).toContain("Отвечай пользователю по-русски");
    }
    const transcript = (await readFile(join(root, ".inkos/sessions", `${session.sessionId}.jsonl`), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    expect(transcript.find(event => event.type === "message" && event.role === "user").display.userInput.language).toBe("ru");
    const restored = await (await app.request(`/api/v1/sessions/${session.sessionId}`)).json();
    expect(restored.session.messages.find((message: { role: string }) => message.role === "user").content).toContain("Вложения:");
    expect(restored.session.messages.flatMap((message: { toolExecutions?: Array<{ label: string }> }) => message.toolExecutions ?? []).map((tool: { label: string }) => tool.label)).toContain("Подключение навыка");

    const state = new StateManager(root);
    const now = new Date().toISOString();
    await state.saveBookConfig("english-book", { id: "english-book", title: "Synthetic English Book", platform: "other", genre: "other", language: "en", status: "active", chapterWordCount: 2000, targetChapters: 2, createdAt: now, updatedAt: now });
    const { session: englishSession } = await (await app.request("/api/v1/sessions", post({ bookId: "english-book", sessionKind: "book" }))).json();
    sessionIds.push(englishSession.sessionId);
    const englishBookReply = await app.request("/api/v1/agent", post({ sessionId: englishSession.sessionId, instruction: "Объясни устройство проекта по-русски.", model: "fixture-model", service: "custom:fixture" }));
    expect(englishBookReply.status).toBe(200);
    expect(requests.at(-1)?.messages.find(message => message.role === "system")?.content).toContain("Отвечай пользователю по-русски");
    expect((await state.loadBookConfig("english-book")).language).toBe("en");

    await app.request("/api/v1/project", { ...post({ language: "en" }), method: "PUT" });
    const switched = await app.request("/api/v1/agent", post({ sessionId: session.sessionId, instruction: "Explain in English.", model: "fixture-model", service: "custom:fixture" }));
    expect(switched.status).toBe(200);
    expect(requests.at(-1)?.messages.find(message => message.role === "system")?.content).not.toContain("Отвечай пользователю по-русски");
  } finally {
    for (const sessionId of sessionIds) evictAgentCache(sessionId);
    upstream.closeAllConnections();
    await new Promise<void>((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
