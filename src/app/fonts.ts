import { DM_Mono, Schibsted_Grotesk } from "next/font/google";

/** Interface and editorial. Variable font, latin subset only. */
export const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted",
});

/** System data: clock, counters, labels. */
export const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

export const fontVariables = `${schibsted.variable} ${dmMono.variable}`;
