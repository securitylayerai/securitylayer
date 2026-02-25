import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { i18n } from "@/lib/i18n";

export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params, location }) => {
    if (!(i18n.languages as string[]).includes(params.lang)) {
      // Prepend the default locale to the full path
      // e.g. /docs/getting-started → /en/docs/getting-started
      throw redirect({
        href: `/${i18n.defaultLanguage}${location.pathname}`,
      });
    }
  },
  component: () => <Outlet />,
});
