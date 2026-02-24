import browserCollections from "fumadocs-mdx:collections/browser";
import {
  ArrowsClockwise,
  BookOpen,
  Brain,
  Code,
  Fingerprint,
  Folder,
  Gear,
  Key,
  Lightning,
  ListChecks,
  Lock,
  Plug,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkle,
  Stack,
  Terminal,
  TreeStructure,
} from "@phosphor-icons/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Suspense } from "react";
import { CopyButton, ViewOptions } from "@/components/page-actions";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      path: page.path,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component(
    { toc, frontmatter, default: MDX },
    props: {
      className?: string;
      markdownUrl: string;
    },
  ) {
    return (
      <DocsPage toc={toc} {...props}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <div className="flex items-center gap-2 not-prose">
          <CopyButton markdownUrl={props.markdownUrl} />
          <ViewOptions markdownUrl={props.markdownUrl} />
        </div>
        <hr className="border-fd-border" />
        <DocsBody>
          <MDX
            components={{
              ...defaultMdxComponents,
              ArrowsClockwise,
              BookOpen,
              Brain,
              Code,
              Fingerprint,
              Folder,
              Gear,
              Key,
              Lightning,
              ListChecks,
              Lock,
              Plug,
              Rocket,
              Shield,
              ShieldCheck,
              Sparkle,
              Stack,
              Terminal,
              TreeStructure,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
});

function Page() {
  const data = useFumadocsLoader(Route.useLoaderData());
  const markdownUrl = `/api/llm?path=${encodeURIComponent(data.path)}`;

  return (
    <DocsLayout {...baseOptions()} tree={data.pageTree}>
      <Suspense>
        {clientLoader.useContent(data.path, {
          className: "",
          markdownUrl,
        })}
      </Suspense>
    </DocsLayout>
  );
}
