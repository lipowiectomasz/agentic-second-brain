import { describe, expect, it } from "vitest";
import { parseThemeCookie, resolveTheme, themeBootScript } from "./theme";

describe("theme", () => {
  it("accepts only known preferences", () => {
    expect(parseThemeCookie("dark")).toBe("dark");
    expect(parseThemeCookie("light")).toBe("light");
    expect(parseThemeCookie("purple")).toBe("system");
    expect(parseThemeCookie(undefined)).toBe("system");
  });

  it("resolves the system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("boots only known themes from the cookie", () => {
    expect(themeBootScript).toContain("(light|dark)");
    expect(themeBootScript).not.toContain("innerHTML");
  });
});
