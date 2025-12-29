# Running Backend on Port 4001

To run the backend on port 4001 instead of 4000, follow these steps:

## Option 1: Using Docker Compose (Recommended)

1. **Update your `.env` file** (or create it if it doesn't exist):
   ```env
   BACKEND_PORT=4001
   VITE_API_BASE=http://localhost:4001
   ```

2. **Start the services**:
   ```bash
   docker compose up
   ```

   The backend will be accessible on `http://localhost:4001`

## Option 2: Running Without Docker

1. **Set the backend port** when starting the server:
   ```bash
   PORT=4001 node server.cjs
   ```

2. **Create/update `.env.local` file** (for Vite to pick up):
   ```env
   VITE_API_BASE=http://localhost:4001
   ```

3. **Restart your frontend dev server** to pick up the new environment variable:
   ```bash
   npm run dev
   ```

## Important Notes:

- The frontend uses `VITE_API_BASE` environment variable (defaults to `http://localhost:4001`)
- Environment variables starting with `VITE_` are exposed to the frontend code
- If you change `VITE_API_BASE`, you **must restart** the Vite dev server for changes to take effect
- The `.env.local` file is automatically loaded by Vite and takes precedence over `.env`

## Verify Configuration:

After starting, check:
1. Backend is running: `curl http://localhost:4001/auth/login` (should return JSON)
2. Frontend connects: Open browser console and check network requests go to `http://localhost:4001`

