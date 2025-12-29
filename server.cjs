const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
// Use a dedicated port for the proxy so it doesn't conflict with Vite
const PORT = process.env.PORT || 4000;

// --- PostgreSQL setup ---
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'communicatex',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize database tables
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Core users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at BIGINT NOT NULL
      )
    `);

    // Workspaces owned by / shared with users
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at BIGINT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Memberships: which users belong to which workspace and in what role
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        created_at BIGINT NOT NULL,
        UNIQUE(workspace_id, user_id),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Collections per workspace (for future sync of saved requests)
    await client.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at BIGINT NOT NULL,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      )
    `);

    // Environments per workspace
    await client.query(`
      CREATE TABLE IF NOT EXISTS environments (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        variables_json TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      )
    `);

    // Saved requests per workspace + collection
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_requests (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        collection_id INTEGER,
        name VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        url TEXT NOT NULL,
        request_json TEXT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE SET NULL
      )
    `);

    // Invitations: pending workspace invitations
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        inviter_id INTEGER NOT NULL,
        invitee_email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at BIGINT NOT NULL,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY(inviter_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // History: request history per workspace
    await client.query(`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        request_json TEXT NOT NULL,
        response_status INTEGER,
        timestamp BIGINT NOT NULL,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // User preferences: user-specific settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        active_workspace_id INTEGER,
        active_env_id INTEGER,
        default_proxy_mode INTEGER DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(active_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
        FOREIGN KEY(active_env_id) REFERENCES environments(id) ON DELETE SET NULL
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Initialize database on startup
initDB().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Enable CORS for the frontend
app.use(cors());

// Parse JSON bodies (increased limit for large payloads)
app.use(express.json({ limit: '50mb' }));

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Simple request logger for all incoming requests
app.use((req, res, next) => {
  const startedAt = new Date().toISOString();
  console.log('--- Incoming Request ---');
  console.log('Time      :', startedAt);
  console.log('Method    :', req.method);
  console.log('Path      :', req.originalUrl);
  console.log('IP        :', req.ip);
  console.log('Headers   :', JSON.stringify(req.headers, null, 2));
  console.log('Body      :', JSON.stringify(req.body, null, 2));
  console.log('------------------------');
  next();
});

// --- Simple auth API (single-user capable, but table supports many) ---
const toPublicUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
});

