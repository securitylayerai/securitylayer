# @securitylayer/web

The web application for Security Layer — handles the landing page, dashboard, documentation, authentication, and API.

## Tech Stack

- **Framework** — [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, SSR)
- **Server** — [Nitro](https://nitro.build/)
- **Database** — PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Auth** — [BetterAuth](https://www.better-auth.com/) (email/password + OAuth2)
- **Docs** — [Fumadocs](https://fumadocs.dev/) (MDX, served at `/docs`)
- **Styling** — [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Build** — [Vite](https://vite.dev/)

## Getting Started

### 1. Setup the database

Start PostgreSQL via Docker:

```bash
docker-compose up -d
```

This creates a `securitylayer_dev` database at `localhost:5432`.

### 2. Configure environment

```bash
cp .env.example .env
```

Generate an auth secret:

```bash
bun run auth:secret
```

Copy the output into `BETTER_AUTH_SECRET` in your `.env` file.

### 3. Create and migrate the database

```bash
bun run db:create
bun run db:migrate
```

### 4. Seed test data (optional)

```bash
bun run db:seed
```

Test credentials:

| Email | Password |
|---|---|
| `admin@securitylayer.ai` | `password123` |
| `user@securitylayer.ai` | `password123` |

### 5. Start the dev server

```bash
bun run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  routes/
    __root.tsx              # Root layout
    index.tsx               # Landing page
    _guest/                 # Guest-only routes (login, signup)
    _auth/                  # Protected routes (dashboard)
    docs/$.tsx              # Documentation (Fumadocs)
    api/auth/$.ts           # Auth API (BetterAuth)
    api/search.ts           # Docs search API
  components/
    ui/                     # shadcn/ui components
    theme-toggle.tsx        # Dark/light mode toggle
    sign-in-social-button.tsx
    sign-out-button.tsx
  lib/
    auth/                   # Auth config, client, hooks, middleware
    db/                     # Database client, schema, migrations, seeds
    source.ts               # Fumadocs source loader
    layout.shared.tsx       # Fumadocs shared layout options
  env/
    server.ts               # Server env validation (Zod)
    client.ts               # Client env validation
content/
  docs/                     # MDX documentation pages
drizzle/                    # Generated migrations
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server on port 3000 |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `bun run start` | Start production server |
| `bun run check` | Run Biome, ESLint, and TypeScript checks |
| `bun run db:create` | Create the database |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed database with test data |
| `bun run ui` | Add shadcn/ui components |
| `bun run auth:secret` | Generate a BetterAuth secret |
| `bun run auth:generate` | Generate auth schema from config |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_BASE_URL` | Yes | App base URL (default: `http://localhost:3000`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Secret for session signing |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

OAuth callback URL format: `http://localhost:3000/api/auth/callback/<provider>`

## Documentation

Documentation pages live in `content/docs/` as MDX files and are served at `/docs`. Powered by Fumadocs with full-text search via Orama.

To add a new doc page, create an MDX file in `content/docs/`:

```mdx
---
title: My Page
description: A description of the page.
---

Your content here.
```
