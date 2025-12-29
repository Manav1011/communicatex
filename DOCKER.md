# Docker Setup Guide

This guide explains how to run CommunicateX using Docker Compose with PostgreSQL. The setup uses volume mounts so code changes automatically reload both the backend and frontend.

## Prerequisites

- Docker and Docker Compose installed on your system
- Basic knowledge of Docker commands

## Quick Start

1. **Copy the environment file** (optional, if you want to customize):
   ```bash
   cp .env.example .env
   ```

2. **Start all services**:
   ```bash
   docker-compose up
   ```

   This will start:
   - PostgreSQL database (port 5432)
   - Backend API server (port 4000) with auto-reload using nodemon
   - Frontend web application (port 3000) with Vite hot module replacement

   **Note:** Run without `-d` flag to see logs in real-time. Code changes will automatically reload!

3. **View logs** (if running in detached mode):
   ```bash
   docker-compose logs -f
   ```

4. **Stop all services**:
   ```bash
   docker-compose down
   ```

5. **Stop and remove volumes** (removes database data):
   ```bash
   docker-compose down -v
   ```

## Environment Variables

You can customize the setup by creating a `.env` file with the following variables:

```env
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=communicatex
DB_USER=postgres
DB_PASSWORD=postgres

# Server Configuration
PORT=4000

# Frontend Configuration
FRONTEND_PORT=3000
VITE_API_BASE=http://localhost:4000

# Optional: Gemini API Key
GEMINI_API_KEY=
```

## Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **PostgreSQL**: localhost:5432

## Database Persistence

The PostgreSQL data is stored in a Docker volume named `postgres_data`. This means your data will persist even if you stop the containers.

To completely remove the database data:
```bash
docker-compose down -v
```

## Hot Reload

Both backend and frontend support hot reload:
- **Backend**: Uses nodemon to automatically restart when `server.cjs` changes
- **Frontend**: Uses Vite's HMR (Hot Module Replacement) for instant updates

No need to rebuild containers - just save your files and changes will be reflected automatically!

## Troubleshooting

### Backend can't connect to database

Make sure PostgreSQL is healthy before the backend starts. The docker-compose.yml includes a healthcheck for this.

### Port already in use

If ports 3000, 4000, or 5432 are already in use, you can change them in the `.env` file or `docker-compose.yml`.

### View backend logs

```bash
docker-compose logs backend
```

### View database logs

```bash
docker-compose logs postgres
```

### Access PostgreSQL directly

```bash
docker-compose exec postgres psql -U postgres -d communicatex
```

