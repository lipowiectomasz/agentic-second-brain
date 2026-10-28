import type { Metadata } from "next";
import { themeBootScript } from "@/lib/theme";
import { monoFont, sansFont, serifFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cortex", template: "%s - Cortex" },
  description: "Your team's knowledge, mapped by meaning.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serifFont.variable} ${sansFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
