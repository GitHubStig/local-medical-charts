import { assertEquals } from "@std/assert";
import { modelChoices } from "../app/src/lib/ocr-settings.ts";
import { parseRoute } from "../app/src/lib/route.ts";
import type { OcrModelList } from "./contract.ts";

const LIST: OcrModelList = {
  ok: true,
  host: "http://localhost:11434",
  version: "0.34.0",
  models: [
    {
      name: "gemma3:27b",
      readsImages: true,
      parameterSize: "27B",
      contextLength: 131072,
    },
    {
      name: "llama3.3:70b",
      readsImages: false,
      parameterSize: "70B",
      contextLength: 131072,
    },
    {
      name: "qwen3.8:27b-mlx",
      readsImages: true,
      parameterSize: "27.8B",
      contextLength: 262144,
    },
  ],
};

Deno.test("the model dropdown marks what each model can do; text-only models can't be picked", () => {
  assertEquals(modelChoices(LIST, null), {
    options: [
      { value: "", label: "Choose a model", disabled: true },
      {
        value: "gemma3:27b",
        label: "gemma3:27b · reads images",
        disabled: false,
      },
      {
        value: "llama3.3:70b",
        label: "llama3.3:70b · text only",
        disabled: true,
      },
      {
        value: "qwen3.8:27b-mlx",
        label: "qwen3.8:27b-mlx · reads images",
        disabled: false,
      },
    ],
    summary: "3 models installed · 2 can read images",
  });
});

Deno.test("a saved model stays visible when Ollama doesn't list it, or can't be reached", () => {
  assertEquals(modelChoices(LIST, "muse:30b").options[0], {
    value: "muse:30b",
    label: "muse:30b · not installed",
    disabled: false,
  });
  // A text-only model already saved stays selectable, so the dropdown can show it.
  assertEquals(
    modelChoices(LIST, "llama3.3:70b").options.find((o) =>
      o.value === "llama3.3:70b"
    )?.disabled,
    false,
  );

  const unreachable: OcrModelList = {
    ok: false,
    host: LIST.host,
    error: "Couldn't reach Ollama",
  };
  assertEquals(modelChoices(unreachable, "qwen3.8:27b-mlx"), {
    options: [{
      value: "qwen3.8:27b-mlx",
      label: "qwen3.8:27b-mlx",
      disabled: false,
    }],
    summary: null,
  });
  assertEquals(modelChoices(null, null), {
    options: [{ value: "", label: "No models to choose from", disabled: true }],
    summary: null,
  });
  assertEquals(
    modelChoices({ ...LIST, models: [] }, null).summary,
    "No models installed. Install a vision model with ollama pull.",
  );
});

Deno.test("the address fragment picks the screen", () => {
  assertEquals(parseRoute("#/settings"), "settings");
  assertEquals(parseRoute("#settings"), "settings");
  assertEquals(parseRoute(""), "home");
  assertEquals(parseRoute("#/"), "home");
  assertEquals(parseRoute("#/settings/more"), "home");
});
