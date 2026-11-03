import { messageTemplate, renderLocalizedMessage, type MessageTemplate } from "@actalk/inkos-core/localization/ru";
import { formatLengthCount, resolveLengthCountingMode, type Observation } from "@actalk/inkos-core";

export type CliLanguage = "zh" | "en" | "ru";

type WriteResultShape = {
  readonly chapterNumber: number;
  readonly title: string;
  readonly wordCount: number;
  readonly observations: ReadonlyArray<Observation>;
};

type ImportResultShape = {
  readonly importedCount: number;
  readonly totalWords: number;
  readonly nextChapter: number;
  readonly continueBookId: string;
};

function localize(language: CliLanguage, messages: { zh: string; en: string | MessageTemplate }): string {
  return language === "zh" ? messages.zh : renderLocalizedMessage(messages.en, language);
}

function normalizeCliLanguageTag(value: string | undefined): CliLanguage | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("ru")) {
    return "ru";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  if (normalized.startsWith("zh")) {
    return "zh";
  }
  return undefined;
}

export function resolveCliLanguage(
  language?: string,
  env: NodeJS.ProcessEnv = process.env,
): CliLanguage {
  const explicit = normalizeCliLanguageTag(language);
  if (explicit) {
    return explicit;
  }

  const requested = normalizeCliLanguageTag(env.INKOS_LOCALE);
  if (requested) {
    return requested;
  }

  const detected = normalizeCliLanguageTag(env.LC_ALL ?? env.LC_MESSAGES ?? env.LANG);
  return detected ?? "zh";
}

export function formatBookCreateCreating(
  language: CliLanguage,
  title: string,
  genre: string,
  platform: string,
): string {
  return localize(language, {
    zh: `创建书籍 "${title}"（${genre} / ${platform}）...`,
    en: messageTemplate("Creating book \"{{0}}\" ({{1}} / {{2}})...", title, genre, platform),
  });
}

export function formatBookCreateCreated(language: CliLanguage, bookId: string): string {
  return localize(language, {
    zh: `已创建书籍：${bookId}`,
    en: messageTemplate("Book created: {{0}}", bookId),
  });
}

export function formatBookCreateLocation(language: CliLanguage, bookId: string): string {
  return localize(language, {
    zh: `  位置：works/${bookId}/source/`,
    en: messageTemplate("  Location: works/{{0}}/source/", bookId),
  });
}

export function formatBookCreateFoundationReady(language: CliLanguage): string {
  return localize(language, {
    zh: "  故事圣经、大纲和书籍规则已生成。",
    en: "  Story bible, outline, book rules generated.",
  });
}

export function formatBookCreateNextStep(language: CliLanguage, bookId: string): string {
  return localize(language, {
    zh: `下一步：inkos write next ${bookId}`,
    en: messageTemplate("Next: inkos write next {{0}}", bookId),
  });
}

export function formatWriteNextProgress(
  language: CliLanguage,
  current: number,
  total: number,
  bookId: string,
): string {
  return localize(language, {
    zh: `[${current}/${total}] 为「${bookId}」撰写章节...`,
    en: messageTemplate("[{{0}}/{{1}}] Writing chapter for \"{{2}}\"...", current, total, bookId),
  });
}

export function formatWriteNextResultLines(
  language: CliLanguage,
  result: WriteResultShape,
): string[] {
  const lengthLabel = formatLengthCount(result.wordCount, resolveLengthCountingMode(language));
  const lines = [
    localize(language, {
      zh: `  第${result.chapterNumber}章：${result.title}`,
      en: messageTemplate("  Chapter {{0}}: {{1}}", result.chapterNumber, result.title),
    }),
    localize(language, {
      zh: `  字数：${lengthLabel}`,
      en: messageTemplate("  Length: {{0}}", lengthLabel),
    }),
    localize(language, {
      zh: `  审查观察：${result.observations.length}`,
      en: messageTemplate("  Review observations: {{0}}", result.observations.length),
    }),
  ];

  if (result.observations.length > 0) {
    lines.push(localize(language, {
      zh: "  问题：",
      en: "  Issues:",
    }));
    for (const observation of result.observations) {
      lines.push(`    ${observation.code}: ${observation.summary}`);
    }
  }

  return lines;
}

