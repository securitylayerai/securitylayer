import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "./ui/button";

const LOG_LINES = [
  { tag: "scan", text: "analyzing request path" },
  { tag: "resolve", text: "route resolution", result: "FAILED" },
  { tag: "taint", text: "level → CRITICAL" },
  { tag: "rule", text: "resource_not_found", result: "BLOCKED" },
  { tag: "action", text: "navigate.page", result: "DENIED" },
  { tag: "policy", text: "deny_by_default enforced" },
];

export function DefaultNotFound() {
  const { pathname } = useLocation();

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-4">
      {/* CRT scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        aria-hidden="true"
        style={{
          opacity: 0.015,
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)",
        }}
      />

      <div className="w-full max-w-lg">
        <div className="border border-accent-color/20">
          {/* Header */}
          <div className="border-b border-accent-color/20 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-color">
              securitylayer &mdash; interception
            </span>
          </div>

          {/* 404 */}
          <div
            className="relative flex items-center justify-center overflow-hidden py-8 select-none sm:py-10"
            aria-label="404 Not Found"
          >
            <span className="text-[6rem] font-bold leading-none text-accent-color/5 sm:text-[8rem]">
              404
            </span>
            <span
              className="absolute text-[6rem] font-bold leading-none text-accent-color sm:text-[8rem]"
              style={{ animation: "glitch-404 4s ease-in-out infinite" }}
            >
              404
            </span>
          </div>

          {/* Terminal log */}
          <div className="border-t border-border px-4 py-3 text-[11px] leading-relaxed">
            <div className="pb-1.5 text-muted-foreground">
              <span className="text-accent-color">{">"}</span> intercepting{" "}
              <span className="text-foreground">{pathname}</span>
            </div>

            {LOG_LINES.map((line, i) => (
              <div
                key={i}
                className="flex items-baseline gap-1.5"
                style={{
                  opacity: 0,
                  animation: `reveal-line 0.3s ease-out ${0.3 + i * 0.25}s forwards`,
                }}
              >
                <span className="shrink-0 text-muted-foreground">
                  [{line.tag}]
                </span>
                <span className="text-foreground/80">{line.text}</span>
                {"result" in line && (
                  <span className="ml-auto shrink-0 font-semibold text-accent-color">
                    {line.result}
                  </span>
                )}
              </div>
            ))}

            {/* Blinking cursor */}
            <div
              style={{
                opacity: 0,
                animation: `reveal-line 0.3s ease-out ${0.3 + LOG_LINES.length * 0.25}s forwards`,
              }}
            >
              <span
                className="mt-1 inline-block h-[12px] w-[6px] bg-accent-color"
                style={{ animation: "blink-cursor 1s step-end infinite" }}
              />
            </div>
          </div>

          {/* Verdict */}
          <div
            className="border-t border-border px-4 py-4"
            style={{
              opacity: 0,
              animation: `reveal-line 0.4s ease-out ${0.3 + LOG_LINES.length * 0.25 + 0.4}s forwards`,
            }}
          >
            <p className="mb-3 text-sm text-muted-foreground">
              This route does not exist. The action has been{" "}
              <span className="font-semibold text-accent-color">
                structurally prevented
              </span>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.history.back()}
              >
                <span className="text-accent-color">$</span> go back
              </Button>
              <Button
                render={<Link to="/" />}
                variant="outline"
                size="sm"
                nativeButton={false}
              >
                <span className="text-accent-color">$</span> cd /
              </Button>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p
          className="mt-5 text-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
          style={{
            opacity: 0,
            animation: `reveal-line 0.4s ease-out ${0.3 + LOG_LINES.length * 0.25 + 0.8}s forwards`,
          }}
        >
          Don&apos;t detect bad actions. Make them impossible.
        </p>
      </div>
    </div>
  );
}
