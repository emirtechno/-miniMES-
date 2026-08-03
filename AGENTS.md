# AGENTS.md

## Cursor Cloud specific instructions

This repo is a two-service **Vestel Mini MES** app plus a SQL Server database:

- `frontend/` — React 19 + Vite 8 dev server (port **5173**). Standard scripts in `frontend/package.json` (`npm run dev`, `npm run build`, `npm run lint`).
- `backend/MiniMesApi/` — ASP.NET Core (**.NET 10**) Web API (port **5000**, Swagger at `/swagger`). EF Core + SQL Server.
- SQL Server 2022 runs in a local Docker container named `minimes-mssql` (port **1433**).

The update script only refreshes dependencies (`npm install` + `dotnet restore`). Starting the database and the two services is NOT automated — do it manually per the notes below.

### Start the database (required before the backend)

Docker is installed but not managed by systemd, so the daemon and DB container must be started manually each session (the container's data persists in the VM snapshot):

```bash
sudo dockerd            # run in a background/tmux session; leave it running
sudo docker start minimes-mssql   # container already exists from initial setup
```

If the container is missing (e.g. fresh volume), recreate it:

```bash
sudo docker run -d --name minimes-mssql --restart unless-stopped \
  -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=MesDev!2026Pass" \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

The backend calls `db.Database.EnsureCreated()` on startup, so the `MiniMESDB` schema and seed data are created automatically on first run.

### Run the backend (port 5000)

The default connection string in `appsettings.json` targets Windows LocalDB, which does **not** work on Linux. Override it with an environment variable (do NOT edit the committed config). The SA password contains `!`, so run `set +H` first (or use single quotes) to avoid bash history expansion:

```bash
cd backend/MiniMesApi/MiniMesApi
set +H
export ASPNETCORE_ENVIRONMENT=Development
export ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=MiniMESDB;User Id=sa;Password=MesDev!2026Pass;TrustServerCertificate=True;'
dotnet run --launch-profile http
```

### Run the frontend (port 5173)

```bash
cd frontend && npm run dev
```

`frontend/.env` already sets `VITE_MES_API_URL=http://localhost:5000/api`, matching the backend. Note some OEE/machine-metrics calls in `frontend/src/api.js` are hardcoded to `http://localhost:5000`, so keep the backend on port 5000.

### Dev login / smoke test

Dev users (from `appsettings.Development.json`): `admin/123` (Admin) or `operator/123` (Operator). A quick E2E check: log in at `http://localhost:5173`, then add a production record on the dashboard ("Yeni Üretim Kaydı Gir"): 20-digit product code, 12-char material code, a station, quality `OK`.

### Gotchas

- `.NET` SDK lives at `/usr/local/dotnet` with a symlink at `/usr/local/bin/dotnet`, so `dotnet` works in non-interactive shells.
- `npm run lint` currently reports 2 pre-existing errors (unused `React` imports in `MachineMetricsPanel.jsx` and `OeePanel.jsx`). These are in the repo's own code, not an environment issue.
- There are no automated tests in this repo (no test projects or `test` npm script).