export function formatWriteNextComplete(language: CliLanguage): string {
  return localize(language, {
    zh: "完成。",
    en: "Done.",
  });
}

export function formatAutoWriteStart(
  language: CliLanguage,
  bookId: string,
  startChapter: number,
  targetChapter: number,
): string {
  return localize(language, {
    zh: `自动写作「${bookId}」：从第${startChapter}章连续写到第${targetChapter}章...`,
    en: messageTemplate("Auto-writing \"{{0}}\": chapter {{1}} through chapter {{2}}...", bookId, startChapter, targetChapter),
  });
}

export function formatAutoWriteAlreadyComplete(
  language: CliLanguage,
  bookId: string,
  writtenChapters: number,
  targetChapter: number,
): string {
  return localize(language, {
    zh: `「${bookId}」已写到第${writtenChapters}章（目标第${targetChapter}章），无需继续。`,
    en: messageTemplate("\"{{0}}\" already has {{1}} chapter(s) written (target: chapter {{2}}). Nothing to do.", bookId, writtenChapters, targetChapter),
  });
}

export type NotifyCommandAction = "write-next" | "write-rewrite" | "revise" | "audit" | "auto";

const NOTIFY_ACTION_LABELS: Record<NotifyCommandAction, { zh: string; en: string }> = {
  "write-next": { zh: "写作", en: "Write" },
  "write-rewrite": { zh: "重写", en: "Rewrite" },
  revise: { zh: "修订", en: "Revise" },
  audit: { zh: "审计", en: "Audit" },
  auto: { zh: "自动连写", en: "Auto-write" },
};

export function formatNotifyCommandTitle(
  language: CliLanguage,
  action: NotifyCommandAction,
  bookName: string | undefined,
  succeeded: boolean,
): string {
  if (language === "ru") {
    const label = { "write-next": "Написание", "write-rewrite": "Переписывание", revise: "Правка", audit: "Проверка", auto: "Автонаписание" }[action];
    return `${succeeded ? "✅ Готово" : "❌ Ошибка"}: ${label}${bookName === undefined ? "" : `: ${bookName}`}`;
  }
  const label = localize(language, NOTIFY_ACTION_LABELS[action]);
  const book = bookName === undefined
    ? ""
    : localize(language, { zh: `《${bookName}》`, en: messageTemplate(": {{0}}", bookName) });
  return succeeded
    ? localize(language, { zh: `✅ ${label}完成${book}`, en: messageTemplate("✅ {{0}} complete{{1}}", label, book) })
    : localize(language, { zh: `❌ ${label}失败${book}`, en: messageTemplate("❌ {{0}} failed{{1}}", label, book) });
}

export function formatNotifyBatchWriteBody(
  language: CliLanguage,
  chapters: ReadonlyArray<{
    readonly chapterNumber: number;
    readonly title: string;
    readonly wordCount: number;
    readonly observationCount: number;
  }>,
): string {
  const first = chapters[0]!;
  const last = chapters[chapters.length - 1]!;
  const lines = [
    localize(language, {
      zh: `本次完成 ${chapters.length} 章（第${first.chapterNumber}章到第${last.chapterNumber}章）`,
      en: messageTemplate("{{0}} chapter(s) written (chapter {{1}} to {{2}})", chapters.length, first.chapterNumber, last.chapterNumber),
    }),
    ...chapters.map((ch) => {
      const lengthLabel = formatLengthCount(ch.wordCount, resolveLengthCountingMode(language));
      return localize(language, {
        zh: `第${ch.chapterNumber}章 ${ch.title} | ${lengthLabel} | ${ch.observationCount} 条观察`,
        en: messageTemplate("Chapter {{0}} {{1}} | {{2}} | {{3}} observation(s)", ch.chapterNumber, ch.title, lengthLabel, ch.observationCount),
      });
    }),
  ];
  return lines.join("\n");
}

