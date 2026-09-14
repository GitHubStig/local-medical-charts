<script setup lang="ts">
import { useId } from "vue";
import { useNotifications } from "../composables/useNotifications.ts";

const { notifyWhenRead, saveError, setNotifyWhenRead } = useNotifications();
const headingId = useId();
const labelId = useId();
const helpId = useId();
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-4.5 rounded-xl border border-line bg-surface p-6"
  >
    <div class="flex flex-col gap-1.5">
      <h2 :id="headingId" class="text-[17px] font-semibold">Notifications</h2>
      <p class="text-sm text-ink-2">Reading a report can take several minutes, so the app can tell you when it’s done.</p>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-hairline pt-4.5">
      <div class="flex flex-col gap-1">
        <span :id="labelId" class="text-sm font-semibold">Notify when a reading finishes</span>
        <span :id="helpId" class="text-[13px]" :class="saveError ? 'text-danger' : 'text-ink-2'">
          {{
            saveError
            ?? "Only while Medical Charts isn’t in front. Notifications never include names, labs or results."
          }}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="notifyWhenRead"
        :aria-labelledby="labelId"
        :aria-describedby="helpId"
        class="flex size-11 items-center justify-center rounded-lg"
        @click="setNotifyWhenRead(!notifyWhenRead)"
      >
        <span
          class="flex h-5 w-8.5 items-center rounded-full p-0.5 transition-colors"
          :class="notifyWhenRead ? 'bg-ink' : 'bg-line-strong'"
          aria-hidden="true"
        >
          <span
            class="size-4 rounded-full bg-surface shadow-sm transition-transform"
            :class="notifyWhenRead ? 'translate-x-3.5' : ''"
          ></span>
        </span>
      </button>
    </div>
  </section>
</template>
