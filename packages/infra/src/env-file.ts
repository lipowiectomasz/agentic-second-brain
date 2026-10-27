const keyPattern = /^[A-Z][A-Z0-9_]*$/;

export function upsertEnvFile(content: string, values: Record<string, string>): string {
  const remaining = new Map(Object.entries(values));
  for (const key of remaining.keys()) {
    if (!keyPattern.test(key)) {
      throw new Error(`Invalid environment variable name: ${key}`);
    }
  }
  const lines = content === "" ? [] : content.replace(/\n$/, "").split("\n");
  const updated = lines.map((line) => {
    const key = line.split("=", 1)[0] ?? "";
    const value = remaining.get(key);
    if (value === undefined) {
      return line;
    }
    remaining.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of remaining) {
    updated.push(`${key}=${value}`);
  }
  return updated.length === 0 ? "" : `${updated.join("\n")}\n`;
}
