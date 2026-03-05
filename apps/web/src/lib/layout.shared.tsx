import { XLogo } from "@phosphor-icons/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n: true,
    nav: {
      title: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 20 }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            style={{ borderRadius: 2 }}
          >
            <rect width="48" height="48" fill="currentColor" />
            <path
              d="M28 8H36V16H28V8ZM20 8H28V16H20V8ZM12 16H20V24H12V16ZM28 24H36V32H28V24ZM28 32H36V40H28V32ZM12 32H20V40H12V32ZM12 8H20V16H12V8ZM20 32H28V40H20V32Z"
              className="fill-white dark:fill-black"
            />
          </svg>
          Security Layer
        </span>
      ),
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