export function formatNotifyAuditBody(
  language: CliLanguage,
  result: {
    readonly chapterNumber: number;
    readonly issueCount: number;
    readonly summary: string;
  },
): string {
  const head = localize(language, {
    zh: `第${result.chapterNumber}章审查完成（${result.issueCount} 条观察）`,
    en: messageTemplate("Chapter {{0}} review completed ({{1}} observation(s))", result.chapterNumber, result.issueCount),
  });
  return result.summary ? `${head}\n${result.summary}` : head;
}

export function formatNotifyReviseBody(
  language: CliLanguage,
  result: {
    readonly chapterNumber: number;
    readonly changed: boolean;
    readonly wordCount: number;
    readonly observationCount: number;
  },
): string {
  if (!result.changed) {
    return localize(language, {
      zh: `第${result.chapterNumber}章没有可执行修改`,
      en: messageTemplate("Chapter {{0}} had no actionable change", result.chapterNumber),
    });
  }
  const lengthLabel = formatLengthCount(result.wordCount, resolveLengthCountingMode(language));
  return localize(language, {
    zh: `第${result.chapterNumber}章已修订 | ${lengthLabel} | 复审观察 ${result.observationCount} 条`,
    en: messageTemplate("Chapter {{0}} revised | {{1}} | {{2}} review observation(s)", result.chapterNumber, lengthLabel, result.observationCount),
  });
}

export function formatNotifyFailureBody(language: CliLanguage, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return localize(language, {
    zh: `错误：${detail}`,
    en: messageTemplate("Error: {{0}}", detail),
  });
}

export function formatImportChaptersDiscovery(
  language: CliLanguage,
  chapterCount: number,
  bookId: string,
): string {
  return localize(language, {
    zh: `发现 ${chapterCount} 章，准备导入到「${bookId}」。`,
    en: messageTemplate("Found {{0}} chapters to import into \"{{1}}\".", chapterCount, bookId),
  });
}

export function formatImportChaptersResume(
  language: CliLanguage,
  resumeFrom: number,
): string {
  return localize(language, {
    zh: `从第 ${resumeFrom} 章继续导入。`,
    en: messageTemplate("Resuming from chapter {{0}}.", resumeFrom),
  });
}

export function formatImportChaptersComplete(
  language: CliLanguage,
  result: ImportResultShape,
): string[] {
  const lengthLabel = formatLengthCount(result.totalWords, resolveLengthCountingMode(language));
  return [
    localize(language, {
      zh: "导入完成：",
      en: "Import complete:",
    }),
    localize(language, {
      zh: `  已导入章节：${result.importedCount}`,
      en: messageTemplate("  Chapters imported: {{0}}", result.importedCount),
    }),
    localize(language, {
      zh: `  总长度：${lengthLabel}`,
      en: messageTemplate("  Total length: {{0}}", lengthLabel),
    }),
    localize(language, {
      zh: `  下一章编号：${result.nextChapter}`,
      en: messageTemplate("  Next chapter number: {{0}}", result.nextChapter),
    }),
    "",
    localize(language, {
      zh: `运行 "inkos write next ${result.continueBookId}" 继续写作。`,
      en: messageTemplate("Run \"inkos write next {{0}}\" to continue writing.", result.continueBookId),
    }),
  ];
}

export function formatImportCanonStart(
  language: CliLanguage,
  parentBookId: string,
  targetBookId: string,
): string {
  return localize(language, {
    zh: `把 "${parentBookId}" 的正典导入到 "${targetBookId}"...`,
    en: messageTemplate("Importing canon from \"{{0}}\" into \"{{1}}\"...", parentBookId, targetBookId),
  });
}

export function formatImportCanonComplete(language: CliLanguage): string[] {
  return [
    localize(language, {
      zh: "正典已导入：story/parent_canon.md",
      en: "Canon imported: story/parent_canon.md",
    }),
    localize(language, {
      zh: "Writer 和 auditor 会在番外模式下自动识别这个文件。",
      en: "Writer and auditor will auto-detect this file for spinoff mode.",
    }),
  ];
}

