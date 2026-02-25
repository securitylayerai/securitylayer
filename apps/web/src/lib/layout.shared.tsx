import { BookOpen } from "@phosphor-icons/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    nav: {
      title: "SecurityLayer",
    },
    links: [
      {
        icon: <BookOpen weight="duotone" />,
        text: "Documentation",
        url: `/${locale}/docs`,
        active: "nested-url",
      },
    ],
  };
}
