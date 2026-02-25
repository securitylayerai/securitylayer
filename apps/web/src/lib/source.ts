import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import { resolveIcon } from "@/lib/icons";
import { i18n } from "@/lib/i18n";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  icon: resolveIcon,
  i18n,
  url: (slugs, locale) => `/${locale}/docs/${slugs.join("/")}`,
});
