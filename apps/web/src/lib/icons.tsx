import {
  ArrowsClockwise,
  BookOpen,
  Brain,
  Code,
  Fingerprint,
  Folder,
  Gear,
  Key,
  Lightning,
  ListChecks,
  Lock,
  Plug,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkle,
  Stack,
  Terminal,
  TreeStructure,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  ArrowsClockwise: <ArrowsClockwise weight="duotone" />,
  BookOpen: <BookOpen weight="duotone" />,
  Brain: <Brain weight="duotone" />,
  Code: <Code weight="duotone" />,
  Fingerprint: <Fingerprint weight="duotone" />,
  Folder: <Folder weight="duotone" />,
  Gear: <Gear weight="duotone" />,
  Key: <Key weight="duotone" />,
  Lightning: <Lightning weight="duotone" />,
  ListChecks: <ListChecks weight="duotone" />,
  Lock: <Lock weight="duotone" />,
  Plug: <Plug weight="duotone" />,
  Rocket: <Rocket weight="duotone" />,
  Shield: <Shield weight="duotone" />,
  ShieldCheck: <ShieldCheck weight="duotone" />,
  Sparkle: <Sparkle weight="duotone" />,
  Stack: <Stack weight="duotone" />,
  Terminal: <Terminal weight="duotone" />,
  TreeStructure: <TreeStructure weight="duotone" />,
};

export function resolveIcon(icon: string | undefined): ReactNode {
  if (!icon) return undefined;
  return icons[icon];
}
