import { BookOpen } from "@phosphor-icons/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n: true,
    nav: {
      title: "Security Layer",
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
