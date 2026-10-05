"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Loaded in the browser only, and only where it shows: a canvas and animation
// frames have nothing to render on the server, and a phone never downloads them.
const DeskArt = dynamic(() => import("./DeskArt"), { ssr: false });

/** Wide screens with a fine pointer: the desk's koi. Same threshold as `lg:`. */
export const DESK_ART_MEDIA = "(min-width: 64rem) and (pointer: fine)";

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setMatches(media.matches);
    update();
    // Safari before 14 only knows the older addListener.
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, [query]);
  return matches;
}

/**
 * The place on the right of the desk. Its box is in the server's HTML, so the
 * desk's layout never shifts; the koi inside are only loaded on wide screens
 * with a fine pointer — never on a phone.
 */
export function DeskArtSlot() {
  const wide = useMedia(DESK_ART_MEDIA);
  return (
    <div data-desk-art-slot="" className="hidden size-[min(30vw,26rem)] shrink-0 lg:pointer-fine:block">
      {wide && <DeskArt />}
    </div>
  );
}
