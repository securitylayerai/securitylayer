import type { TaintLevel } from "./index.js";

export interface TaintOrigin {
  channel?: string;
  sender?: string;
  url?: string;
  skill?: string;
  sessionId?: string;
  timestamp?: string;
}

export interface TaintedData {
  content: string;
  taint: TaintLevel;
  origin: TaintOrigin;
}
