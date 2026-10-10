"use client";

import dynamic from "next/dynamic";

/**
 * The workbench's lamp, loaded in the browser only and only on this chapter:
 * a canvas has nothing to render on the server, and every other page never
 * downloads it. (The reel loads its own X-ray the same way.)
 */
export const WorkbenchLightSlot = dynamic(() => import("./WorkbenchLight"), { ssr: false });
