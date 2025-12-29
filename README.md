<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1mqhok1UoY4WBZKJbp-MKJbLz1SgTvlGW

## Run Locally

### Option 1: Using Docker (Recommended)

**Prerequisites:** Docker and Docker Compose

1. Copy the environment file (optional):
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   docker-compose up
   ```

3. Access the application:
   - Frontend: http://localhost:3000 (with hot reload)
   - Backend API: http://localhost:4000 (with auto-reload)

4. **Hot Reload**: Both frontend and backend automatically reload when you make code changes - no need to restart containers!

5. Stop services:
   ```bash
   docker-compose down
   ```

For more details, see [DOCKER.md](DOCKER.md).

### Option 2: Manual Setup

**Prerequisites:** Node.js and PostgreSQL

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up PostgreSQL database:
   - Create a database named `communicatex`
   - Update database credentials in `.env` or environment variables

3. Set environment variables:
   - `DB_HOST` - PostgreSQL host (default: localhost)
   - `DB_PORT` - PostgreSQL port (default: 5432)
   - `DB_NAME` - Database name (default: communicatex)
   - `DB_USER` - Database user (default: postgres)
   - `DB_PASSWORD` - Database password
   - `GEMINI_API_KEY` - Your Gemini API key (optional)

4. Start the backend server:
   ```bash
   npm run proxy
   ```

5. In another terminal, start the frontend:
   ```bash
   npm run dev
   ```
