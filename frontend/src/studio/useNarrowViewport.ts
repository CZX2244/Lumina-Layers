import { useEffect, useState } from "react";

/** True when the window is narrower than `maxWidthPx` CSS pixels (follows Windows display scaling). */
export function useNarrowViewport(maxWidthPx = 1279): boolean {
  const query = `(max-width: ${maxWidthPx}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}
