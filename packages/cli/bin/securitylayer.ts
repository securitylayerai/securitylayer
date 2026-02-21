#!/usr/bin/env bun

import { parse } from "@bomb.sh/args";
import { type CliArgs, runMain } from "@/index";

const raw = parse(process.argv.slice(2), {
  boolean: ["help", "version", "post"],
  string: ["tool", "input", "output", "command", "caller", "format", "duration", "session"],
  alias: { h: "help", v: "version" },
});

await runMain({ ...raw, _: raw._.map(String) } as CliArgs);
