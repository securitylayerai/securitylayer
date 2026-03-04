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
import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import Link from "fumadocs-core/link";
import { Card } from "fumadocs-ui/components/card";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/notebook/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Suspense } from "react";
import { CopyButton, ViewOptions } from "@/components/page-actions";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

function useLocalizedHref(href?: string) {
  const { lang } = useParams({ strict: false }) as { lang?: string };
  if (!href || !lang || !href.startsWith("/docs")) return href;
  return `/${lang}${href}`;
}

function LocaleLink(props: React.ComponentProps<typeof Link>) {
  return <Link {...props} href={useLocalizedHref(props.href)} />;
}

function LocaleCard(props: React.ComponentProps<typeof Card>) {
  return <Card {...props} href={useLocalizedHref(props.href)} />;
}

export const Route = createFileRoute("/$lang/docs/$")({
  component: Page,
  beforeLoad: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const pageData = await serverLoader({
      data: { slugs, lang: params.lang },
    });
    return { pageData };
  },
  head: ({ match }) => {
    const { pageData } = match.context as {
      pageData?: {
        title: string;
        description: string | undefined;
      };
    };
    if (!pageData) return {};
    const title = pageData.title;
    const description =
      pageData.description ?? "Security Layer documentation";
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const ogUrl = `${baseUrl}/api/og?page=Docs&title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}`;

    return {
      meta: [
        { title: `${title} — Security Layer` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: ogUrl },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogUrl },
      ],
    };
  },
  loader: async ({ context }) => {
    const { pageData } = context as { pageData: ServerLoaderResult };
    await clientLoader.preload(pageData.path);
    return pageData;
  },
});

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((input: { slugs: string[]; lang: string }) => input)
  .handler(async ({ data: { slugs, lang } }) => {
    const page = source.getPage(slugs, lang);
    if (!page) throw notFound();

    return {
      path: page.path,
      lang,
      title: page.data.title,
      description: page.data.description as string | undefined,
      pageTree: await source.serializePageTree(source.getPageTree(lang)),
    };
  });

type ServerLoaderResult = Awaited<ReturnType<typeof serverLoader>>;

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
              a: LocaleLink,
              Card: LocaleCard,
              Tabs,
              Tab,
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
  const { lang } = Route.useParams();
  const markdownUrl = `/api/llm?path=${encodeURIComponent(data.path)}`;

  return (
    <DocsLayout {...baseOptions(lang)} tree={data.pageTree}>
      <Suspense>
        {clientLoader.useContent(data.path, {
          className: "",
          markdownUrl,
        })}
      </Suspense>
    </DocsLayout>
  );
}
