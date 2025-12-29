const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const app = express();
// Use a dedicated port for the proxy so it doesn't conflict with Vite
const PORT = 4000;

// --- SQLite setup ---
const DB_PATH = './auth.db';
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // Core users table
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`
  );

  // Workspaces owned by / shared with users
  db.run(
    `CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    )`
  );

  // Memberships: which users belong to which workspace and in what role
  db.run(
    `CREATE TABLE IF NOT EXISTS workspace_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      UNIQUE(workspace_id, user_id),
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`
  );

  // Collections per workspace (for future sync of saved requests)
  db.run(
    `CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    )`
  );

  // Environments per workspace
  db.run(
    `CREATE TABLE IF NOT EXISTS environments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      variables_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    )`
  );

  // Saved requests per workspace + collection
  db.run(
    `CREATE TABLE IF NOT EXISTS saved_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      collection_id INTEGER,
      name TEXT NOT NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      request_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY(collection_id) REFERENCES collections(id)
    )`
  );

  // Invitations: pending workspace invitations
  db.run(
    `CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      inviter_id INTEGER NOT NULL,
      invitee_email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY(inviter_id) REFERENCES users(id)
    )`
  );

  // History: request history per workspace
  db.run(
    `CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      request_json TEXT NOT NULL,
      response_status INTEGER,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`
  );

  // User preferences: user-specific settings
  db.run(
    `CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      active_workspace_id INTEGER,
      active_env_id INTEGER,
      default_proxy_mode INTEGER DEFAULT 1,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(active_workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY(active_env_id) REFERENCES environments(id)
    )`
  );
});

// Enable CORS for the frontend
app.use(cors());

// Parse JSON bodies (increased limit for large payloads)
app.use(express.json({ limit: '50mb' }));

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

app.post('/auth/signup', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail], (err, row) => {
    if (err) {
      console.error('SQLite error (signup lookup):', err);
      return res.status(500).json({ error: 'Internal error' });
    }
    if (row) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = bcrypt.hashSync(String(password), 10);
    const createdAt = Date.now();

    db.run(
      'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
      [normalizedEmail, String(name).trim(), passwordHash, createdAt],
      function (insertErr) {
        if (insertErr) {
          console.error('SQLite error (signup insert):', insertErr);
          return res.status(500).json({ error: 'Internal error' });
        }

        db.get('SELECT id, email, name FROM users WHERE id = ?', [this.lastID], (getErr, userRow) => {
          if (getErr || !userRow) {
            console.error('SQLite error (signup fetch):', getErr);
            return res.status(500).json({ error: 'Internal error' });
          }
          return res.json({ user: toPublicUser(userRow) });
        });
      }
    );
  });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  db.get(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?',
    [normalizedEmail],
    (err, row) => {
      if (err) {
        console.error('SQLite error (login lookup):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      if (!row) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const ok = bcrypt.compareSync(String(password), row.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      return res.json({ user: toPublicUser(row) });
    }
  );
});

// --- Workspace & invitation API ---

// Create a workspace for a user
app.post('/workspaces', (req, res) => {
  const { userId, name } = req.body || {};
  if (!userId || !name) {
    return res.status(400).json({ error: 'userId and name are required' });
  }

  const createdAt = Date.now();
  db.run(
    'INSERT INTO workspaces (owner_id, name, created_at) VALUES (?, ?, ?)',
    [userId, String(name).trim(), createdAt],
    function (err) {
      if (err) {
        console.error('SQLite error (create workspace):', err);
        return res.status(500).json({ error: 'Internal error' });
      }

      const workspaceId = this.lastID;
      // Owner is also a member with role "owner"
      db.run(
        'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
        [workspaceId, userId, 'owner', createdAt],
        (memberErr) => {
          if (memberErr) {
            console.error('SQLite error (add owner membership):', memberErr);
            // Still return workspace; membership can be repaired manually.
          }

          res.json({
            workspace: {
              id: workspaceId,
              ownerId: userId,
              name: String(name).trim(),
              createdAt,
            },
          });
        }
      );
    }
  );
});

// List workspaces a user belongs to
app.get('/workspaces', (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const sql = `
    SELECT w.id, w.name, w.owner_id as ownerId, w.created_at as createdAt, m.role
    FROM workspace_members m
    JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ?
    ORDER BY w.created_at ASC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error('SQLite error (list workspaces):', err);
      return res.status(500).json({ error: 'Internal error' });
    }
    res.json({ workspaces: rows || [] });
  });
});

