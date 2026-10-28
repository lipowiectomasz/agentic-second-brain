export type Tone = "success" | "muted" | "danger" | "warning" | "info";

const colours: Record<Tone, string> = { success: "32", muted: "90", danger: "31", warning: "33", info: "36" };

export interface Output {
  quiet: boolean;
  json: boolean;
  line(glyph: string, word: string, tone: Tone, detail: string): void;
  info(text: string): void;
  warn(text: string): void;
  error(text: string): void;
  data(value: unknown): void;
}

export function createOutput(options: { quiet: boolean; json: boolean; color: boolean; stdout: (text: string) => void; stderr: (text: string) => void }): Output {
  const paint = (tone: Tone, text: string) => (options.color ? `\u001b[${colours[tone]}m${text}\u001b[0m` : text);
  return {
    quiet: options.quiet,
    json: options.json,
    line(glyph, word, tone, detail) {
      if (options.json || (options.quiet && tone !== "danger" && tone !== "warning")) return;
      const prefix = options.quiet ? "cortex: " : "";
      options.stdout(`${prefix}${paint(tone, `${glyph} ${word.padEnd(11)}`)} ${detail}\n`);
    },
    info(text) {
      if (!options.quiet && !options.json) options.stdout(`${text}\n`);
    },
    warn(text) {
      options.stderr(`cortex: ${paint("warning", text)}\n`);
    },
    error(text) {
      options.stderr(`cortex: ${paint("danger", text)}\n`);
    },
    data(value) {
      if (options.json) options.stdout(`${JSON.stringify(value, null, 2)}\n`);
    },
  };
}
