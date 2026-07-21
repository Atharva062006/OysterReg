"use client";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { usePathname } from "next/navigation";

/**
 * Always mounted in the layout so the Three.js animation loop never stops.
 * On non-home pages we set opacity:0 (canvas keeps running invisibly) so
 * navigating back to "/" shows the animation already mid-wave — no pause.
 */
export default function ClientBackground() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <DottedSurface
      style={{
        opacity: isHome ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
    />
  );
}