// Delete a workspace (only owner can delete)
app.delete('/workspaces/:id', (req, res) => {
  const workspaceId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Check if user is the owner
  db.get(
    'SELECT owner_id FROM workspaces WHERE id = ?',
    [workspaceId],
    (err, wsRow) => {
      if (err) {
        console.error('SQLite error (get workspace):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      if (!wsRow) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      if (wsRow.owner_id !== userId) {
        return res.status(403).json({ error: 'Only the workspace owner can delete it' });
      }

      // Delete workspace (cascade will handle related data due to foreign keys)
      db.run('DELETE FROM workspaces WHERE id = ?', [workspaceId], (deleteErr) => {
        if (deleteErr) {
          console.error('SQLite error (delete workspace):', deleteErr);
          return res.status(500).json({ error: 'Internal error' });
        }
        res.json({ success: true });
      });
    }
  );
});

// Invite a user (by email) to a workspace - creates an invitation
app.post('/workspaces/:id/invite', (req, res) => {
  const workspaceId = req.params.id;
  const { email, role = 'member', inviterId } = req.body || {};

  if (!workspaceId || !email || !inviterId) {
    return res.status(400).json({ error: 'workspace id, email, and inviterId are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Check if user exists
  db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail], (userErr, userRow) => {
    if (userErr) {
      console.error('SQLite error (invite lookup user):', userErr);
      return res.status(500).json({ error: 'Internal error' });
    }
    if (!userRow) {
      return res.status(404).json({ error: 'User with that email does not exist yet' });
    }

    // Check if user is already a member
    db.get(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userRow.id],
      (memberErr, memberRow) => {
        if (memberErr) {
          console.error('SQLite error (check membership):', memberErr);
          return res.status(500).json({ error: 'Internal error' });
        }
        if (memberRow) {
          return res.status(400).json({ error: 'User is already a member of this workspace' });
        }

        // Check if invitation already exists
        db.get(
          'SELECT id FROM invitations WHERE workspace_id = ? AND invitee_email = ? AND status = ?',
          [workspaceId, normalizedEmail, 'pending'],
          (invErr, invRow) => {
            if (invErr) {
              console.error('SQLite error (check invitation):', invErr);
              return res.status(500).json({ error: 'Internal error' });
            }
            if (invRow) {
              return res.status(400).json({ error: 'Invitation already sent to this user' });
            }

            // Create invitation
            const createdAt = Date.now();
            db.run(
              'INSERT INTO invitations (workspace_id, inviter_id, invitee_email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              [workspaceId, inviterId, normalizedEmail, String(role), 'pending', createdAt],
              function (err) {
                if (err) {
                  console.error('SQLite error (create invitation):', err);
                  return res.status(500).json({ error: 'Internal error' });
                }

                res.json({
                  invitation: {
                    id: this.lastID,
                    workspaceId: Number(workspaceId),
                    inviteeEmail: normalizedEmail,
                    role: String(role),
                    status: 'pending',
                    createdAt,
                  },
                });
              }
            );
          }
        );
      }
    );
  });
});

// Get pending invitations for a user (by email)
app.get('/invitations', (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const sql = `
    SELECT 
      i.id,
      i.workspace_id as workspaceId,
      i.inviter_id as inviterId,
      i.invitee_email as inviteeEmail,
      i.role,
      i.status,
      i.created_at as createdAt,
      w.name as workspaceName,
      u.name as inviterName,
      u.email as inviterEmail
    FROM invitations i
    JOIN workspaces w ON w.id = i.workspace_id
    JOIN users u ON u.id = i.inviter_id
    WHERE i.invitee_email = ? AND i.status = 'pending'
    ORDER BY i.created_at DESC
  `;

  db.all(sql, [normalizedEmail], (err, rows) => {
    if (err) {
      console.error('SQLite error (list invitations):', err);
      return res.status(500).json({ error: 'Internal error' });
    }
    res.json({ invitations: rows || [] });
  });
});

// Accept an invitation
app.post('/invitations/:id/accept', (req, res) => {
  const invitationId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Get invitation details
  db.get(
    'SELECT workspace_id, invitee_email, role FROM invitations WHERE id = ? AND status = ?',
    [invitationId, 'pending'],
    (err, invRow) => {
      if (err) {
        console.error('SQLite error (get invitation):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      if (!invRow) {
        return res.status(404).json({ error: 'Invitation not found or already processed' });
      }

      // Verify the user email matches
      db.get('SELECT email FROM users WHERE id = ?', [userId], (userErr, userRow) => {
        if (userErr || !userRow) {
          return res.status(404).json({ error: 'User not found' });
        }
        if (userRow.email.toLowerCase() !== invRow.invitee_email.toLowerCase()) {
          return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Add user to workspace
        const createdAt = Date.now();
        db.run(
          'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
          [invRow.workspace_id, userId, invRow.role, createdAt],
          (memberErr) => {
            if (memberErr) {
              console.error('SQLite error (add member):', memberErr);
              return res.status(500).json({ error: 'Internal error' });
            }

            // Mark invitation as accepted
            db.run(
              'UPDATE invitations SET status = ? WHERE id = ?',
              ['accepted', invitationId],
              (updateErr) => {
                if (updateErr) {
                  console.error('SQLite error (update invitation):', updateErr);
                }

                res.json({
                  success: true,
                  workspaceId: invRow.workspace_id,
                });
              }
            );
          }
        );
      });
    }
  );
});

// Decline an invitation
app.post('/invitations/:id/decline', (req, res) => {
  const invitationId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Verify invitation belongs to user
  db.get(
    'SELECT invitee_email FROM invitations WHERE id = ? AND status = ?',
    [invitationId, 'pending'],
    (err, invRow) => {
      if (err) {
        console.error('SQLite error (get invitation):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      if (!invRow) {
        return res.status(404).json({ error: 'Invitation not found or already processed' });
      }

      db.get('SELECT email FROM users WHERE id = ?', [userId], (userErr, userRow) => {
        if (userErr || !userRow) {
          return res.status(404).json({ error: 'User not found' });
        }
        if (userRow.email.toLowerCase() !== invRow.invitee_email.toLowerCase()) {
          return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Mark invitation as declined
        db.run('UPDATE invitations SET status = ? WHERE id = ?', ['declined', invitationId], (updateErr) => {
          if (updateErr) {
            console.error('SQLite error (decline invitation):', updateErr);
            return res.status(500).json({ error: 'Internal error' });
          }

          res.json({ success: true });
        });
      });
    }
  );
});

// ========== COLLECTIONS ENDPOINTS ==========
// Get collections for a workspace
app.get('/workspaces/:workspaceId/collections', (req, res) => {
  const workspaceId = req.params.workspaceId;
  db.all(
    'SELECT id, workspace_id as workspaceId, name, created_at as createdAt FROM collections WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
    (err, rows) => {
      if (err) {
        console.error('SQLite error (get collections):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      res.json({ collections: rows || [] });
    }
  );
});

// Create collection
app.post('/collections', (req, res) => {
  const { workspaceId, name } = req.body || {};
  if (!workspaceId || !name) {
    return res.status(400).json({ error: 'workspaceId and name are required' });
  }
  const createdAt = Date.now();
  db.run(
    'INSERT INTO collections (workspace_id, name, created_at) VALUES (?, ?, ?)',
    [workspaceId, String(name).trim(), createdAt],
    function (err) {
      if (err) {
        console.error('SQLite error (create collection):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      res.json({
        collection: {
          id: this.lastID,
          workspaceId: Number(workspaceId),
          name: String(name).trim(),
          createdAt,
        },
      });
    }
  );
});

// Delete collection
app.delete('/collections/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM collections WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('SQLite error (delete collection):', err);
      return res.status(500).json({ error: 'Internal error' });
    }
    res.json({ success: true });
  });
});

// ========== ENVIRONMENTS ENDPOINTS ==========
// Get environments for a workspace
app.get('/workspaces/:workspaceId/environments', (req, res) => {
  const workspaceId = req.params.workspaceId;
  db.all(
    'SELECT id, workspace_id as workspaceId, name, variables_json as variablesJson, created_at as createdAt FROM environments WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
    (err, rows) => {
      if (err) {
        console.error('SQLite error (get environments):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      const environments = (rows || []).map(row => ({
        ...row,
        variables: JSON.parse(row.variablesJson || '[]'),
      }));
      res.json({ environments });
    }
  );
});

// Create/Update environment
app.post('/environments', (req, res) => {
  const { id, workspaceId, name, variables } = req.body || {};
  if (!workspaceId || !name) {
    return res.status(400).json({ error: 'workspaceId and name are required' });
  }
  const variablesJson = JSON.stringify(variables || []);
  const createdAt = Date.now();

  if (id) {
    // Update existing
    db.run(
      'UPDATE environments SET name = ?, variables_json = ? WHERE id = ?',
      [String(name).trim(), variablesJson, id],
      (err) => {
        if (err) {
          console.error('SQLite error (update environment):', err);
          return res.status(500).json({ error: 'Internal error' });
        }
        res.json({ success: true, environment: { id: Number(id), workspaceId, name, variables, createdAt } });
      }
    );
  } else {
    // Create new
    db.run(
      'INSERT INTO environments (workspace_id, name, variables_json, created_at) VALUES (?, ?, ?, ?)',
      [workspaceId, String(name).trim(), variablesJson, createdAt],
      function (err) {
        if (err) {
          console.error('SQLite error (create environment):', err);
          return res.status(500).json({ error: 'Internal error' });
        }
        res.json({
          environment: {
            id: this.lastID,
            workspaceId: Number(workspaceId),
            name: String(name).trim(),
            variables: variables || [],
            createdAt,
          },
        });
      }
    );
  }
});

// Delete environment
app.delete('/environments/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM environments WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('SQLite error (delete environment):', err);
      return res.status(500).json({ error: 'Internal error' });
    }
    res.json({ success: true });
  });
});

