export interface UpstreamConfig {
  url: string;
  /** Validation token for gateway authentication */
  token?: string;
  /** Maximum reconnection attempts before giving up (0 = infinite) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff */
  baseDelay?: number;
  /** Maximum delay in ms for backoff */
  maxDelay?: number;
  /** Buffer frames during disconnect (up to 10s) */
  bufferOnDisconnect?: boolean;
}

export interface UpstreamConnection {
  connected: boolean;
  send(data: Buffer): boolean;
  connect(): void;
  disconnect(): void;
  onMessage(handler: (data: Buffer) => void): void;
  onConnect(handler: () => void): void;
  onDisconnect(handler: () => void): void;
}

export function createUpstreamConnection(config: UpstreamConfig): UpstreamConnection {
  let ws: WebSocket | null = null;
  let connected = false;
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let intentionalDisconnect = false;

  const messageHandlers: Array<(data: Buffer) => void> = [];
  const connectHandlers: Array<() => void> = [];
  const disconnectHandlers: Array<() => void> = [];

  // Frame buffer for when upstream is disconnected (max 10s worth)
  const frameBuffer: Buffer[] = [];
  const maxBufferAge = 10_000;
  let bufferStartTime: number | null = null;

  const baseDelay = config.baseDelay ?? 100;
  const maxDelay = config.maxDelay ?? 5_000;
  const maxRetries = config.maxRetries ?? 0;

  function getBackoffDelay(): number {
    const delay = Math.min(baseDelay * 2 ** retryCount, maxDelay);
    // Add jitter (10-30%)
    const jitter = delay * (0.1 + Math.random() * 0.2);
    return delay + jitter;
  }

  function flushBuffer() {
    if (ws && connected) {
      for (const frame of frameBuffer) {
        ws.send(frame);
      }
    }
    frameBuffer.length = 0;
    bufferStartTime = null;
  }

  function attemptConnect() {
    const headers: Record<string, string> = {};
    if (config.token) {
      headers["X-SecurityLayer-Token"] = config.token;
    }

    // Bun's WebSocket supports a `headers` option not in the standard WebSocket API.
    // The double-cast works around the TypeScript type mismatch.
    ws = new WebSocket(config.url, { headers } as unknown as string[]);

    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      connected = true;
      retryCount = 0;
      flushBuffer();
      for (const handler of connectHandlers) handler();
    };

    ws.onmessage = (event) => {
      const data =
        event.data instanceof ArrayBuffer
          ? Buffer.from(event.data)
          : Buffer.from(event.data as string);
      for (const handler of messageHandlers) handler(data);
    };

    ws.onclose = () => {
      connected = false;
      ws = null;
      for (const handler of disconnectHandlers) handler();

      // Attempt reconnection with backoff (unless intentionally disconnected)
      if (!intentionalDisconnect && (maxRetries === 0 || retryCount < maxRetries)) {
        const delay = getBackoffDelay();
        retryCount++;
        retryTimeout = setTimeout(() => attemptConnect(), delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, so reconnection is handled there
    };
  }

  return {
    get connected() {
      return connected;
    },

    send(data: Buffer): boolean {
      if (ws && connected) {
        ws.send(data);
        return true;
      }

      // Buffer if configured and within time limit
      if (config.bufferOnDisconnect !== false) {
        if (bufferStartTime === null) {
          bufferStartTime = Date.now();
        }
        if (Date.now() - bufferStartTime < maxBufferAge) {
          frameBuffer.push(data);
          return false;
        }
      }

      return false;
    },

    connect() {
      intentionalDisconnect = false;
      attemptConnect();
    },

    disconnect() {
      intentionalDisconnect = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      ws?.close();
      ws = null;
      connected = false;
    },

    onMessage(handler: (data: Buffer) => void) {
      messageHandlers.push(handler);
    },

    onConnect(handler: () => void) {
      connectHandlers.push(handler);
    },

    onDisconnect(handler: () => void) {
      disconnectHandlers.push(handler);
    },
  };
}
