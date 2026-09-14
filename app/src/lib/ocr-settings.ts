/**
 * What the model dropdown on the settings page offers. Plain functions, tested
 * in desktop/ocr-settings_test.ts.
 */
import type { OcrModelList } from "../../../desktop/contract.ts";
import { plural } from "./format.ts";

export type ModelOption = { value: string; label: string; disabled: boolean };

export type ModelChoices = {
  options: ModelOption[];
  /** "3 models installed · 2 can read images"; null until Ollama has answered. */
  summary: string | null;
};

export function modelChoices(
  list: OcrModelList | null,
  selected: string | null,
): ModelChoices {
  const models = list?.ok ? list.models : [];
  const options: ModelOption[] = [];

  if (selected === null) {
    options.push({
      value: "",
      label: models.length ? "Choose a model" : "No models to choose from",
      disabled: true,
    });
  } else if (!models.some((m) => m.name === selected)) {
    // Keep a saved choice visible even when Ollama doesn't list it (or couldn't be reached).
    options.push({
      value: selected,
      label: list?.ok ? `${selected} · not installed` : selected,
      disabled: false,
    });
  }

  for (const model of models) {
    options.push({
      value: model.name,
      label: `${model.name} · ${
        model.readsImages ? "reads images" : "text only"
      }`,
      // Text-only models can't read pages; one already saved stays selectable so the choice shows.
      disabled: !model.readsImages && model.name !== selected,
    });
  }

  const readers = models.filter((m) => m.readsImages).length;
  const summary = !list?.ok
    ? null
    : models.length
    ? `${plural(models.length, "model")} installed · ${readers} can read images`
    : "No models installed. Install a vision model with ollama pull.";

  return { options, summary };
}
