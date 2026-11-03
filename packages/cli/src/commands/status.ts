import { messageTemplate, renderLocalizedMessage, type MessageTemplate } from "@actalk/inkos-core/localization/ru";
import { resolveCliLanguage } from "../localization.js";
import { Command } from "commander";
import { StateManager, formatLengthCount, resolveLengthCountingMode } from "@actalk/inkos-core";
import { findProjectRoot, loadConfig, log, logError } from "../utils.js";

export const statusCommand = new Command("status")
  .description("Show project status")
  .argument("[book-id]", "Book ID (optional, shows all if omitted)")
  .option("--chapters", "Show per-chapter status and observations")
  .option("--json", "Output JSON")
  .action(async (bookIdArg: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      const language = resolveCliLanguage((await loadConfig({ requireApiKey: false })).language);
      const output = (message: string | MessageTemplate) => log(renderLocalizedMessage(message, !opts.json && language === "ru" ? "ru" : "en"));
      const state = new StateManager(root);

      const allBookIds = await state.listBooks();
      const bookIds = bookIdArg ? [bookIdArg] : allBookIds;

      if (bookIdArg && !allBookIds.includes(bookIdArg)) {
        throw new Error(
          `Book "${bookIdArg}" not found. Available: ${allBookIds.join(", ") || "(none)"}`,
        );
      }

      const booksData = [];

      if (!opts.json) {
        output(messageTemplate("InkOS Project: {{0}}", root));
        output(messageTemplate("Books: {{0}}", allBookIds.length));
        output("");
      }

      for (const id of bookIds) {
        const book = await state.loadBookConfig(id);
        const index = await state.loadChapterIndex(id);
        const persistedChapterCount = await state.getPersistedChapterCount(id);
        const countingMode = resolveLengthCountingMode(book.language);

        const observationCount = index.reduce((sum, chapter) => sum + chapter.observations.length, 0);
        const chaptersWithObservations = index.filter((chapter) => chapter.observations.length > 0).length;
        const totalWords = index.reduce((sum, ch) => sum + ch.wordCount, 0);
        const avgWords = index.length > 0 ? Math.round(totalWords / index.length) : 0;

        booksData.push({
          id,
          title: book.title,
          status: book.status,
          genre: book.genre,
          platform: book.platform,
          chapters: index.length,
          chapterFiles: persistedChapterCount,
          targetChapters: book.targetChapters,
          totalWords,
          avgWordsPerChapter: avgWords,
          observationCount,
          chaptersWithObservations,
          ...(opts.chapters ? {
            chapterList: index.map((ch) => ({
              number: ch.number,
              title: ch.title,
              wordCount: ch.wordCount,
              provenance: ch.provenance,
              observations: ch.observations,
            })),
          } : {}),
        });

        if (!opts.json) {
          output(messageTemplate("  {{0}} ({{1}})", book.title, id));
          output(messageTemplate("    Status: {{0}}", book.status));
          output(messageTemplate("    Platform: {{0}} | Genre: {{1}}", book.platform, book.genre));
          output(messageTemplate("    Chapters: {{0}} / {{1}}", index.length, book.targetChapters));
          if (persistedChapterCount !== index.length) output(messageTemplate("    Chapter files: {{0}}; the file count differs from the chapter index.", persistedChapterCount));
          output(messageTemplate("    Words: {{0}} (avg {{1}}/ch)", totalWords.toLocaleString(), avgWords));
          output(messageTemplate("    Review observations: {{0}} across {{1}} chapter(s)", observationCount, chaptersWithObservations));

          if (opts.chapters && index.length > 0) {
            output("");
            for (const ch of index) {
              const icon = ch.observations.length > 0 ? "!" : "+";
              output(messageTemplate("    [{{0}}] Ch.{{1}} \"{{2}}\" | {{3}} | {{4}}", icon, ch.number, ch.title, formatLengthCount(ch.wordCount, countingMode), ch.provenance));
              for (const observation of ch.observations) {
                output(messageTemplate("        {{0}}: {{1}}", observation.code, observation.summary));
              }
            }
          }
          output("");
        }
      }

      if (opts.json) {
        output(JSON.stringify({ project: root, books: booksData }, null, 2));
      }
    } catch (e) {
      if (opts.json) {
        log(JSON.stringify({ error: String(e) }));
      } else {
        logError(`Failed to get status: ${e}`);
      }
      process.exit(1);
    }
  });
