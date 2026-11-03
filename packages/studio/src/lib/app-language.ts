// 全局应用语言：非 React 模块（store slice、parts-builder、error-copy 等）无法用
// useI18n hook，从这里读取。App.tsx 在项目配置加载/切换语言时调用 setAppLanguage 同步。
import { renderLocalizedMessage, type MessageTemplate } from "@actalk/inkos-core/localization/ru";

export type AppLanguage = "zh" | "en" | "ru";

let current: AppLanguage = "zh";

export function setAppLanguage(lang: AppLanguage): void {
  current = lang;
}

export function getAppLanguage(): AppLanguage {
  return current;
}

/** 内联双语：tr("中文", "English")。默认中文，保持既有测试与默认体验不变。 */
export function tr(zh: string, en: string | MessageTemplate, language?: AppLanguage | boolean): string {
  const locale = typeof language === "boolean"
    ? current === "ru" ? "ru" : language ? "zh" : "en"
    : language ?? current;
  return locale === "zh" ? zh : renderLocalizedMessage(en, locale);
}
