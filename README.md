# Online Bingo Starter

This workspace is a Docker-ready starter for an online bingo game.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: NestJS + TypeORM
- Database: PostgreSQL
- Orchestration: Docker Compose

## Run with Docker

```bash
docker compose up --build
```

## Docker hot reload

Use the dedicated dev compose stack when you want save-to-refresh behavior in Docker:

```bash
npm run docker:dev:up
```

This starts in detached mode so containers keep running even if you close the terminal.

View live logs:

```bash
npm run docker:dev:logs
```

Dev stack URLs:

- Frontend (HMR): http://localhost:5173
- Backend API (watch): http://localhost:3001/api
- Postgres: localhost:5433
- DB GUI (Adminer): http://localhost:8082

Stop dev stack:

```bash
npm run docker:dev:down
```

Services:

- Frontend: http://localhost:8080
- Backend API: http://localhost:3000/api
- Postgres: localhost:5432
- DB GUI: http://localhost:8081

Adminer login values:

- System: PostgreSQL
- Server: postgres or db
- Username: bingo
- Password: bingo
- Database: bingo

## Local development

Install dependencies in each app if needed:

```bash
cd backend && npm install
cd ../frontend && npm install
```

Install root tooling:

```bash
npm install
```

Run both backend and frontend with active refresh:

```bash
npm run dev
```

If Docker is already running on ports 3000/8080, use conflict-free hot reload:

```bash
npm run dev:hot
```

Hot-reload URLs in this mode:

- Frontend (HMR): http://localhost:5173
- Backend (watch): http://localhost:3001/api

What refreshes automatically on save:

- Backend: NestJS watch mode recompiles and restarts the API
- Frontend: Vite HMR updates the UI in the browser

Note: http://localhost:8080 is the Docker Nginx build output and does not hot reload.

Start the backend:

```bash
cd backend && npm run start:dev
```

Start the frontend:

```bash
cd frontend && npm run dev
```

Copy the example env files when you want local overrides:

- backend/.env.example -> backend/.env
- frontend/.env.example -> frontend/.env

## Starter API

- GET /api
- GET /api/health
- GET /api/rooms
- POST /api/rooms

## Next product steps

- Add authenticated players and host roles
- Move room state to WebSockets for live number calls and daub events
- Persist bingo cards, win validation, and payout rules