app.post('/auth/signup', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const client = await pool.connect();

  try {
    // Check if user exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = bcrypt.hashSync(String(password), 10);
    const createdAt = Date.now();

    const result = await client.query(
      'INSERT INTO users (email, name, password_hash, created_at) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
      [normalizedEmail, String(name).trim(), passwordHash, createdAt]
    );

    return res.json({ user: toPublicUser(result.rows[0]) });
  } catch (err) {
    console.error('PostgreSQL error (signup):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const ok = bcrypt.compareSync(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error('PostgreSQL error (login):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// --- Workspace & invitation API ---

// Create a workspace for a user
app.post('/workspaces', async (req, res) => {
  const { userId, name } = req.body || {};
  if (!userId || !name) {
    return res.status(400).json({ error: 'userId and name are required' });
  }

  const createdAt = Date.now();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const workspaceResult = await client.query(
      'INSERT INTO workspaces (owner_id, name, created_at) VALUES ($1, $2, $3) RETURNING id',
      [userId, String(name).trim(), createdAt]
    );

    const workspaceId = workspaceResult.rows[0].id;

    // Owner is also a member with role "owner"
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id, user_id) DO NOTHING',
      [workspaceId, userId, 'owner', createdAt]
    );

    await client.query('COMMIT');

    res.json({
      workspace: {
        id: workspaceId,
        ownerId: userId,
        name: String(name).trim(),
        createdAt,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL error (create workspace):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// List workspaces a user belongs to
app.get('/workspaces', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const client = await pool.connect();

  try {
    const sql = `
      SELECT w.id, w.name, w.owner_id as "ownerId", w.created_at as "createdAt", m.role
      FROM workspace_members m
      JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = $1
      ORDER BY w.created_at ASC
    `;

    const result = await client.query(sql, [userId]);
    res.json({ workspaces: result.rows || [] });
  } catch (err) {
    console.error('PostgreSQL error (list workspaces):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Delete a workspace (only owner can delete)
app.delete('/workspaces/:id', async (req, res) => {
  const workspaceId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const client = await pool.connect();

  try {
    // Check if user is the owner
    const workspaceResult = await client.query('SELECT owner_id FROM workspaces WHERE id = $1', [workspaceId]);

    if (workspaceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (workspaceResult.rows[0].owner_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Only the workspace owner can delete it' });
    }

    // Delete workspace (cascade will handle related data due to foreign keys)
    await client.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    res.json({ success: true });
  } catch (err) {
    console.error('PostgreSQL error (delete workspace):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Invite a user (by email) to a workspace - creates an invitation
app.post('/workspaces/:id/invite', async (req, res) => {
  const workspaceId = req.params.id;
  const { email, role = 'member', inviterId } = req.body || {};

  if (!workspaceId || !email || !inviterId) {
    return res.status(400).json({ error: 'workspace id, email, and inviterId are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user exists
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User with that email does not exist yet' });
    }

    const userId = userResult.rows[0].id;

    // Check if user is already a member
    const memberResult = await client.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
    if (memberResult.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this workspace' });
    }

    // Check if invitation already exists
    const invResult = await client.query(
      'SELECT id FROM invitations WHERE workspace_id = $1 AND invitee_email = $2 AND status = $3',
      [workspaceId, normalizedEmail, 'pending']
    );
    if (invResult.rows.length > 0) {
      return res.status(400).json({ error: 'Invitation already sent to this user' });
    }

    // Create invitation
    const createdAt = Date.now();
    const invitationResult = await client.query(
      'INSERT INTO invitations (workspace_id, inviter_id, invitee_email, role, status, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [workspaceId, inviterId, normalizedEmail, String(role), 'pending', createdAt]
    );

    await client.query('COMMIT');

    res.json({
      invitation: {
        id: invitationResult.rows[0].id,
        workspaceId: Number(workspaceId),
        inviteeEmail: normalizedEmail,
        role: String(role),
        status: 'pending',
        createdAt,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL error (invite):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Get pending invitations for a user (by email)
app.get('/invitations', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const client = await pool.connect();

  try {
    const sql = `
      SELECT 
        i.id,
        i.workspace_id as "workspaceId",
        i.inviter_id as "inviterId",
        i.invitee_email as "inviteeEmail",
        i.role,
        i.status,
        i.created_at as "createdAt",
        w.name as "workspaceName",
        u.name as "inviterName",
        u.email as "inviterEmail"
      FROM invitations i
      JOIN workspaces w ON w.id = i.workspace_id
      JOIN users u ON u.id = i.inviter_id
      WHERE i.invitee_email = $1 AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `;

    const result = await client.query(sql, [normalizedEmail]);
    res.json({ invitations: result.rows || [] });
  } catch (err) {
    console.error('PostgreSQL error (list invitations):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Accept an invitation
app.post('/invitations/:id/accept', async (req, res) => {
  const invitationId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get invitation details
    const invResult = await client.query(
      'SELECT workspace_id, invitee_email, role FROM invitations WHERE id = $1 AND status = $2',
      [invitationId, 'pending']
    );

    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already processed' });
    }

    const invitation = invResult.rows[0];

    // Verify the user email matches
    const userResult = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].email.toLowerCase() !== invitation.invitee_email.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }

    // Add user to workspace
    const createdAt = Date.now();
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id, user_id) DO NOTHING',
      [invitation.workspace_id, userId, invitation.role, createdAt]
    );

    // Mark invitation as accepted
    await client.query('UPDATE invitations SET status = $1 WHERE id = $2', ['accepted', invitationId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      workspaceId: invitation.workspace_id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL error (accept invitation):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Decline an invitation
app.post('/invitations/:id/decline', async (req, res) => {
  const invitationId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const client = await pool.connect();

  try {
    // Verify invitation belongs to user
    const invResult = await client.query(
      'SELECT invitee_email FROM invitations WHERE id = $1 AND status = $2',
      [invitationId, 'pending']
    );

    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already processed' });
    }

    const userResult = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].email.toLowerCase() !== invResult.rows[0].invitee_email.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }

    // Mark invitation as declined
    await client.query('UPDATE invitations SET status = $1 WHERE id = $2', ['declined', invitationId]);

    res.json({ success: true });
  } catch (err) {
    console.error('PostgreSQL error (decline invitation):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ========== COLLECTIONS ENDPOINTS ==========
// Get collections for a workspace
app.get('/workspaces/:workspaceId/collections', async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, workspace_id as "workspaceId", name, created_at as "createdAt" FROM collections WHERE workspace_id = $1 ORDER BY created_at ASC',
      [workspaceId]
    );
    res.json({ collections: result.rows || [] });
  } catch (err) {
    console.error('PostgreSQL error (get collections):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Create collection
app.post('/collections', async (req, res) => {
  const { workspaceId, name } = req.body || {};
  if (!workspaceId || !name) {
    return res.status(400).json({ error: 'workspaceId and name are required' });
  }
  const createdAt = Date.now();
  const client = await pool.connect();

  try {
    const result = await client.query(
      'INSERT INTO collections (workspace_id, name, created_at) VALUES ($1, $2, $3) RETURNING id',
      [workspaceId, String(name).trim(), createdAt]
    );
    res.json({
      collection: {
        id: result.rows[0].id,
        workspaceId: Number(workspaceId),
        name: String(name).trim(),
        createdAt,
      },
    });
  } catch (err) {
    console.error('PostgreSQL error (create collection):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Update collection
app.put('/collections/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name } = req.body || {};
  const client = await pool.connect();

  try {
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = await client.query(
      'UPDATE collections SET name = $1 WHERE id = $2 RETURNING id, workspace_id as "workspaceId", name, created_at as "createdAt"',
      [String(name).trim(), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json({ collection: result.rows[0] });
  } catch (err) {
    console.error('PostgreSQL error (update collection):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Delete collection
app.delete('/collections/:id', async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('DELETE FROM collections WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PostgreSQL error (delete collection):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ========== ENVIRONMENTS ENDPOINTS ==========
// Get environments for a workspace
app.get('/workspaces/:workspaceId/environments', async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, workspace_id as "workspaceId", name, variables_json as "variablesJson", created_at as "createdAt" FROM environments WHERE workspace_id = $1 ORDER BY created_at ASC',
      [workspaceId]
    );
    const environments = (result.rows || []).map(row => ({
      ...row,
      variables: JSON.parse(row.variablesJson || '[]'),
    }));
    res.json({ environments });
  } catch (err) {
    console.error('PostgreSQL error (get environments):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Create/Update environment
app.post('/environments', async (req, res) => {
  const { id, workspaceId, name, variables } = req.body || {};
  if (!workspaceId || !name) {
    return res.status(400).json({ error: 'workspaceId and name are required' });
  }
  const variablesJson = JSON.stringify(variables || []);
  const createdAt = Date.now();
  const client = await pool.connect();

  try {
    if (id) {
      // Update existing
      await client.query(
        'UPDATE environments SET name = $1, variables_json = $2 WHERE id = $3',
        [String(name).trim(), variablesJson, id]
      );
      res.json({ success: true, environment: { id: Number(id), workspaceId, name, variables, createdAt } });
    } else {
      // Create new
      const result = await client.query(
        'INSERT INTO environments (workspace_id, name, variables_json, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [workspaceId, String(name).trim(), variablesJson, createdAt]
      );
      res.json({
        environment: {
          id: result.rows[0].id,
          workspaceId: Number(workspaceId),
          name: String(name).trim(),
          variables: variables || [],
          createdAt,
        },
      });
    }
  } catch (err) {
    console.error('PostgreSQL error (save environment):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Delete environment
app.delete('/environments/:id', async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('DELETE FROM environments WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PostgreSQL error (delete environment):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ========== SAVED REQUESTS ENDPOINTS ==========
// Get saved requests for a workspace
app.get('/workspaces/:workspaceId/saved-requests', async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, workspace_id as "workspaceId", collection_id as "collectionId", name, method, url, request_json as "requestJson", updated_at as "updatedAt" FROM saved_requests WHERE workspace_id = $1 ORDER BY updated_at DESC',
      [workspaceId]
    );
    const requests = (result.rows || []).map(row => ({
      ...JSON.parse(row.requestJson || '{}'),
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      collectionId: row.collectionId ? String(row.collectionId) : undefined,
      updatedAt: row.updatedAt,
    }));
    res.json({ requests });
  } catch (err) {
    console.error('PostgreSQL error (get saved requests):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Create/Update saved request
app.post('/saved-requests', async (req, res) => {
  const { id, workspaceId, collectionId, name, request } = req.body || {};
  if (!workspaceId || !name || !request) {
    return res.status(400).json({ error: 'workspaceId, name, and request are required' });
  }
  const requestJson = JSON.stringify(request);
  const updatedAt = Date.now();
  const client = await pool.connect();

  try {
    if (id) {
      // Update existing
      await client.query(
        'UPDATE saved_requests SET name = $1, request_json = $2, collection_id = $3, updated_at = $4 WHERE id = $5',
        [String(name).trim(), requestJson, collectionId || null, updatedAt, id]
      );
      res.json({ success: true });
    } else {
      // Create new
      const result = await client.query(
        'INSERT INTO saved_requests (workspace_id, collection_id, name, method, url, request_json, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [workspaceId, collectionId || null, String(name).trim(), request.method || 'GET', request.url || '', requestJson, updatedAt]
      );
      res.json({
        request: {
          ...request,
          id: String(result.rows[0].id),
          workspaceId: String(workspaceId),
          collectionId: collectionId ? String(collectionId) : undefined,
          updatedAt,
        },
      });
    }
  } catch (err) {
    console.error('PostgreSQL error (save request):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Delete saved request
app.delete('/saved-requests/:id', async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('DELETE FROM saved_requests WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PostgreSQL error (delete saved request):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ========== HISTORY ENDPOINTS ==========
// Get history for a workspace
app.get('/workspaces/:workspaceId/history', async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const limit = parseInt(req.query.limit) || 50;
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, workspace_id as "workspaceId", user_id as "userId", request_json as "requestJson", response_status as "responseStatus", timestamp FROM history WHERE workspace_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [workspaceId, limit]
    );
    const history = (result.rows || []).map(row => ({
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      timestamp: row.timestamp,
      request: JSON.parse(row.requestJson || '{}'),
      responseStatus: row.responseStatus,
    }));
    res.json({ history });
  } catch (err) {
    console.error('PostgreSQL error (get history):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Add history item
app.post('/history', async (req, res) => {
  const { workspaceId, userId, request, responseStatus } = req.body || {};
  if (!workspaceId || !userId || !request) {
    return res.status(400).json({ error: 'workspaceId, userId, and request are required' });
  }
  const requestJson = JSON.stringify(request);
  const timestamp = Date.now();
  const client = await pool.connect();

  try {
    const result = await client.query(
      'INSERT INTO history (workspace_id, user_id, request_json, response_status, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [workspaceId, userId, requestJson, responseStatus || null, timestamp]
    );
    res.json({
      historyItem: {
        id: String(result.rows[0].id),
        workspaceId: String(workspaceId),
        timestamp,
        request,
        responseStatus,
      },
    });
  } catch (err) {
    console.error('PostgreSQL error (add history):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ========== USER PREFERENCES ENDPOINTS ==========
// Get user preferences
app.get('/users/:userId/preferences', async (req, res) => {
  const userId = req.params.userId;
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT active_workspace_id as "activeWorkspaceId", active_env_id as "activeEnvId", default_proxy_mode as "defaultProxyMode" FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    res.json({
      preferences: result.rows[0] || {
        activeWorkspaceId: null,
        activeEnvId: null,
        defaultProxyMode: 1,
      },
    });
  } catch (err) {
    console.error('PostgreSQL error (get preferences):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// Update user preferences
app.post('/users/:userId/preferences', async (req, res) => {
  const userId = req.params.userId;
  const { activeWorkspaceId, activeEnvId, defaultProxyMode } = req.body || {};
  const client = await pool.connect();

  try {
    await client.query(
      `INSERT INTO user_preferences (user_id, active_workspace_id, active_env_id, default_proxy_mode) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT(user_id) DO UPDATE SET 
         active_workspace_id = EXCLUDED.active_workspace_id,
         active_env_id = EXCLUDED.active_env_id,
         default_proxy_mode = EXCLUDED.default_proxy_mode`,
      [userId, activeWorkspaceId || null, activeEnvId || null, defaultProxyMode !== undefined ? (defaultProxyMode ? 1 : 0) : 1]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PostgreSQL error (update preferences):', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

app.post('/proxy', async (req, res) => {
  try {
    const { url, method, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Filter out forbidden headers that might confuse the upstream API
    const cleanHeaders = { ...headers };
    delete cleanHeaders['host'];
    delete cleanHeaders['content-length'];

    const startTime = performance.now();

    const fetchOptions = {
      method: method || 'GET',
      headers: cleanHeaders,
    };

    // Only attach body if method is not GET/HEAD
    if (method !== 'GET' && method !== 'HEAD' && body) {
      fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
    }

    // Execute the request server-side
    const response = await fetch(url, fetchOptions);

    const endTime = performance.now();
    const time = Math.round(endTime - startTime);

    // Parse response body
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Convert Headers object to plain object
    const responseHeaders = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    // Return standardized response wrapper
    res.json({
      statusCode: response.status,
      statusText: response.statusText,
      time: time,
      size: Number(response.headers.get('content-length')) || 0,
      headers: responseHeaders,
      data: data
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({
      statusCode: 0,
      statusText: 'Proxy Error',
      time: 0,
      size: 0,
      headers: {},
      data: null,
      error: error.message || 'Unknown proxy error'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Serve React app for all non-API routes in production (SPA routing)
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  // Use a catch-all middleware that works with Express 5
  // This must be placed after all API routes
  app.use((req, res, next) => {
    // Skip if it's an API route (these should have been handled already)
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/users/') || 
        req.path.startsWith('/workspaces/') || 
        req.path.startsWith('/collections/') ||
        req.path.startsWith('/environments/') || 
        req.path.startsWith('/saved-requests/') ||
        req.path.startsWith('/history/') || 
        req.path.startsWith('/invitations/') ||
        req.path.startsWith('/proxy') ||
        req.path.startsWith('/auth/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    // Check if it's a static file request (has extension and file exists)
    // Static files are already served by express.static, so if we reach here
    // and it's a file request, it doesn't exist - let it 404
    if (req.path.includes('.')) {
      return next();
    }
    // Serve index.html for all other routes (SPA routing)
    res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
      if (err) {
        res.status(404).json({ error: 'Not found' });
      }
    });
  });
}

app.listen(PORT, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT';
  console.log(`CommunicateX Server running at http://localhost:${PORT} (${mode})`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Serving static files from dist/');
  }
});
