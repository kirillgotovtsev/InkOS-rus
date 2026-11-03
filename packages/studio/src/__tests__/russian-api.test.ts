import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createStudioServer } from "../api/server.js";

it("persists Russian locale and translates API errors without changing their codes or guards", async () => {
  const root = await mkdtemp(join(tmpdir(), "inkos-ru-api-"));
  try {
    await writeFile(join(root, "inkos.json"), JSON.stringify({
      name: "fixture", version: "0.1.0", language: "en",
      llm: { provider: "openai", configSource: "studio", service: "custom", model: "", baseUrl: "" },
      notify: [],
    }));
    const app = createStudioServer({} as never, root);
    const changed = await app.request("/api/v1/project", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: "ru" }),
    });
    expect(changed.status).toBe(200);
    expect(JSON.parse(await readFile(join(root, "inkos.json"), "utf8")).language).toBe("ru");
    const project = await app.request("/api/v1/project");
    expect(await project.json()).toMatchObject({ language: "ru" });
    const forbidden = await app.request("/api/v1/books", { headers: { Origin: "https://untrusted.example" } });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: { code: "STUDIO_ORIGIN_FORBIDDEN", message: "Этот источник браузерного запроса не имеет доступа к Studio." } });
    expect(forbidden.headers.get("Access-Control-Allow-Origin")).toBeNull();
    await app.request("/api/v1/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: "en" }) });
    const english = await app.request("/api/v1/books", { headers: { Origin: "https://untrusted.example" } });
    expect(await english.json()).toMatchObject({ error: { code: "STUDIO_ORIGIN_FORBIDDEN", message: "This browser origin is not allowed to access Studio." } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
