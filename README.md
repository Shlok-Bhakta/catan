# Settlers' Table

An unofficial Catan-style digital table for 3–8 players. The app uses React and Convex. It has private room codes, realtime board updates, server-enforced turns, trades, development cards, the robber, awards, and an original in-app rules guide.

Official Catan play covers 3–6 players. Seven and eight players use this app's larger house board and standard clockwise turns. Five and six players use the current paired-player turn rule. Seven and eight players use the same timing as a house extension.

## Play

Create a room, share its six-character code, wait for at least three players, and start. A seat is tied to a token saved in that browser's local storage. Clearing browser storage loses access to that seat.

## Local development

Run a Convex deployment and set `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` in `.env.local`. Set `VITE_CONVEX_URL` to the backend URL visible in your browser. Then run:

```sh
npm ci
npx convex dev --once
npm run dev
```

## Kiwi deployment

`compose.yaml` creates an isolated Convex instance, its dashboard, and the web app. Convex persists SQLite and files at `/home/shlok/usb1/docker/catan/convex-data` on the hard drive. Copy the repository to kiwi, create `.env` containing `INSTANCE_SECRET` from `openssl rand -hex 32`, and run `docker compose up -d --build`. Generate a Convex admin key with `docker compose exec convex ./generate_admin_key.sh`, then push functions with `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` set. The app is available on the kiwi Tailnet IP at port 38430, Convex at 38431, and the dashboard at 38433.

## Rights

This is an independent fan implementation. It uses original visuals and paraphrased rules; it is not affiliated with CATAN GmbH. The [official rulebooks](https://www.catan.com/understand-catan/game-rules) remain the authority for tabletop play.
