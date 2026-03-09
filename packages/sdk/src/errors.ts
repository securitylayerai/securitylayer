export class SecurityLayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityLayerError";
  }
}

export class ConfigError extends SecurityLayerError {
  configPath?: string;

  constructor(message: string, configPath?: string) {
    super(message);
    this.name = "ConfigError";
    this.configPath = configPath;
  }
}

export class InitializationError extends SecurityLayerError {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "InitializationError";
    this.cause = cause;
  }
}

export class CheckError extends SecurityLayerError {
  tool?: string;

  constructor(message: string, tool?: string) {
    super(message);
    this.name = "CheckError";
    this.tool = tool;
  }
}

export class ApprovalTimeoutError extends SecurityLayerError {
  approvalId: string;

  constructor(approvalId: string) {
    super(`Approval timed out for request ${approvalId}`);
    this.name = "ApprovalTimeoutError";
    this.approvalId = approvalId;
  }
}
