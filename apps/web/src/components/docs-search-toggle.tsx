"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function DocsSearchToggle() {
  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

  return (
    <button
      type="button"
      data-search-full=""
      className={cn(
        "inline-flex w-full items-center gap-2 rounded-lg border bg-fd-secondary/50 p-1.5 ps-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
      )}
      onClick={() => {
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: isMac,
          ctrlKey: !isMac,
          bubbles: true,
        });
        document.dispatchEvent(event);
      }}
    >
      <Search className="size-4 shrink-0" />
      <span className="truncate">Search...</span>
      <div className="ms-auto inline-flex shrink-0 gap-0.5">
        <kbd className="rounded-md border bg-fd-background px-1.5">{isMac ? "⌘" : "Ctrl"}</kbd>
        <kbd className="rounded-md border bg-fd-background px-1.5">K</kbd>
      </div>
    </button>
  );
}
