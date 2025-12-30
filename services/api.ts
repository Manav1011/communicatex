// Always use relative URLs when VITE_API_BASE is empty, undefined, or in production mode
// This ensures the frontend works when accessed via IP address or any hostname
// Only use absolute URL if VITE_API_BASE is explicitly set to a non-empty value
const getApiBase = () => {
  const viteApiBase = import.meta.env.VITE_API_BASE;
  // If explicitly empty string, undefined, or production mode, use relative URLs
  if (viteApiBase === '' || !viteApiBase || import.meta.env.PROD) {
    return '';
  }
  // Otherwise use the configured value
  return viteApiBase;
};

const API_BASE = getApiBase();

// Export API_BASE for use in other files
export const API_BASE_URL = API_BASE;

export const apiService = {
  // Workspaces
  async createWorkspace(userId: number, name: string) {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name }),
    });
    const data = await res.json();
    return data.workspace;
  },

  // User preferences
  async getPreferences(userId: number) {
    const res = await fetch(`${API_BASE}/users/${userId}/preferences`);
    const data = await res.json();
    return data.preferences || { activeWorkspaceId: null, activeEnvId: null, defaultProxyMode: 1 };
  },

  async updatePreferences(userId: number, preferences: { activeWorkspaceId?: number | null; activeEnvId?: number | null; defaultProxyMode?: boolean }) {
    const res = await fetch(`${API_BASE}/users/${userId}/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    const data = await res.json();
    return data.success;
  },

  // Collections
  async getCollections(workspaceId: number) {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/collections`);
    const data = await res.json();
    return data.collections || [];
  },

  async createCollection(workspaceId: number, name: string) {
    const res = await fetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, name }),
    });
    const data = await res.json();
    return data.collection;
  },

  async updateCollection(id: number, name: string) {
    const res = await fetch(`${API_BASE}/collections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.collection || data;
  },

  async deleteCollection(id: number) {
    const res = await fetch(`${API_BASE}/collections/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },

  // Environments
  async getEnvironments(workspaceId: number) {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/environments`);
    const data = await res.json();
    return data.environments || [];
  },

  async saveEnvironment(environment: { id?: number; workspaceId: number; name: string; variables: any[] }) {
    const res = await fetch(`${API_BASE}/environments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(environment),
    });
    const data = await res.json();
    return data.environment || data;
  },

  async deleteEnvironment(id: number) {
    const res = await fetch(`${API_BASE}/environments/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },

  // Saved Requests
  async getSavedRequests(workspaceId: number) {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/saved-requests`);
    const data = await res.json();
    return data.requests || [];
  },

  async saveRequest(request: { id?: string; workspaceId: number; collectionId?: string; name: string;[key: string]: any }) {
    const res = await fetch(`${API_BASE}/saved-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: request.id ? parseInt(request.id) : undefined,
        workspaceId: typeof request.workspaceId === 'string' ? parseInt(request.workspaceId) : request.workspaceId,
        collectionId: request.collectionId ? parseInt(request.collectionId) : null,
        name: request.name,
        request: request,
      }),
    });
    const data = await res.json();
    return data.request || data;
  },

  async deleteSavedRequest(id: number) {
    const res = await fetch(`${API_BASE}/saved-requests/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },

  // History
  async getHistory(workspaceId: number, limit = 50) {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/history?limit=${limit}`);
    const data = await res.json();
    return data.history || [];
  },

  async addHistoryItem(workspaceId: number, userId: number, request: any, responseStatus?: number) {
    const res = await fetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: typeof workspaceId === 'string' ? parseInt(workspaceId) : workspaceId,
        userId,
        request,
        responseStatus,
      }),
    });
    const data = await res.json();
    return data.historyItem;
  },
};

