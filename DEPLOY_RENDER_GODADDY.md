# Deploy to Render + GoDaddy (games.kesineni.in)

This guide is for a production-like test bed using:

- Frontend: Render Static Site
- Backend: Render Web Service (Docker)
- DB: Render Postgres
- Domain: GoDaddy subdomains

## Prerequisites

- GitHub repo with this project pushed
- Render account
- GoDaddy access for `kesineni.in`

## 1. Create services in Render

### Option A (recommended): Blueprint

1. Open Render Dashboard.
2. Choose **New +** -> **Blueprint**.
3. Connect the GitHub repo.
4. Render auto-detects `render.yaml` in repo root.
5. Create blueprint.

This creates:

- `games-backend` (web)
- `games-frontend` (static)
- `games-postgres` (database)

### Option B: Manual

Use the same values from `render.yaml`.

## 2. Wait for first deploy

1. Confirm backend deploy succeeds.
2. Confirm frontend deploy succeeds.
3. Confirm backend health endpoint works:
   - `https://<backend-onrender-domain>/api/health`

## 3. Add custom domains in Render

### Frontend domain

1. Open service: `games-frontend`.
2. Settings -> Custom Domains -> Add Custom Domain.
3. Add `games.kesineni.in`.
4. Copy the DNS target Render shows.

### Backend domain

1. Open service: `games-backend`.
2. Settings -> Custom Domains -> Add Custom Domain.
3. Add `api.games.kesineni.in`.
4. Copy the DNS target Render shows.

## 4. Configure DNS in GoDaddy

1. Go to DNS management for `kesineni.in`.
2. Add/Update CNAME:
   - Host: `games`
   - Value: Render target from `games-frontend`
3. Add/Update CNAME:
   - Host: `api.games`
   - Value: Render target from `games-backend`
4. Save.

## 5. Verify SSL and routing

1. Wait until Render marks both custom domains as verified/issued SSL.
2. Open:
   - `https://games.kesineni.in`
   - `https://api.games.kesineni.in/api/health`

## 6. Runtime validation checklist

1. Create room in UI.
2. Join room from second browser/device.
3. Verify websocket events work.
4. Verify no CORS errors in browser console.

## 7. Free tier notes

- Free services may sleep after inactivity.
- First request after idle can be slow.
- For stable multiplayer sessions, upgrade backend to paid always-on.

## 8. Environment variables summary

### Backend

- `NODE_ENV=production`
- `PORT=10000`
- `FRONTEND_ORIGIN=https://games.kesineni.in`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (from Render DB)

### Frontend

- `VITE_API_BASE_URL=https://api.games.kesineni.in/api`
