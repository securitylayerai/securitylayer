import { XLogo } from "@phosphor-icons/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { DocsSearchToggle } from "@/components/docs-search-toggle";

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n: true,
    nav: {
      title: "Security Layer",
    },
    githubUrl: "https://github.com/securitylayerai/securitylayer",
    links: [
      {
        type: "custom",
        on: "nav",
        children: <div className="w-[240px]"><DocsSearchToggle /></div>,
      },
      {
        type: "icon",
        label: "Twitter",
        icon: <XLogo weight="duotone" />,
        text: "Twitter",
        url: "https://x.com/securitylayerai",
      },
    ],
  };
}
