import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuthSuspense } from "@/lib/auth/hooks";

export const Route = createFileRoute("/$lang/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 p-2">
      <div className="flex flex-col items-center gap-4">
        <h1 className="font-bold text-3xl sm:text-4xl">Security Layer</h1>
        <div className="flex items-center gap-2 text-foreground/80 text-sm max-sm:flex-col">
          Agent security platform — make dangerous AI actions structurally
          impossible.
        </div>
      </div>

      <Suspense fallback={<div className="py-6">Loading user...</div>}>
        <UserAction />
      </Suspense>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <a
            className="text-foreground/80 underline hover:text-foreground max-sm:text-sm"
            href="https://github.com/securitylayer/securitylayer"
            target="_blank"
            title="Security Layer on GitHub"
            rel="noreferrer noopener"
          >
            securitylayer/securitylayer
          </a>

          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function UserAction() {
  const { user } = useAuthSuspense();

  return user ? (
    <div className="flex flex-col items-center gap-2">
      <p>Welcome back, {user.name}!</p>
      <Button
        render={<Link to="/dashboard" />}
        className="mb-2 w-fit"
        size="lg"
        nativeButton={false}
      >
        Go to Dashboard
      </Button>
      <div className="text-center text-xs sm:text-sm">
        Session user:
        <pre className="max-w-screen overflow-x-auto px-2 text-start">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>

      <SignOutButton />
    </div>
  ) : (
    <div className="flex flex-col items-center gap-2">
      <p>You are not signed in.</p>
      <Button
        render={<Link to="/login" />}
        className="w-fit"
        size="lg"
        nativeButton={false}
      >
        Log in
      </Button>
    </div>
  );
}
