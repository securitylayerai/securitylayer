/// <reference types="vite/client" />

import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useParams,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { defineI18nUI } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { Toaster } from "@/components/ui/sonner";
import { type AuthQueryResult, authQueryOptions } from "@/lib/auth/queries";
import { i18n } from "@/lib/i18n";
import appCss from "@/styles.css?url";

const ui = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: "English",
      search: "Search documentation...",
      searchNoResult: "No results found",
      toc: "On this page",
      tocNoHeadings: "No headings",
      lastUpdate: "Last updated on",
      chooseLanguage: "Choose language",
      nextPage: "Next",
      previousPage: "Previous",
      chooseTheme: "Theme",
      editOnGithub: "Edit on GitHub",
    },
    zh: {
      displayName: "中文",
      search: "搜索文档...",
      searchNoResult: "未找到结果",
      toc: "本页目录",
      tocNoHeadings: "无标题",
      lastUpdate: "最后更新于",
      chooseLanguage: "选择语言",
      nextPage: "下一页",
      previousPage: "上一页",
      chooseTheme: "主题",
      editOnGithub: "在 GitHub 上编辑",
    },
    ja: {
      displayName: "日本語",
      search: "ドキュメントを検索...",
      searchNoResult: "結果が見つかりません",
      toc: "目次",
      tocNoHeadings: "見出しなし",
      lastUpdate: "最終更新日",
      chooseLanguage: "言語を選択",
      nextPage: "次へ",
      previousPage: "前へ",
      chooseTheme: "テーマ",
      editOnGithub: "GitHub で編集",
    },
    es: {
      displayName: "Español",
      search: "Buscar documentación...",
      searchNoResult: "No se encontraron resultados",
      toc: "En esta página",
      tocNoHeadings: "Sin encabezados",
      lastUpdate: "Última actualización",
      chooseLanguage: "Elegir idioma",
      nextPage: "Siguiente",
      previousPage: "Anterior",
      chooseTheme: "Tema",
      editOnGithub: "Editar en GitHub",
    },
    ko: {
      displayName: "한국어",
      search: "문서 검색...",
      searchNoResult: "결과 없음",
      toc: "이 페이지에서",
      tocNoHeadings: "제목 없음",
      lastUpdate: "마지막 업데이트",
      chooseLanguage: "언어 선택",
      nextPage: "다음",
      previousPage: "이전",
      chooseTheme: "테마",
      editOnGithub: "GitHub에서 편집",
    },
    pt: {
      displayName: "Português",
      search: "Pesquisar documentação...",
      searchNoResult: "Nenhum resultado encontrado",
      toc: "Nesta página",
      tocNoHeadings: "Sem títulos",
      lastUpdate: "Última atualização em",
      chooseLanguage: "Escolher idioma",
      nextPage: "Próximo",
      previousPage: "Anterior",
      chooseTheme: "Tema",
      editOnGithub: "Editar no GitHub",
    },
    de: {
      displayName: "Deutsch",
      search: "Dokumentation durchsuchen...",
      searchNoResult: "Keine Ergebnisse gefunden",
      toc: "Auf dieser Seite",
      tocNoHeadings: "Keine Überschriften",
      lastUpdate: "Zuletzt aktualisiert am",
      chooseLanguage: "Sprache wählen",
      nextPage: "Weiter",
      previousPage: "Zurück",
      chooseTheme: "Design",
      editOnGithub: "Auf GitHub bearbeiten",
    },
  },
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: AuthQueryResult;
}>()({
  beforeLoad: ({ context }) => {
    // we're using react-query for client-side caching to reduce client-to-server calls, see /src/router.tsx
    // better-auth's cookieCache is also enabled server-side to reduce server-to-db calls, see /src/lib/auth/auth.ts
    context.queryClient.prefetchQuery(authQueryOptions());

    // typically we don't need the user immediately in landing pages,
    // so we're only prefetching here and not awaiting.
    // for protected routes with loader data, see /_auth/route.tsx
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Security Layer",
      },
      {
        name: "description",
        content: "Security Layer - Agent security platform",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { readonly children: React.ReactNode }) {
  const params = useParams({ strict: false }) as { lang?: string };
  const lang = params.lang ?? "en";

  return (
    // suppress since we're updating the "dark" class in RootProvider
    <html lang={lang} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <RootProvider i18n={ui.provider(lang)}>
          {children}
          <Toaster richColors />
        </RootProvider>

        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />

        <Scripts />
      </body>
    </html>
  );
}
