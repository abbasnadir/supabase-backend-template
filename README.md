# supabase-backend-template

A starter for full-stack apps that use Supabase for the database and auth. It has an Express + TypeScript API that checks Supabase access tokens, a Next.js client with the Supabase browser client set up, and a `design/` folder for writing down the data model and API before building. Abbas Nadir uses it as the starting point for his own projects.

## Demo

Real requests against the API (built with `pnpm build` and run with `pnpm start`), with a local Supabase stack (`npx supabase start`) standing in for a hosted project. `$API` is the Express server and `$SUPABASE_URL` / `$ANON_KEY` are the local Supabase values. The user is a throwaway demo account.

```text
$ curl -s -w "\nHTTP %{http_code}\n" $API/
{"message":"Works!"}
HTTP 200

$ curl -s -w "\nHTTP %{http_code}\n" $API/me
{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}
HTTP 401

$ TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"email\":\"demo@example.com\",\"password\":\"demo-password\"}" | jq -r .access_token)

$ echo "${TOKEN:0:20}..."
eyJhbGciOiJFUzI1NiIs...

$ curl -s -w "\nHTTP %{http_code}\n" $API/me -H "Authorization: Bearer $TOKEN"
{"id":"33533163-cefd-4710-9518-596a717add95","email":"demo@example.com","role":"authenticated"}
HTTP 200

$ curl -s -w "\nHTTP %{http_code}\n" "$SUPABASE_URL/rest/v1/profiles?select=id,username,created_at" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN"
[{"id":"33533163-cefd-4710-9518-596a717add95","username":null,"created_at":"2026-11-20T16:17:18.779595+00:00"}]
HTTP 200

$ curl -s -w "\nHTTP %{http_code}\n" "$SUPABASE_URL/rest/v1/profiles?select=id,username,created_at" -H "apikey: $ANON_KEY"
[]
HTTP 200

$ curl -s -w "\nHTTP %{http_code}\n" $API/me -H "Authorization: Bearer not-a-real-token"
{"error":{"code":"UNAUTHORIZED","message":"Invalid or expired token"}}
HTTP 401

$ curl -s -w "\nHTTP %{http_code}\n" $API/does-not-exist
{"error":{"code":"NOT_FOUND","message":"Not found"}}
HTTP 404

$ for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code} " $API/; done; echo
200 200 200 200 200 200 200 200 200 429 429

$ curl -s -i $API/ | grep -iE "^(HTTP|retry-after|\{)"
HTTP/1.1 429 Too Many Requests
Retry-After: 60
{"error":{"code":"RATE_LIMITED","message":"Too many requests, slow down"}}
```

The signup trigger in `supabase/migrations/` created the `profiles` row, and row-level security returns it only to its owner: the request with only the anon key gets an empty list. `/` uses the `strict` rate limit policy (10 requests a minute). The first request in the transcript counts towards it, which is why the loop gets nine `200`s before the `429`s.

## What you get

**Server (`server/`)**: Express 4, TypeScript, run with `tsx` and `nodemon` in development. `pnpm build` compiles into `server/dist/` and `pnpm start` runs `dist/src/server.js`.

- **File-based routes.** `src/lib/routeHandler.ts` reads every `.ts` or `.js` file in `src/routes/` (skipping `.d.ts` declaration files) at startup and registers what it exports. A route file exports a `RouterObject` (`types/router.ts`): a base `path` and a list of handlers, each with a method, optional sub-path (`props`), auth mode, rate limit policy and rate limit key.
- **Supabase auth.** `src/lib/verifyJwt.ts` checks the `Authorization: Bearer` token against your project's JWKS (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) with `jose`, so the server never needs the JWT secret. `src/lib/auth.ts` turns the route's `authorization` setting into middleware: `required` rejects missing or bad tokens, `optional` attaches the user when the token is valid, `none` skips the check. The user is available as `req.user` (`id`, `email`, `role`).
- **Rate limiting.** `src/lib/rateLimiter.ts` has named policies (`strict` 10/min, `gameplay` 60/min, `read` 300/min) and can key on the IP, the user id, or the user id with an IP fallback. A blocked request gets a `429` with `{ "error": { "code": "RATE_LIMITED", "message" } }`.
- **Errors.** Throw `BadRequestError`, `UnauthorizedError`, `ForbiddenError` or `NotFoundError` (`src/errors/`) from a handler. `tryCatch` forwards async errors, and `src/middlewares/errorHandler.ts` returns `{ "error": { "code", "message" } }`. Unknown errors are logged and returned as a generic 500 so internals don't leak; in development the handled errors are logged with their stack too.
- **Env checks.** `src/lib/env.ts` stops the server at startup if a required variable is missing (`PROD_URL` is only required when `NODE_ENV=production`).
- **CORS** allows `http://localhost:3000` in development and `PROD_URL` in production, with credentials.
- `src/lib/supabaseClient.ts` exports a service-role Supabase client for database work.

**Client (`client/`)**: Next.js 16 with React 19 and Tailwind CSS 4. `lib/supabaseClient.ts` creates the browser client and `lib/env.ts` checks the public env vars. The home page has an email and password form for logging in and signing up; once signed in it shows the user's `profiles` row and the current session. A Google sign-in button appears only when `NEXT_PUBLIC_GOOGLE_AUTH=true`, because it needs the Google provider set up in Supabase. `/logout` signs out and redirects home.

