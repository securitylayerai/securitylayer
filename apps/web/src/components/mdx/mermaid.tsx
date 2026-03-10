"use client";

import { use, useEffect, useId, useState } from "react";

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const cached = cache.get(key);
	if (cached) return cached as Promise<T>;
	const promise = fn();
	cache.set(key, promise);
	return promise;
}

function getTheme() {
	return document.documentElement.classList.contains("dark")
		? "dark"
		: ("default" as const);
}

export function Mermaid({ chart }: { chart: string }) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;
	return <MermaidDiagram chart={chart} />;
}

function MermaidDiagram({ chart }: { chart: string }) {
	const id = useId().replace(/:/g, "");
	const theme = getTheme();
	const { default: mermaid } = use(
		cachePromise("mermaid", () => import("mermaid")),
	);

	mermaid.initialize({
		startOnLoad: false,
		securityLevel: "loose",
		fontFamily: "inherit",
		theme: theme === "dark" ? "dark" : "default",
	});

	const { svg } = use(
		cachePromise(`${chart}-${theme}`, () =>
			mermaid.render(`mermaid-${id}`, chart.replaceAll("\\n", "\n")),
		),
	);

	return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
