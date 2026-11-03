import { describe, expect, it } from "vitest";
import { buildHarnessSystemPrompt } from "../harness/system-prompt.js";
import { createBuiltInWorkProfileRegistry } from "../harness/builtin-profiles.js";
import { createSkillRegistry } from "../skills/registry.js";

const profile = createBuiltInWorkProfileRegistry().require("longform-novel");

describe("Russian conversation language", () => {
  it("keeps a Russian response policy alongside unchanged foreign-language Skills", () => {
    const body = "Review the supplied prose. Preserve original quoted passages and artifact IDs.";
    const skills = createSkillRegistry({ skills: [{
      id: "fixture-review", name: "Fixture review", description: "English review guidance.", body, source: "external",
    }] }).resolveSkills({ requestedSkills: ["fixture-review"] });
    const prompt = buildHarnessSystemPrompt({ profile, work: null, language: "ru", skills });
    expect(prompt).toContain("Отвечай пользователю по-русски");
    expect(prompt).toContain("Язык создаваемого или переводимого произведения задаётся отдельно");
    expect(prompt).toContain(body);
    expect(prompt).toContain("fixture-review");
  });

  it.each(["en", "zh"])("preserves the existing %s conversation policy", language => {
    const prompt = buildHarnessSystemPrompt({ profile, work: null, language });
    expect(prompt).not.toContain("Отвечай пользователю по-русски");
    expect(prompt).toContain(language === "en" ? "You are the main agent" : "你是 InkOS");
  });
});
