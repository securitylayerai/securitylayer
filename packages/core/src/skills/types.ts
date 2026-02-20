import type { BaseCapability } from "../capabilities/types";

export interface SkillDeclaration {
  id: string;
  capabilities: BaseCapability[];
  restricted: BaseCapability[];
}

export interface SkillIntegrity {
  hash: string;
  source: {
    registry?: string;
    publisher?: string;
    version?: string;
    installedAt?: string;
  };
  behavioralProfile: {
    toolsUsed: string[];
    pathsAccessed: string[];
    domainsContacted: string[];
  };
}
