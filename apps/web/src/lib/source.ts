import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import { resolveIcon } from "@/lib/icons";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  icon: resolveIcon,
});
