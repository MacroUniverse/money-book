# Money Book Developer Manual

## Overview
Money Book is a personal financial management app built with React, Node.js, and SQLite. It loads the seed data in `ledger.db.sql` and stores runtime changes in `server/data/ledger.db`.

## Prerequisites
- Node.js 18+ (includes npm)
- Python/Build tools if your OS needs to compile `sqlite3` (Windows users may need “Build Tools for Visual Studio”)

## Install
```bash
npm install
```

## Run in Development
```bash
npm run dev
```

- React dev server: `http://localhost:5173`
- API server: `http://localhost:3001`

The Vite dev server proxies `/api` calls to the Node.js backend.

## Build + Run Production
```bash
npm run build
npm start
```

`npm start` serves the built React app from `client/dist` and runs the API.

## Database Notes
- The SQLite file lives at `server/data/ledger.db`.
- On first run, the backend loads `ledger.db.sql` into the database.
- The app does **not** change schema; it only inserts records.
- To reset the database to the seed data, delete `server/data/ledger.db` and restart the server.

## Undo Support
The backend keeps a small undo stack (last 50 changes). Call:

```bash
POST /api/undo
```

This reverts the last insert (or metadata change) performed via the API.

## Environment Variables
- `PORT`: API server port (default 3001)
- `VITE_API_BASE`: optional API base URL for the React app

## API Quick Reference
- `GET /api/metadata`
- `GET /api/records?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/records`
- `POST /api/undo`
- `GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/accounts`
- `POST /api/tags`
- `POST /api/target-tags`
- `POST /api/targets`

## Contributing
- Keep edits focused in `client/` or `server/` workspaces.
- Run `npm run build` before opening a PR to ensure the UI still bundles.
