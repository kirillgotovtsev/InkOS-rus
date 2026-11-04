import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { expect, it, vi } from "vitest";
import { DoctorView } from "./DoctorView.js";
import { strings, type TFunction } from "../hooks/use-i18n.js";
import { translateRussian } from "@actalk/inkos-core/localization/ru";

const fixture = vi.hoisted(() => ({ checks: { inkosJson: true, projectEnv: false, globalEnv: false, booksDir: true, llmConnected: true, bookCount: 1 } }));
vi.mock("../hooks/use-api", () => ({ useApi: () => ({ data: fixture.checks, refetch: vi.fn() }) }));
const t: TFunction = key => translateRussian(strings[key].en);
const render = () => renderToStaticMarkup(createElement(DoctorView, { nav: { toDashboard: vi.fn() }, theme: "light", t }));

it("shows missing optional env files neutrally when Studio is configured", () => {
  fixture.checks.llmConnected = true;
  const html = render();
  expect(html.match(/Необязательно/g)).toHaveLength(2);
  expect(html).toContain("Обязательные проверки пройдены");
  expect(html).not.toContain("text-destructive");
});

it("retains a failure state when the model connection fails", () => {
  fixture.checks.llmConnected = false;
  const html = render();
  expect(html).toContain("text-destructive");
  expect(html).toContain("Некоторые проверки не пройдены");
  fixture.checks.llmConnected = true;
});
