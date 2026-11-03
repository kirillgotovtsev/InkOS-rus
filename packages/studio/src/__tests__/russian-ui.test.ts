import { buildNarrativeForecastSelectionInstruction } from "../components/chat/NarrativeForecastPreview";
import { afterEach, describe, expect, it } from "vitest";
import { RUSSIAN_MESSAGES, messageTemplate } from "@actalk/inkos-core/localization/ru";
import { setAppLanguage, tr } from "../lib/app-language";
import { localizeKnownRuntimeMessage } from "../lib/error-copy";
import { strings } from "../hooks/use-i18n";
import { getGroupLabel } from "../constants/service-groups";
import { getServiceQuickLinks } from "../components/ServiceQuickLinks";
import { defaultBookCreateForm, platformOptionsForLanguage } from "../pages/BookCreate";

afterEach(() => setAppLanguage("zh"));

describe("native Russian Studio locale", () => {
  it("covers every keyed English UI message", () => {
    const missing = Object.entries(strings).filter(([, pair]) => !Object.hasOwn(RUSSIAN_MESSAGES, pair.en)).map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it("switches static and dynamic labels without altering existing locales", () => {
    setAppLanguage("ru");
    expect(tr("保存", "Save")).toBe("Сохранить");
    expect(tr("第3章", messageTemplate("Chapter {{0}}", 3))).toBe("Глава 3");
    expect(getGroupLabel("overseas")).toBe("Международные сервисы");
    const links = getServiceQuickLinks("kkaiapi");
    expect(links[0]?.label).toBe("Сайт");
    setAppLanguage("en");
    expect(tr("保存", "Save")).toBe("Save");
    expect(getServiceQuickLinks("kkaiapi").map(link => link.href)).toEqual(links.map(link => link.href));
    setAppLanguage("zh");
    expect(tr("保存", "Save")).toBe("保存");
  });

  it("localizes known API errors while preserving provider diagnostics", () => {
    setAppLanguage("ru");
    expect(localizeKnownRuntimeMessage("Studio LLM API key not set. Open Studio services and save an API key for the selected service.")).toContain("API-ключ модели Studio не задан");
    expect(localizeKnownRuntimeMessage("Provider returned custom diagnostic /model-id")).toBe("Provider returned custom diagnostic /model-id");
  });

  it("formats Russian forecast actions while preserving tool names and IDs", () => {
    const instruction = buildNarrativeForecastSelectionInstruction("forecast/id", "branch-1", "ru");
    expect(instruction).toContain("Вызовите select_narrative_branch");
    expect(instruction).toContain("forecast/id");
    expect(instruction).toContain("branch-1");
  });

  it("uses Russian-compatible book creation defaults", () => {
    expect(defaultBookCreateForm("ru")).toMatchObject({ platform: "royal-road", chapterWordCount: "2000" });
    expect(platformOptionsForLanguage("ru").at(-1)).toEqual({ value: "other", label: "Другая" });
    expect(platformOptionsForLanguage("ru").map(option => option.value)).toEqual(platformOptionsForLanguage("en").map(option => option.value));
  });
});
