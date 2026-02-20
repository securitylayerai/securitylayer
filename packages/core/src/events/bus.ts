import { randomUUID } from "node:crypto";
import type { SecurityEvent, SecurityEventMap, SecurityEventType } from "./types";

type Handler<T> = (event: T) => void;

export function createEventBus() {
  const handlers = new Map<string, Set<Handler<SecurityEvent>>>();
  const wildcardHandlers = new Set<Handler<SecurityEvent>>();

  return {
    /** Subscribe to a specific event type. Returns an unsubscribe function. */
    on<K extends SecurityEventType>(type: K, handler: Handler<SecurityEventMap[K]>): () => void {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler as Handler<SecurityEvent>);

      return () => {
        set.delete(handler as Handler<SecurityEvent>);
      };
    },

    /** Subscribe to all event types. Returns an unsubscribe function. */
    onAny(handler: Handler<SecurityEvent>): () => void {
      wildcardHandlers.add(handler);
      return () => {
        wildcardHandlers.delete(handler);
      };
    },

    /**
     * Emit an event synchronously. Auto-populates `id` and `timestamp`.
     * Returns the fully constructed event.
     */
    emit<K extends SecurityEventType>(
      payload: Omit<SecurityEventMap[K], "id" | "timestamp"> & { type: K },
    ): SecurityEventMap[K] {
      const event = {
        ...payload,
        id: randomUUID(),
        timestamp: new Date().toISOString(),
      } as unknown as SecurityEventMap[K];

      const typed = handlers.get(payload.type);
      if (typed) {
        for (const handler of typed) {
          handler(event as SecurityEvent);
        }
      }

      for (const handler of wildcardHandlers) {
        handler(event as SecurityEvent);
      }

      return event;
    },

    /** Remove all handlers. */
    clear(): void {
      handlers.clear();
      wildcardHandlers.clear();
    },

    /** Returns the count of listeners for a specific type (excludes wildcards). */
    listenerCount(type: SecurityEventType): number {
      return handlers.get(type)?.size ?? 0;
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;

/** Singleton event bus instance. */
export const eventBus = createEventBus();