// ========== SAVED REQUESTS ENDPOINTS ==========
// Get saved requests for a workspace
app.get('/workspaces/:workspaceId/saved-requests', (req, res) => {
  const workspaceId = req.params.workspaceId;
  db.all(
    'SELECT id, workspace_id as workspaceId, collection_id as collectionId, name, method, url, request_json as requestJson, updated_at as updatedAt FROM saved_requests WHERE workspace_id = ? ORDER BY updated_at DESC',
    [workspaceId],
    (err, rows) => {
      if (err) {
        console.error('SQLite error (get saved requests):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      const requests = (rows || []).map(row => ({
        ...JSON.parse(row.requestJson || '{}'),
        id: String(row.id),
        workspaceId: String(row.workspaceId),
        collectionId: row.collectionId ? String(row.collectionId) : undefined,
        updatedAt: row.updatedAt,
      }));
      res.json({ requests });
    }
  );
});

// Create/Update saved request
app.post('/saved-requests', (req, res) => {
  const { id, workspaceId, collectionId, name, request } = req.body || {};
  if (!workspaceId || !name || !request) {
    return res.status(400).json({ error: 'workspaceId, name, and request are required' });
  }
  const requestJson = JSON.stringify(request);
  const updatedAt = Date.now();

  if (id) {
    // Update existing
    db.run(
      'UPDATE saved_requests SET name = ?, request_json = ?, collection_id = ?, updated_at = ? WHERE id = ?',
      [String(name).trim(), requestJson, collectionId || null, updatedAt, id],
      (err) => {
        if (err) {
          console.error('SQLite error (update saved request):', err);
          return res.status(500).json({ error: 'Internal error' });
        }
        res.json({ success: true });
      }
    );
  } else {
    // Create new
    db.run(
      'INSERT INTO saved_requests (workspace_id, collection_id, name, method, url, request_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [workspaceId, collectionId || null, String(name).trim(), request.method || 'GET', request.url || '', requestJson, updatedAt],
      function (err) {
        if (err) {
          console.error('SQLite error (create saved request):', err);
          return res.status(500).json({ error: 'Internal error' });
        }
        res.json({
          request: {
            ...request,
            id: String(this.lastID),
            workspaceId: String(workspaceId),
            collectionId: collectionId ? String(collectionId) : undefined,
            updatedAt,
          },
        });
      }
    );
  }
});

