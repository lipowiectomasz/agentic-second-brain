import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";

export const serifFont = Newsreader({ subsets: ["latin", "latin-ext"], variable: "--font-newsreader", display: "swap", style: ["normal", "italic"] });

export const sansFont = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-plex-sans", display: "swap", weight: ["400", "500", "600"], style: ["normal", "italic"] });

export const monoFont = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-plex-mono", display: "swap", weight: ["400", "500", "600"] });