export function formatListModelsEmpty(language: CliLanguage, service: string): string {
  return localize(language, {
    zh: `${service} 没有可用模型（可能需要 --api-key 和 --base-url）`,
    en: messageTemplate("No models available for {{0}} (you may need --api-key and --base-url)", service),
  });
}

export function formatListModelsHeader(
  language: CliLanguage,
  service: string,
  count: number,
): string {
  return localize(language, {
    zh: `${service}：${count} 个模型`,
    en: messageTemplate("{{0}}: {{1}} model(s)", service, count),
  });
}

export function formatDoctorHintQuota(language: CliLanguage): string {
  return localize(language, {
    zh: "检查 API Key 是否正确、模型是否可用，以及账号余额或配额是否足够。",
    en: "Check that the API key is valid, the model is available, and the account has enough balance or quota.",
  });
}

export function formatDoctorHintOpenAiProbeExhausted(language: CliLanguage): string {
  return localize(language, {
    zh: "当前已自动尝试 chat/responses 与流式开关组合；如果仍失败，问题更可能在模型名、baseUrl 路径或服务商兼容性本身。",
    en: "All chat/responses and stream on/off combinations were already probed; if it still fails, the problem is more likely the model name, the baseUrl path, or provider compatibility itself.",
  });
}

export function formatDoctorHintBaseUrl(language: CliLanguage): string {
  return localize(language, {
    zh: "baseUrl 可能不正确，检查 INKOS_LLM_BASE_URL 是否包含完整路径（如 /v1）",
    en: "The baseUrl may be wrong. Check that INKOS_LLM_BASE_URL includes the full path (e.g. /v1).",
  });
}

export function formatDoctorHintStreamRequirement(language: CliLanguage): string {
  return localize(language, {
    zh: "检查提供方文档，确认该接口要求 stream=true、stream=false，还是根本不支持 stream",
    en: "Check the provider docs to confirm whether the endpoint requires stream=true, stream=false, or does not support streaming at all.",
  });
}

export function formatDoctorHintModelName(language: CliLanguage): string {
  return localize(language, {
    zh: "检查模型名称是否正确（INKOS_LLM_MODEL）",
    en: "Check that the model name is correct (INKOS_LLM_MODEL).",
  });
}

export function formatDoctorHintInvalidApiKey(language: CliLanguage): string {
  return localize(language, {
    zh: "API Key 无效，检查 INKOS_LLM_API_KEY",
    en: "The API key is invalid. Check INKOS_LLM_API_KEY.",
  });
}

// Fanfic errors are intentionally bilingual in a single string: they can surface
// through `--json` output or be rethrown before any book language is known.
export function formatFanficCanonMissingError(): string {
  return "No fanfic canon found for this book. Create one with `inkos fanfic init`（该书没有同人正典文件，用 inkos fanfic init 创建同人书）";
}

export function formatFanficSourceDirEmptyError(sourcePath: string): string {
  return `No .txt or .md files found in ${sourcePath}（目录 ${sourcePath} 中没有 .txt 或 .md 文件）`;
}

export function formatChapterSyncNoChanges(language: CliLanguage, checked: number): string {
  return localize(language, {
    zh: `已核对 ${checked} 章，index.json 字数无需修正。`,
    en: messageTemplate("Checked {{0}} chapter(s); index.json word counts already match the files.", checked),
  });
}

export function formatChapterSyncChange(
  language: CliLanguage,
  change: { number: number; title: string; previousWordCount: number; wordCount: number },
  countingMode: Parameters<typeof formatLengthCount>[1],
): string {
  const from = formatLengthCount(change.previousWordCount, countingMode);
  const to = formatLengthCount(change.wordCount, countingMode);
  return localize(language, {
    zh: `  第${change.number}章 ${change.title}：${from} → ${to}`,
    en: messageTemplate("  Chapter {{0}} {{1}}: {{2}} → {{3}}", change.number, change.title, from, to),
  });
}

