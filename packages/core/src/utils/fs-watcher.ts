import { type FSWatcher, watch } from "node:fs";

export interface FileChangeEvent {
  path: string;
  eventType: "rename" | "change";
}

/**
 * Watches the given paths for changes and invokes the callback.
 * Debounces events by `debounceMs` (default 100ms).
 * Returns a cleanup function that stops all watchers.
 */
export function watchPaths(
  paths: string[],
  callback: (event: FileChangeEvent) => void,
  debounceMs = 100,
): () => void {
  const watchers: FSWatcher[] = [];
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  for (const p of paths) {
    const watcher = watch(p, (eventType, filename) => {
      const key = `${p}:${filename ?? ""}`;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);

      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          callback({
            path: filename ? `${p}/${filename}` : p,
            eventType: eventType as "rename" | "change",
          });
        }, debounceMs),
      );
    });
    watchers.push(watcher);
  }

  return () => {
    for (const w of watchers) w.close();
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  };
}
