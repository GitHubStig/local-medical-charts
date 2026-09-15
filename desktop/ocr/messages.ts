/**
 * What Test connection says at each step. Shared by the real Ollama checks and
 * the browser-development fake, so both read the same. No runtime imports.
 */

const where = (host: string) => host.replace(/^https?:\/\//, "");

export const ocrMessages = {
  running: (version: string, host: string) =>
    `Ollama ${version} is running at ${where(host)}`,
  unreachable: (host: string) =>
    `Couldn't reach Ollama at ${where(host)}. Is it running?`,
  slow: (host: string) => `Ollama at ${where(host)} didn't answer in time.`,
  noModel: () => "Choose a model first.",
  installed: (model: string) => `${model} is installed`,
  notInstalled: (model: string) =>
    `${model} isn't installed. Install it with: ollama pull ${model}`,
  cantReadImages: (model: string) =>
    `${model} can't read images. Choose a model marked “Reads images”.`,
  readOk: (seconds: number) =>
    `Read a test image correctly in ${seconds.toFixed(1)} s`,
  wrongFormat: (model: string) =>
    `${model} couldn't return the test image in the format reports are read in. Choose another model.`,
  repeating: (model: string) =>
    `${model} kept repeating itself on the test image and was stopped. Choose another model.`,
  misread: (model: string, reply: string) =>
    `${model} read the test image as “${
      reply.slice(0, 40)
    }”, not what's printed on it.`,
  readSlow: (model: string) =>
    `${model} didn't finish reading the test image in time.`,
  readFailed: (model: string, detail: string) =>
    `${model} couldn't read the test image: ${detail}`,
};