export function formatChapterSyncSummary(language: CliLanguage, changed: number, checked: number): string {
  return localize(language, {
    zh: `已核对 ${checked} 章，修正了 ${changed} 章的 index.json 字数。`,
    en: messageTemplate("Checked {{0}} chapter(s); corrected {{1}} index.json word count(s).", checked, changed),
  });
}

export function formatChapterSyncMissingFiles(language: CliLanguage, numbers: ReadonlyArray<number>): string {
  return localize(language, {
    zh: `警告：index.json 中的第 ${numbers.join("、")} 章找不到对应的章节文件，已跳过。`,
    en: messageTemplate("Warning: chapter(s) {{0}} exist in index.json but have no chapter file on disk; skipped.", numbers.join(", ")),
  });
}

export function formatChapterDeleteConfirm(
  language: CliLanguage,
  params: { bookTitle: string; bookId: string; number: number; title: string },
): string {
  return localize(language, {
    zh: `将删除《${params.bookTitle}》(${params.bookId}) 的最新章：第${params.number}章 ${params.title}。`
      + `章节文件会移入 chapters/.trash/，索引和故事状态回滚到第${params.number - 1}章。确认删除？(y/N) `,
    en: `Delete the latest chapter of "${params.bookTitle}" (${params.bookId}): chapter ${params.number} ${params.title}? `
      + `The chapter file moves to chapters/.trash/ and the index and story state roll back to chapter ${params.number - 1}. (y/N) `,
  });
}

export function formatChapterDeleteCancelled(language: CliLanguage): string {
  return localize(language, {
    zh: "已取消。",
    en: "Cancelled.",
  });
}

export function formatChapterDeleteDone(
  language: CliLanguage,
  params: { number: number; title: string; trashedFiles: ReadonlyArray<string>; rolledBackTo: number },
): string {
  const trashNote = params.trashedFiles.length > 0
    ? params.trashedFiles.join(", ")
    : localize(language, { zh: "（章节文件已不存在，未移动）", en: "(chapter file was already gone; nothing moved)" });
  return localize(language, {
    zh: `已删除第${params.number}章 ${params.title}：章节文件保留在 ${trashNote}，索引和故事状态已回滚到第${params.rolledBackTo}章。`,
    en: messageTemplate("Deleted chapter {{0}} {{1}}: chapter file kept at {{2}}; index and story state rolled back to chapter {{3}}.", params.number, params.title, trashNote, params.rolledBackTo),
  });
}

export function formatBookBackupCreated(language: CliLanguage, bookId: string, backupId: string): string {
  return localize(language, {
    zh: `已备份 ${bookId} → .inkos/backups/${bookId}/${backupId}/`,
    en: messageTemplate("Backed up {{0}} → .inkos/backups/{{1}}/{{2}}/", bookId, bookId, backupId),
  });
}

export function formatBookBackupListEmpty(language: CliLanguage, bookId: string): string {
  return localize(language, {
    zh: `${bookId} 还没有备份。用 inkos book backup ${bookId} 创建一份。`,
    en: messageTemplate("No backups for {{0}} yet. Create one with: inkos book backup {{1}}", bookId, bookId),
  });
}

export function formatBookRestoreDone(
  language: CliLanguage,
  params: { bookId: string; backupId: string; preRestoreBackupId: string | null },
): string {
  const preNote = params.preRestoreBackupId
    ? localize(language, {
        zh: `恢复前的状态已自动备份为 ${params.preRestoreBackupId}。`,
        en: messageTemplate("The pre-restore state was automatically backed up as {{0}}.", params.preRestoreBackupId),
      })
    : localize(language, {
        zh: "书目录当时不存在，未创建恢复前备份。",
        en: "The book directory did not exist, so no pre-restore backup was created.",
      });
  return localize(language, {
    zh: `已把 ${params.bookId} 恢复到备份 ${params.backupId}。${preNote}`,
    en: messageTemplate("Restored {{0}} to backup {{1}}. {{2}}", params.bookId, params.backupId, preNote),
  });
}
