import type { TaintLevel } from "./index";

export interface TaintOrigin {
  channel?: string;
  sender?: string;
  url?: string;
  skill?: string;
  sessionId?: string;
  timestamp: number;
}

export interface TaintedData {
  content: string;
  taint: TaintLevel;
  origin: TaintOrigin;
}
