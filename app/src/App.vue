<script setup lang="ts">
import { ref } from "vue";
import type { PingReply } from "../../desktop/contract.ts";
import { desktop } from "./desktop.ts";

const reply = ref<PingReply | null>(null);
const error = ref<string | null>(null);

async function ping() {
  if (!desktop) return;
  error.value = null;
  try {
    reply.value = await desktop.ping("hello from Vue");
  } catch (err) {
    // Binding errors arrive as plain { name, message, stack } objects.
    error.value = (err as { message?: string }).message ?? String(err);
  }
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-6 p-10">
    <div class="flex flex-col items-center gap-2">
      <h1 class="text-3xl font-semibold tracking-tight">Medical Charts</h1>
      <p class="text-ink-2">Desktop shell check</p>
    </div>

    <template v-if="desktop">
      <button
        type="button"
        class="h-11 rounded-lg bg-ink px-4 text-sm font-medium text-white"
        @click="ping"
      >
        Ping Deno
      </button>
      <dl
        v-if="reply"
        class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-xl border border-line bg-surface px-5 py-4 text-sm"
      >
        <dt class="text-muted">Reply</dt>
        <dd>{{ reply.message }}</dd>
        <dt class="text-muted">Deno</dt>
        <dd>{{ reply.deno }} on {{ reply.platform }}</dd>
        <dt class="text-muted">Received</dt>
        <dd class="font-mono text-xs">{{ reply.receivedAt }}</dd>
      </dl>
      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </template>

    <p v-else class="max-w-md text-center text-sm text-ink-2">
      Running in a browser, so there are no desktop bindings. Run
      <code class="font-mono">deno task desktop</code> to open the app in its
      window.
    </p>
  </main>
</template>
