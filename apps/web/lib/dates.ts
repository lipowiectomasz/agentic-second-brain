const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function shortDate(iso: string): string {
  return short.format(new Date(iso));
}

export function longDate(iso: string): string {
  return long.format(new Date(iso));
}
