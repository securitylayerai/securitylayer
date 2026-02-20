import { randomUUID } from "node:crypto";
import type { SecurityEvent, SecurityEventMap, SecurityEventType } from "./types.js";

type Handler<T> = (event: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<SecurityEvent>>>();
  private wildcardHandlers = new Set<Handler<SecurityEvent>>();

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on<K extends SecurityEventType>(type: K, handler: Handler<SecurityEventMap[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<SecurityEvent>);

    return () => {
      set.delete(handler as Handler<SecurityEvent>);
    };
  }

  /** Subscribe to all event types. Returns an unsubscribe function. */
  onAny(handler: Handler<SecurityEvent>): () => void {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

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

    const typed = this.handlers.get(payload.type);
    if (typed) {
      for (const handler of typed) {
        handler(event as SecurityEvent);
      }
    }

    for (const handler of this.wildcardHandlers) {
      handler(event as SecurityEvent);
    }

    return event;
  }

  /** Remove all handlers. */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  /** Returns the count of listeners for a specific type (excludes wildcards). */
  listenerCount(type: SecurityEventType): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}

/** Singleton event bus instance. */
export const eventBus = new EventBus();
