import {
  ArrowsClockwise,
  BookOpen,
  Brain,
  Code,
  Cube,
  Fingerprint,
  Folder,
  Gear,
  GitBranch,
  Globe,
  Key,
  Lightning,
  ListChecks,
  Lock,
  Package,
  Plug,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkle,
  Stack,
  Terminal,
  TreeStructure,
  Wrench,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  ArrowsClockwise: <ArrowsClockwise weight="duotone" />,
  BookOpen: <BookOpen weight="duotone" />,
  Brain: <Brain weight="duotone" />,
  Code: <Code weight="duotone" />,
  Cube: <Cube weight="duotone" />,
  Fingerprint: <Fingerprint weight="duotone" />,
  Folder: <Folder weight="duotone" />,
  Gear: <Gear weight="duotone" />,
  GitBranch: <GitBranch weight="duotone" />,
  Globe: <Globe weight="duotone" />,
  Key: <Key weight="duotone" />,
  Lightning: <Lightning weight="duotone" />,
  ListChecks: <ListChecks weight="duotone" />,
  Lock: <Lock weight="duotone" />,
  Package: <Package weight="duotone" />,
  Plug: <Plug weight="duotone" />,
  Rocket: <Rocket weight="duotone" />,
  Shield: <Shield weight="duotone" />,
  ShieldCheck: <ShieldCheck weight="duotone" />,
  Sparkle: <Sparkle weight="duotone" />,
  Stack: <Stack weight="duotone" />,
  Terminal: <Terminal weight="duotone" />,
  TreeStructure: <TreeStructure weight="duotone" />,
  Wrench: <Wrench weight="duotone" />,
};

export function resolveIcon(icon: string | undefined): ReactNode {
  if (!icon) return undefined;
  return icons[icon];
}