// Delete saved request
app.delete('/saved-requests/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM saved_requests WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('SQLite error (delete saved request):', err);
      return res.status(500).json({ error: 'Internal error' });
    }
    res.json({ success: true });
  });
});

// ========== HISTORY ENDPOINTS ==========
// Get history for a workspace
app.get('/workspaces/:workspaceId/history', (req, res) => {
  const workspaceId = req.params.workspaceId;
  const limit = parseInt(req.query.limit) || 50;
  db.all(
    'SELECT id, workspace_id as workspaceId, user_id as userId, request_json as requestJson, response_status as responseStatus, timestamp FROM history WHERE workspace_id = ? ORDER BY timestamp DESC LIMIT ?',
    [workspaceId, limit],
    (err, rows) => {
      if (err) {
        console.error('SQLite error (get history):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      const history = (rows || []).map(row => ({
        id: String(row.id),
        workspaceId: String(row.workspaceId),
        timestamp: row.timestamp,
        request: JSON.parse(row.requestJson || '{}'),
        responseStatus: row.responseStatus,
      }));
      res.json({ history });
    }
  );
});

// Add history item
app.post('/history', (req, res) => {
  const { workspaceId, userId, request, responseStatus } = req.body || {};
  if (!workspaceId || !userId || !request) {
    return res.status(400).json({ error: 'workspaceId, userId, and request are required' });
  }
  const requestJson = JSON.stringify(request);
  const timestamp = Date.now();
  db.run(
    'INSERT INTO history (workspace_id, user_id, request_json, response_status, timestamp) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, userId, requestJson, responseStatus || null, timestamp],
    function (err) {
      if (err) {
        console.error('SQLite error (add history):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      res.json({
        historyItem: {
          id: String(this.lastID),
          workspaceId: String(workspaceId),
          timestamp,
          request,
          responseStatus,
        },
      });
    }
  );
});

