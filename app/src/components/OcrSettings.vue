<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from "vue";
import { useOcrSettings } from "../composables/useOcrSettings.ts";
import { modelChoices } from "../lib/ocr-settings.ts";
import Icon from "./Icon.vue";

const {
  host,
  model,
  models,
  loadingModels,
  test,
  testing,
  saveError,
  refreshModels,
  setHost,
  setModel,
  runTest,
} = useOcrSettings();

const headingId = useId();
const hostId = useId();
const hostHelpId = useId();
const modelId = useId();
const modelHelpId = useId();

// The field shows what's typed; it saves when you leave it or press Enter.
const hostDraft = ref(host.value);
watch(host, (saved) => (hostDraft.value = saved));

const choices = computed(() => modelChoices(models.value, model.value));
const modelHelp = computed(() => {
  if (loadingModels.value) return "Asking Ollama for its models…";
  if (models.value && !models.value.ok) return models.value.error;
  return choices.value.summary ?? "";
});

onMounted(() => {
  if (!models.value) refreshModels();
});

function chooseModel(event: Event) {
  setModel((event.target as HTMLSelectElement).value || null);
}
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-5.5 rounded-xl border border-line bg-surface p-6"
  >
    <div class="flex flex-col gap-1.5">
      <h2 :id="headingId" class="text-[17px] font-semibold">Reading PDFs and photos</h2>
      <p class="max-w-160 text-sm leading-normal text-ink-2">
        Reports you add as PDFs or photos are read by a vision model in Ollama, running on this computer. Pages never
        leave it.
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <label :for="hostId" class="text-[13px] font-semibold">Ollama address</label>
      <input
        :id="hostId"
        v-model="hostDraft"
        type="text"
        inputmode="url"
        spellcheck="false"
        autocomplete="off"
        :aria-describedby="hostHelpId"
        :aria-invalid="saveError ? 'true' : undefined"
        class="h-11 w-full max-w-105 rounded-lg border bg-surface px-3.5 font-mono text-[13px] text-ink"
        :class="saveError ? 'border-danger' : 'border-line focus:border-line-strong'"
        @change="setHost(hostDraft)"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      />
      <p :id="hostHelpId" class="text-xs" :class="saveError ? 'text-danger' : 'text-muted'">
        {{ saveError ?? "Ollama’s usual address. Change it only if Ollama listens somewhere else." }}
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <label :for="modelId" class="text-[13px] font-semibold">Model</label>
      <div class="flex max-w-205 items-center gap-2.5">
        <div class="relative min-w-0 flex-1">
          <select
            :id="modelId"
            :value="model ?? ''"
            :disabled="loadingModels"
            :aria-describedby="modelHelpId"
            class="h-11 w-full appearance-none rounded-lg border border-line bg-surface pr-10 pl-3.5 font-mono text-[13px] text-ink focus:border-line-strong disabled:opacity-60"
            @change="chooseModel"
          >
            <option
              v-for="option in choices.options"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </option>
          </select>
          <Icon
            name="chevron-down"
            class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-2"
          />
        </div>
        <button
          type="button"
          aria-label="Refresh the model list"
          title="Refresh the model list"
          :disabled="loadingModels"
          class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:text-ink disabled:opacity-60"
          @click="refreshModels"
        >
          <Icon name="refresh" :class="loadingModels ? 'animate-spin' : ''" />
        </button>
      </div>
      <p
        :id="modelHelpId"
        class="text-xs"
        :class="models && !models.ok && !loadingModels ? 'text-danger' : 'text-muted'"
      >
        {{ modelHelp }}
      </p>
    </div>

    <div class="flex flex-col gap-3.5 border-t border-hairline pt-4.5">
      <div class="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <button
          type="button"
          :disabled="testing"
          class="flex h-11 items-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink disabled:opacity-60"
          @click="runTest"
        >
          {{ testing ? "Testing…" : "Test connection" }}
        </button>
        <span v-if="testing" class="text-[13px] text-muted">
          The first test can take a minute while Ollama loads the model.
        </span>
      </div>
      <!-- Always present, so screen readers announce the results when they arrive. -->
      <div aria-live="polite">
        <ul v-if="test" class="flex flex-col gap-2.5">
          <li
            v-for="check in test.checks"
            :key="check.step"
            class="flex items-start gap-2.5 text-sm"
            :class="check.ok ? 'text-ink' : 'text-danger'"
          >
            <Icon :name="check.ok ? 'check' : 'alert-circle'" class="mt-0.5 shrink-0" />
            <span>{{ check.message }}</span>
          </li>
        </ul>
      </div>
    </div>

    <p class="text-xs text-muted">Changes are saved as you make them.</p>
  </section>
</template>
