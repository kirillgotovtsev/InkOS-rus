import { describe, expect, it } from "vitest";
import { formatRussian, messageTemplate, renderLocalizedMessage, translateRussian } from "../localization/ru.js";

describe("Russian built-in copy", () => {
  it("translates known labels and preserves unknown diagnostics", () => {
    expect(translateRussian("Project Settings")).toBe("Настройки проекта");
    const external = "Provider error: custom-model/q5 returned code E123 (request x/y)";
    expect(translateRussian(external)).toBe(external);
    expect(translateRussian("This ends with s")).toBe("This ends with s");
  });

  it("formats values without interpreting quotes, braces, dollars, or line breaks", () => {
    const title = 'Поезд " ({{0}}) $& / ${secret}\nследующая строка';
    const message = messageTemplate("Creating book \"{{0}}\" ({{1}} / {{2}})...", title, "genre/id", "site-id");
    expect(renderLocalizedMessage(message, "en")).toBe(`Creating book "${title}" (genre/id / site-id)...`);
    expect(renderLocalizedMessage(message, "ru")).toBe(`Создание книги «${title}» (genre/id / site-id)…`);
    expect(formatRussian("  Location: works/{{0}}/source/", title)).toBe(`  Папка: works/${title}/source/`);
  });

  it("allows Russian word order without changing argument positions", () => {
    expect(formatRussian("Found {{0}} chapters to import into \"{{1}}\".", 21, "Роман")).toBe("Найдено глав для импорта в «Роман»: 21.");
    expect(formatRussian("Run \"inkos write next {{0}}\" to continue writing.", "книга-1")).toContain("inkos write next книга-1");
  });
});