**Database (`supabase/`)**: the Supabase CLI config (`config.toml`) and one migration that creates the `profiles` table from `design/dbDesign.md`. Each row is linked to an `auth.users` row, row-level security lets users read and update only their own row, and a trigger creates the row when someone signs up. `npx supabase start` applies it.

**Design notes (`design/`)**: a place to plan before coding. It holds an OpenAPI sketch for `/me` (`api-design.yml`), a database diagram (`dbDesign.md`, a `profiles` table linked to `auth.users`) and empty features, constraints and user-flow files to fill in.

The intended hosting is Vercel for the client and Render for the server. The repo has no deployment config.

## Start a new project from the template

1. Click **Use this template** on GitHub (the repo is marked as a template), or clone it and start a fresh history.
2. Fill in `design/` for your app: features, constraints, the data model and the API.
3. Create a Supabase project. For local development, the Supabase CLI runs one in Docker from the repo root, using `supabase/config.toml` and applying the migrations in `supabase/migrations/`:

   ```bash
   npx supabase start
   npx supabase status -o env   # prints API_URL, ANON_KEY and SERVICE_ROLE_KEY
   ```

   For a hosted project, apply the migrations with `npx supabase link` and `npx supabase db push`, or paste them into the SQL editor. Add your own tables as new files in `supabase/migrations/`.
4. Copy `server/.mockenv` to `server/.env` and `client/.mockenv` to `client/.env.local`, and fill them in.
5. Rename things for your app: the page title and description in `client/app/layout.tsx`, `project_id` in `supabase/config.toml`, and the `gameplay` rate limit policy, which is named for a game. Keep `types/router.ts` in sync if you rename or add policies.
6. Add routes. Create a file in `server/src/routes/`, for example `hello.ts`:

   ```ts
   import type { Request, Response } from "express";
   import type { RouterObject } from "../../types/router.js";

   const helloRouter: RouterObject = {
     path: "/hello",
     functions: [
       {
         method: "get",
         props: "/:name",
         authorization: "optional",
         rateLimit: "read",
         keyType: "default",
         handler: (req: Request, res: Response) => {
           res.json({ hello: req.params.name, signedIn: Boolean(req.user) });
         },
       },
     ],
   };

   export default helloRouter;
   ```

   Restart the dev server and it is live, with no other wiring:

   ```text
   $ curl -s -w '\nHTTP %{http_code}\n' http://localhost:4243/hello/abbas
   {"hello":"abbas","signedIn":false}
   HTTP 200
   ```

   (Tested in a scratch copy on port 4243; the file is not part of the template.)

## Run it locally

Needs Node, pnpm and Docker (for local Supabase). These are the steps used to record the demo above.

```bash
# Supabase (from the repo root; applies supabase/migrations)
npx supabase start

# API
cd server
pnpm install
cp .mockenv .env        # then fill in the values below
pnpm dev                # http://localhost:5000 unless PORT is set
# or: pnpm build && pnpm start   (compiles to dist/ and runs dist/src/server.js)

# Client
cd ../client
pnpm install
cp .mockenv .env.local  # then fill in the values below
pnpm dev                # http://localhost:3000
```

With newer pnpm versions the install may end with `ERR_PNPM_IGNORED_BUILDS` for `esbuild` (server) or `sharp` / `unrs-resolver` (client). The packages are still installed and both dev servers ran; run `pnpm approve-builds` if you want the build scripts to run.

| Variable | File | Purpose |
| --- | --- | --- |
| `PORT` | `server/.env` | Port for the API. Defaults to 5000. |
| `NODE_ENV` | `server/.env` | `development` or `production`. Controls CORS, error logging and whether `PROD_URL` is required. |
| `PROD_URL` | `server/.env` | Frontend origin allowed by CORS in production. |
| `SUPABASE_URL` | `server/.env` | Supabase project URL. Also used to fetch the JWKS. |
| `SUPABASE_SERVICE_KEY` | `server/.env` | Service role key for the server-side Supabase client. Keep it secret. |
| `NEXT_PUBLIC_SUPABASE_URL` | `client/.env.local` | Supabase project URL for the browser client. |
| `NEXT_PUBLIC_SUPABASE_ANONKEY` | `client/.env.local` | Public anon key for the browser client (note the spelling: `ANONKEY`). |
| `NEXT_PUBLIC_GOOGLE_AUTH` | `client/.env.local` | `true` shows the Google sign-in button. Set it only after enabling the Google provider in Supabase (`[auth.external.google]` in `supabase/config.toml` for local development). |

Email sign-up works locally without extra setup, because `supabase/config.toml` has email confirmations turned off. The client flow (sign up, see the profile row, log out, wrong password, log in) was checked in a browser against the local stack.

There are no tests yet (`server/tests/` is empty); integration tests and Docker are on the list in `TODO.md`.

## Project structure

```text
server/
  src/server.ts            entry point
  src/app.ts               middleware, route registration, 404 and error handler
  src/routes/              one file per route group (index.ts, me.ts)
  src/lib/                 routeHandler, auth, verifyJwt, rateLimiter, env, supabaseClient
  src/errors/              AppError and HTTP error classes
  src/middlewares/         errorHandler
  types/                   RouterObject types, Express request typing
client/
  app/                     Next.js pages (home, logout)
  lib/                     Supabase browser client, env check
supabase/                  CLI config and migrations (profiles table)
design/                    API sketch, database diagram, notes
```

## Credits

Written by Abbas Nadir (commits as `pro0grammer`).
