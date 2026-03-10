import { randomUUID } from "node:crypto";

const MAX_HISTORY = 100;

export function createSessionState(sessionId?: string) {
  const id = sessionId ?? randomUUID();
  const history: string[] = [];

  return {
    id,

    addAction(action: string): void {
      if (history.length >= MAX_HISTORY) {
        history.shift();
      }
      history.push(action);
    },

    getHistory(): string[] {
      return [...history];
    },

    clear(): void {
      history.length = 0;
    },
  };
}

export type SessionState = ReturnType<typeof createSessionState>;
