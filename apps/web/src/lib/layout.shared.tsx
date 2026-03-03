import { XLogo } from "@phosphor-icons/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n: true,
    nav: {
      title: "Security Layer",
      mode: "top",
    },
    githubUrl: "https://github.com/securitylayerai/securitylayer",
    links: [
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
