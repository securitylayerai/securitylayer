export interface NormalizedExec {
  binary: string;
  args: string[];
  paths: string[];
  chainedCommands: string[];
  pipeDestinations: string[];
  usesIndirection: boolean;
  raw: string;
}
