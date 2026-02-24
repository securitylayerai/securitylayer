import { BookOpen } from "@phosphor-icons/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "SecurityLayer",
    },
    links: [
      {
        icon: <BookOpen weight="duotone" />,
        text: "Documentation",
        url: "/docs",
        active: "nested-url",
      },
    ],
  };
}
