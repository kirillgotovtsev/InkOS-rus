import { messageTemplate, renderLocalizedMessage, type MessageTemplate } from "@actalk/inkos-core/localization/ru";
import { WritingLanguageSchema } from "@actalk/inkos-core";
import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { log, logError } from "../utils.js";
import { hasGlobalConfig, initializeProjectDirectory } from "../project-bootstrap.js";

export const initCommand = new Command("init")
  .description("Initialize an InkOS project (current directory by default)")
  .argument("[name]", "Project name (creates subdirectory). Omit to init current directory.")
  .option("--lang <language>", "Default writing language: zh (Chinese), en (English), or ru (Russian)", "zh")
  .action(async (name: string | undefined, opts: { lang?: string }) => {
    const output = (message: string | MessageTemplate) => log(renderLocalizedMessage(message, opts.lang === "ru" ? "ru" : "en"));
    const projectDir = name ? resolve(process.cwd(), name) : process.cwd();

    try {
      await mkdir(projectDir, { recursive: true });
      await initializeProjectDirectory(projectDir, {
        language: WritingLanguageSchema.parse(opts.lang ?? "zh"),
        overwriteSupportFiles: true,
      });

      output(messageTemplate("Project initialized at {{0}}", projectDir));
      output("");
      const isEnglish = (opts.lang ?? "zh") !== "zh";
      const exampleCreateLines = opts.lang === "ru"
        ? ["  inkos book create --title 'Мой роман' --genre other --platform other --lang ru"]
        : isEnglish
        ? ["  inkos book create --title 'My Novel' --genre progression --platform royalroad --lang en"]
        : [
          "  inkos book create --title '我的小说' --genre xuanhuan --platform tomato",
          "  # English project? Re-run with: inkos init --lang en",
        ];
      if (await hasGlobalConfig()) {
        output("Global LLM config detected. Ready to go!");
        output("");
        output("Next steps:");
        if (name) output(messageTemplate("  cd {{0}}", name));
        for (const line of exampleCreateLines) output(line);
      } else {
        output("Next steps:");
        if (name) output(messageTemplate("  cd {{0}}", name));
        output("  # Option 1: Set global config (recommended, one-time):");
        output("  inkos config set-global --provider openai --base-url <your-api-url> --api-key <your-key> --model <your-model>");
        output("  # Option 2: Edit .env for this project only");
        output("");
        for (const line of exampleCreateLines) output(line);
      }
      output("  inkos write next <book-id>");
    } catch (e) {
      logError(`Failed to initialize project: ${e}`);
      process.exit(1);
    }
  });
