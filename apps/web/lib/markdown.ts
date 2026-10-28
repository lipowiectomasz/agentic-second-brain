export function withoutLeadingTitle(body: string, title: string): string {
  const match = /^\s*#\s+(.+?)\s*#*\s*(\r?\n|$)/.exec(body);
  if (match === null || match[1]?.trim() !== title.trim()) return body;
  return body.slice(match[0].length);
}
