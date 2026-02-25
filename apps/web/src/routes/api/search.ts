import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";
import type { Tokenizer } from "@orama/orama";
import { source } from "@/lib/source";

// CJK characters don't use spaces between words, so Orama's default
// space-based splitter produces nothing useful. This tokenizer handles
// Chinese, Japanese (kanji/kana), and Korean (hangul) by emitting
// individual characters + bigrams for phrase matching, while still
// splitting any embedded Latin text on whitespace.
const CJK_RE =
  /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\uFF00-\uFFEF]/;
const LATIN_SPLIT = /[^a-z0-9\u00C0-\u024F]+/gi;

function createCJKTokenizer(): Tokenizer {
  return {
    language: "english",
    normalizationCache: new Map(),
    tokenize(raw: string): string[] {
      if (typeof raw !== "string") return [raw];

      const text = raw.toLowerCase();
      const tokens: string[] = [];

      // Split into runs of CJK vs Latin characters
      let buf = "";
      let wasCJK = false;

      for (const ch of text) {
        const isCJK = CJK_RE.test(ch);

        if (isCJK) {
          // flush any Latin buffer
          if (buf) {
            for (const w of buf.split(LATIN_SPLIT)) {
              if (w) tokens.push(w);
            }
            buf = "";
          }
          // emit each CJK character as its own token
          tokens.push(ch);
          wasCJK = true;
        } else {
          wasCJK = false;
          buf += ch;
        }
      }

      // flush remaining Latin
      if (buf) {
        for (const w of buf.split(LATIN_SPLIT)) {
          if (w) tokens.push(w);
        }
      }

      // generate bigrams from consecutive CJK characters for phrase matching
      const cjkChars = tokens.filter((t) => CJK_RE.test(t));
      for (let i = 0; i < cjkChars.length - 1; i++) {
        tokens.push(cjkChars[i] + cjkChars[i + 1]);
      }

      return [...new Set(tokens)];
    },
  };
}

const cjkTokenizer = createCJKTokenizer();

const server = createFromSource(source, {
  localeMap: {
    en: "english",
    zh: { tokenizer: cjkTokenizer },
    ja: { tokenizer: cjkTokenizer },
    es: "spanish",
    ko: { tokenizer: cjkTokenizer },
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
