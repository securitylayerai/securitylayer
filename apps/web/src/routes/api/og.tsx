import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse, loadGoogleFont } from "@cf-wasm/og";
import * as z from "zod";

const ogParamsSchema = z.object({
  page: z.string().optional().default(""),
  title: z.string().optional().default("Security Layer"),
  subtitle: z.string().optional().default(""),
});

// Dark mode colors (oklch → hex from styles.css)
const BG = "#0c0c0c";
const WHITE = "#fafafa";
const RED = "#dc3b30";
const MUTED = "#a3a3a3";

const MAX_TITLE_CHARS = 50;
const MAX_SUBTITLE_CHARS = 80;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

// Module-level font cache (persists across requests in same Worker isolate)
let fontRegularData: ArrayBuffer | null = null;
let fontBoldData: ArrayBuffer | null = null;

async function getFonts() {
  const [regular, bold] = await Promise.all([
    fontRegularData ??
      loadGoogleFont("IBM Plex Mono", { weight: 400, subset: "latin" }),
    fontBoldData ??
      loadGoogleFont("IBM Plex Mono", { weight: 700, subset: "latin" }),
  ]);

  fontRegularData = regular;
  fontBoldData = bold;

  return { regular, bold };
}

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const result = ogParamsSchema.safeParse({
          page: url.searchParams.get("page") ?? undefined,
          title: url.searchParams.get("title") ?? undefined,
          subtitle: url.searchParams.get("subtitle") ?? undefined,
        });

        if (!result.success) {
          return new Response("Invalid parameters", { status: 400 });
        }

        const { page, title: rawTitle, subtitle: rawSubtitle } = result.data;
        const title = truncate(rawTitle, MAX_TITLE_CHARS);
        const subtitle = truncate(rawSubtitle, MAX_SUBTITLE_CHARS);
        const fonts = await getFonts();

        return new ImageResponse(
          (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                backgroundColor: BG,
                padding: 60,
                fontFamily: "IBM Plex Mono",
                position: "relative",
              }}
            >
              {/* Top right: Security Layer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  width: "100%",
                }}
              >
                <span style={{ color: WHITE, fontSize: 28, fontWeight: 400 }}>
                  Security Layer
                </span>
              </div>

              {/* Spacer */}
              <div style={{ display: "flex", flex: 1 }} />

              {/* Bottom left: page, title, subtitle */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {page ? (
                  <span
                    style={{
                      color: RED,
                      fontSize: 22,
                      fontWeight: 400,
                      marginBottom: 16,
                    }}
                  >
                    {page}
                  </span>
                ) : null}
                <span
                  style={{
                    color: WHITE,
                    fontSize: 52,
                    fontWeight: 700,
                    lineHeight: 1.1,
                  }}
                >
                  {title}
                </span>
                {subtitle ? (
                  <span
                    style={{
                      color: MUTED,
                      fontSize: 24,
                      fontWeight: 400,
                      marginTop: 16,
                    }}
                  >
                    {subtitle}
                  </span>
                ) : null}
              </div>

              {/* Bottom accent bar */}
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  backgroundColor: RED,
                }}
              />
            </div>
          ),
          {
            width: 1200,
            height: 630,
            fonts: [
              {
                name: "IBM Plex Mono",
                data: fonts.regular,
                style: "normal" as const,
                weight: 400 as const,
              },
              {
                name: "IBM Plex Mono",
                data: fonts.bold,
                style: "normal" as const,
                weight: 700 as const,
              },
            ],
            headers: {
              "Cache-Control": "public, max-age=604800, s-maxage=2592000",
              "CDN-Cache-Control": "public, max-age=2592000",
            },
          },
        );
      },
    },
  },
});
