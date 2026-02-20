export type SandboxLevel = 0 | 1 | 2 | 3;

export interface UlimitConfig {
  /** CPU time in seconds */
  cpu: number;
  /** Memory in bytes */
  mem: number;
  /** Max file size in bytes */
  fileSize: number;
  /** Max open files */
  openFiles: number;
  /** Max processes */
  procs: number;
}

export interface SandboxConfig {
  level: SandboxLevel;
  ulimits: UlimitConfig;
  network: {
    isolated: boolean;
    allowedHosts?: string[];
  };
  filesystem: {
    readOnly?: string[];
    writeable?: string[];
    denied?: string[];
  };
}
