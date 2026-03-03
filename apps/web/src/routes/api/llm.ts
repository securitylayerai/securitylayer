import { docs } from "fumadocs-mdx:collections/server";
import { createFileRoute } from "@tanstack/react-router";

function stripMarkdown(md: string): string {
  return (
    md
      // frontmatter
      .replace(/^---[\s\S]*?---\n*/m, "")
      // import/export statements
      .replace(/^(import|export)\s.*$/gm, "")
      // JSX/HTML tags
      .replace(/<[^>]+>/g, "")
      // headings → plain text
      .replace(/^#{1,6}\s+/gm, "")
      // images
      .replace(/!\[.*?\]\(.*?\)/g, "")
      // links → text only
      .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
      // bold/italic
      .replace(/(\*{1,3}|_{1,3})([^*_]+)\1/g, "$2")
      // inline code
      .replace(/`([^`]+)`/g, "$1")
      // fenced code blocks → content only
      .replace(/```[\s\S]*?\n([\s\S]*?)```/g, "$1")
      // blockquotes
      .replace(/^>\s?/gm, "")
      // horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // unordered list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // ordered list markers
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // collapse 3+ newlines into 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export const Route = createFileRoute("/api/llm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        const format = url.searchParams.get("format") ?? "md";

        if (!path) {
          return new Response("Missing path parameter", { status: 400 });
        }

        const page = docs.docs.find((doc) => doc.info.path === path);
        if (!page) {
          return new Response("Page not found", { status: 404 });
        }

        const raw = await page.getText("processed");
        const text = format === "txt" ? stripMarkdown(raw) : raw;

        return new Response(text, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
