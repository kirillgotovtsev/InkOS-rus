import { formatRussian, messageTemplate, translateRussian } from "@actalk/inkos-core/localization/ru";
import {
  formatImportChaptersComplete,
  formatImportChaptersDiscovery,
  formatImportChaptersResume,
  formatWriteNextComplete,
  formatWriteNextProgress,
  formatWriteNextResultLines,
  type CliLanguage,
} from "./localization.js";
import type { Observation } from "@actalk/inkos-core";

export { type CliLanguage };

export function formatWriteStartLine(
  language: CliLanguage,
  current: number,
  total: number,
  bookId: string,
): string {
  return formatWriteNextProgress(language, current, total, bookId);
}

export function formatWriteCompletionLines(
  language: CliLanguage,
  result: {
    readonly chapterNumber: number;
    readonly title: string;
    readonly wordCount: number;
    readonly observations: ReadonlyArray<Observation>;
  },
): string[] {
  return [...formatWriteNextResultLines(language, result), ""];
}

export function formatWriteDoneLine(language: CliLanguage): string {
  return formatWriteNextComplete(language);
}

export function formatImportDiscoveryLine(
  language: CliLanguage,
  chapterCount: number,
  bookId: string,
): string {
  return formatImportChaptersDiscovery(language, chapterCount, bookId);
}

export function formatImportResumeLine(
  language: CliLanguage,
  resumeFrom: number,
): string {
  return formatImportChaptersResume(language, resumeFrom);
}

export function formatImportCompletionLines(
  language: CliLanguage,
  result: {
    readonly importedCount: number;
    readonly totalCountLabel: string;
    readonly nextChapter: number;
    readonly bookId: string;
  },
): string[] {
  return [
    (language === "ru" ? translateRussian("Import complete:") : (language === "en" ? "Import complete:" : "导入完成：")),
    (language === "ru" ? formatRussian(messageTemplate("  Chapters imported: {{0}}", result.importedCount)) : (language === "en"
      ? `  Chapters imported: ${result.importedCount}`
      : `  已导入章节：${result.importedCount}`)),
    (language === "ru" ? formatRussian(messageTemplate("  Total length: {{0}}", result.totalCountLabel)) : (language === "en"
      ? `  Total length: ${result.totalCountLabel}`
      : `  总长度：${result.totalCountLabel}`)),
    (language === "ru" ? formatRussian(messageTemplate("  Next chapter number: {{0}}", result.nextChapter)) : (language === "en"
      ? `  Next chapter number: ${result.nextChapter}`
      : `  下一章编号：${result.nextChapter}`)),
    "",
    (language === "ru" ? formatRussian(messageTemplate("Run \"inkos write next {{0}}\" to continue writing.", result.bookId)) : (language === "en"
      ? `Run "inkos write next ${result.bookId}" to continue writing.`
      : `运行 "inkos write next ${result.bookId}" 继续写作。`)),
  ];
}
