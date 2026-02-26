import { useLocation, useParams, useRouter } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { i18n } from "@/lib/i18n";

const languages = [
  { code: "en", flag: "🇺🇸", name: "English" },
  { code: "zh", flag: "🇨🇳", name: "中文" },
  { code: "ja", flag: "🇯🇵", name: "日本語" },
  { code: "es", flag: "🇪🇸", name: "Español" },
  { code: "ko", flag: "🇰🇷", name: "한국어" },
  { code: "pt", flag: "🇧🇷", name: "Português" },
  { code: "de", flag: "🇩🇪", name: "Deutsch" },
] as const;

export function LanguagePicker() {
  const [open, setOpen] = useState(false);
  const params = useParams({ strict: false }) as { lang?: string };
  const location = useLocation();
  const router = useRouter();
  const currentLang = params.lang ?? i18n.defaultLanguage;
  const current =
    languages.find((l) => l.code === currentLang) ?? languages[0];

  function switchLanguage(code: string) {
    setOpen(false);
    if (code === currentLang) return;
    const newPath = `/${code}${location.pathname.substring(currentLang.length + 1)}`;
    router.navigate({ to: newPath });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground">
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDownIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[200px] p-1">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => switchLanguage(lang.code)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span className="flex-1 text-left">{lang.name}</span>
            {lang.code === currentLang && (
              <CheckIcon className="size-4 text-fd-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
