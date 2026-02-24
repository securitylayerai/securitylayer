import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

const server = createFromSource(source, {
  localeMap: {
    en: "english",
    zh: "english",
    ja: "english",
    es: "spanish",
    ko: "english",
    pt: "portuguese",
    de: "german",
  },
});

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => server.GET(request),
    },
  },
});