// ========== USER PREFERENCES ENDPOINTS ==========
// Get user preferences
app.get('/users/:userId/preferences', (req, res) => {
  const userId = req.params.userId;
  db.get(
    'SELECT active_workspace_id as activeWorkspaceId, active_env_id as activeEnvId, default_proxy_mode as defaultProxyMode FROM user_preferences WHERE user_id = ?',
    [userId],
    (err, row) => {
      if (err) {
        console.error('SQLite error (get preferences):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      res.json({
        preferences: row || {
          activeWorkspaceId: null,
          activeEnvId: null,
          defaultProxyMode: 1,
        },
      });
    }
  );
});

// Update user preferences
app.post('/users/:userId/preferences', (req, res) => {
  const userId = req.params.userId;
  const { activeWorkspaceId, activeEnvId, defaultProxyMode } = req.body || {};
  db.run(
    `INSERT INTO user_preferences (user_id, active_workspace_id, active_env_id, default_proxy_mode) 
     VALUES (?, ?, ?, ?) 
     ON CONFLICT(user_id) DO UPDATE SET 
       active_workspace_id = excluded.active_workspace_id,
       active_env_id = excluded.active_env_id,
       default_proxy_mode = excluded.default_proxy_mode`,
    [userId, activeWorkspaceId || null, activeEnvId || null, defaultProxyMode !== undefined ? (defaultProxyMode ? 1 : 0) : 1],
    (err) => {
      if (err) {
        console.error('SQLite error (update preferences):', err);
        return res.status(500).json({ error: 'Internal error' });
      }
      res.json({ success: true });
    }
  );
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

app.listen(PORT, () => {
  console.log(`CommunicateX Proxy Server running at http://localhost:${PORT}`);
});


