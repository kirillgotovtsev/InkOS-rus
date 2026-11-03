import { describe, expect, it } from "vitest";
import { formatBookCreateCreating, formatWriteNextResultLines, resolveCliLanguage } from "../localization.js";
import { getTuiCopy, resolveTuiLocale } from "../tui/i18n.js";
import { buildAutoInitMessages, buildInteractiveSetupCopy } from "../tui/setup.js";
import { buildSlashCommands } from "../tui/slash-autocomplete.js";

describe("Russian CLI and TUI messages", () => {
  it("resolves project and environment locales", () => {
    expect(resolveCliLanguage("ru", {})).toBe("ru");
    expect(resolveCliLanguage(undefined, { LANG: "ru_RU.UTF-8" })).toBe("ru");
    expect(resolveTuiLocale({}, "ru")).toBe("ru");
    expect(resolveTuiLocale({ INKOS_TUI_LOCALE: "ru-RU" }, "en")).toBe("ru");
    expect(resolveTuiLocale({ INKOS_TUI_LOCALE: "en" }, "ru")).toBe("en");
  });

  it("translates progress and preserves supplied values", () => {
    expect(formatBookCreateCreating("ru", "Поезд $&", "mystery", "other")).toBe("Создание книги «Поезд $&» (mystery / other)…");
    expect(formatWriteNextResultLines("ru", { chapterNumber: 2, title: "Письмо", wordCount: 21, observations: [] })).toEqual(["  Глава 2: Письмо", "  Объём: 21 слово", "  Замечаний при проверке: 0"]);
  });

  it("provides Russian terminal menus and setup hints with working command stems", () => {
    const copy = getTuiCopy("ru");
    expect(copy.labels.project).toBe("Проект");
    expect(copy.labels.messageCount(21)).toBe("Сообщений: 21");
    expect(buildInteractiveSetupCopy("ru").steps.apiKey).toBe("API-ключ");
    expect(buildAutoInitMessages("test", "ru").initializing).toContain("test/");
    expect(buildSlashCommands("ru")).toContain("/new опишите замысел");
    expect(buildSlashCommands("ru")).toContain("/confirm");
    expect(getTuiCopy("en").labels.project).toBe("Project");
  });
});
