import React, { useState, useEffect } from 'react';
import { ApiRequest, ApiResponse, HttpMethod, AuthMethod, HistoryItem, User, MOCK_USER, Workspace, Environment, KeyValueItem, Collection, SavedRequest, Invitation } from './types';
import { executeRequest } from './services/apiExecutor';
import { apiService, API_BASE_URL } from './services/api';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import KeyValueEditor from './components/KeyValueEditor';
import { History, LogOut, Zap, LayoutGrid, Clock, ChevronDown, ChevronRight, Plus, Check, Box, Database, Trash2, Settings, Folder, Save, MoreVertical, FolderOpen, FileText, Mail, X, Copy, Edit, ExternalLink } from 'lucide-react';

const DEFAULT_REQUEST: ApiRequest = {
  id: 'default',
  name: 'New Request',
  method: HttpMethod.GET,
  url: 'https://jsonplaceholder.typicode.com/todos/1',
  params: [],
  headers: [],
  bodyType: 'none',
  bodyContent: '{\n\t\n}',
  multipartParams: [],
  formEncodedParams: [],
  graphqlQuery: '',
  graphqlVariables: '{\n\t\n}',
  auth: { type: AuthMethod.NONE },
  useProxy: true
};

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default_ws',
  name: 'Personal Workspace',
  createdAt: Date.now(),
};

type SidebarView = 'history' | 'collections';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>('collections');
  
  // Workspace State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([DEFAULT_WORKSPACE]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(DEFAULT_WORKSPACE.id);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  
  // Invitations State
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);

  // Collections State
  const [collections, setCollections] = useState<Collection[]>([]);
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [isEnvExpanded, setIsEnvExpanded] = useState(false);
  const [showSaveRequestModal, setShowSaveRequestModal] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [saveRequestName, setSaveRequestName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');

  // Environment State
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [showEnvMenu, setShowEnvMenu] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);

  // Request Tabs State
  const [requestTabs, setRequestTabs] = useState<Array<{ id: string; request: ApiRequest; response: ApiResponse | null }>>([
    { id: 'default', request: DEFAULT_REQUEST, response: null }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('default');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [collectionContextMenu, setCollectionContextMenu] = useState<{ x: number; y: number; collectionId: string } | null>(null);

  const activeTab = requestTabs.find(tab => tab.id === activeTabId) || requestTabs[0];
  const request = activeTab?.request || DEFAULT_REQUEST;
  const response = activeTab?.response || null;
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const getActiveWorkspace = () =>
    workspaces.find(w => w.id === activeWorkspaceId) || DEFAULT_WORKSPACE;

  const fetchInvitations = async (userEmail: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/invitations?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (res.ok && data.invitations) {
        setInvitations(data.invitations);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  };

  // Load user and data from backend
  useEffect(() => {
    const initData = async () => {
      try {
        // Check localStorage for user session
        const savedUserStr = localStorage.getItem('current_user');
        if (savedUserStr) {
          const savedUser: User = JSON.parse(savedUserStr);
          setUser(savedUser);
          
          if (savedUser.backendId && savedUser.email) {
            // Fetch invitations
            await fetchInvitations(savedUser.email);
            
            // Fetch user preferences
            const prefs = await apiService.getPreferences(savedUser.backendId);
            if (prefs.defaultProxyMode !== undefined) {
              setRequestTabs(prev => prev.map(tab => 
                tab.id === (activeTabId || 'default')
                  ? { ...tab, request: { ...tab.request, useProxy: prefs.defaultProxyMode === 1 } }
                  : tab
              ));
            }
            
            // Fetch user's workspaces from backend
            const wsRes = await fetch(`${API_BASE_URL}/workspaces?userId=${savedUser.backendId}`);
            const wsData = await wsRes.json();
            if (wsRes.ok && wsData.workspaces) {
              const backendWorkspaces: Workspace[] = wsData.workspaces.map((ws: any) => ({
                id: `ws_${ws.id}`,
                name: ws.name,
                createdAt: ws.createdAt,
                backendId: ws.id,
              }));
              
              // Always include default workspace
              const allWorkspaces = [DEFAULT_WORKSPACE, ...backendWorkspaces];
              setWorkspaces(allWorkspaces);
              
              // Set active workspace from preferences or default
              if (prefs.activeWorkspaceId) {
                const prefWs = allWorkspaces.find(w => w.backendId === prefs.activeWorkspaceId);
                if (prefWs) {
                  setActiveWorkspaceId(prefWs.id);
                }
              }
              
              // Load data for active workspace
              const activeWs = allWorkspaces.find(w => w.id === (prefs.activeWorkspaceId ? allWorkspaces.find(w2 => w2.backendId === prefs.activeWorkspaceId)?.id : DEFAULT_WORKSPACE.id)) || DEFAULT_WORKSPACE;
              await loadWorkspaceData(activeWs, savedUser.backendId, prefs);
            }
          }
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    const loadWorkspaceData = async (workspace: Workspace, userId: number, prefs: any) => {
      if (!workspace.backendId) {
        // Default workspace - no backend data
        return;
      }
      
      try {
        // Load collections
        const cols = await apiService.getCollections(workspace.backendId);
        setCollections(cols.map((c: any) => ({
          id: `col_${c.id}`,
          workspaceId: workspace.id,
          name: c.name,
          createdAt: c.createdAt,
        })));
        
        // Load saved requests
        const reqs = await apiService.getSavedRequests(workspace.backendId);
        setSavedRequests(reqs.map((r: any) => ({
          ...r,
          id: String(r.id) || `req_${Date.now()}`,
          workspaceId: workspace.id,
          collectionId: r.collectionId ? `col_${r.collectionId}` : undefined,
        })));
        
        // Load environments
        const envs = await apiService.getEnvironments(workspace.backendId);
        setEnvironments(envs.map((e: any) => ({
          id: `env_${e.id}`,
          name: e.name,
          variables: e.variables || [],
        })));
        
        if (prefs.activeEnvId) {
          const prefEnv = envs.find((e: any) => e.id === prefs.activeEnvId);
          if (prefEnv) {
            setActiveEnvId(`env_${prefEnv.id}`);
          }
        }
        
        // Load history
        const hist = await apiService.getHistory(workspace.backendId);
        setHistory(hist.map((h: any) => ({
          ...h,
          id: h.id || `hist_${Date.now()}`,
          workspaceId: workspace.id,
        })));
      } catch (err) {
        console.error('Failed to load workspace data:', err);
      }
    };
    
    initData();
  }, []);

  // Persist user preferences when they change
  useEffect(() => {
    if (!isInitialized || !user?.backendId) return;
    const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
    const activeTabRequest = requestTabs.find(tab => tab.id === activeTabId)?.request;
    apiService.updatePreferences(user.backendId, {
      activeWorkspaceId: activeWs?.backendId || null,
      activeEnvId: activeEnvId ? parseInt(activeEnvId.replace('env_', '')) : null,
      defaultProxyMode: activeTabRequest?.useProxy ?? false,
    });
  }, [activeWorkspaceId, activeEnvId, activeTabId, requestTabs, isInitialized, user?.backendId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: email.split('@')[0] || 'User' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.error || 'Authentication failed');
        return;
      }

      const backendUser: User = {
        id: String(data.user.id),
        email: data.user.email,
        name: data.user.name,
      };

      const userWithBackendId: User = {
        ...backendUser,
        backendId: data.user.id,
      };
      setUser(userWithBackendId);
      localStorage.setItem('current_user', JSON.stringify(userWithBackendId));
      
      // Fetch pending invitations
      await fetchInvitations(userWithBackendId.email);
      
      // Fetch user preferences
      const prefs = await apiService.getPreferences(data.user.id);
      if (prefs.defaultProxyMode !== undefined) {
        setRequestTabs(prev => prev.map(tab => 
          tab.id === (activeTabId || 'default')
            ? { ...tab, request: { ...tab.request, useProxy: prefs.defaultProxyMode === 1 } }
            : tab
        ));
      }
      
      // Fetch user's workspaces from backend
      const wsRes = await fetch(`${API_BASE_URL}/workspaces?userId=${data.user.id}`);
      const wsData = await wsRes.json();
      if (wsRes.ok && wsData.workspaces) {
        const backendWorkspaces: Workspace[] = wsData.workspaces.map((ws: any) => ({
          id: `ws_${ws.id}`,
          name: ws.name,
          createdAt: ws.createdAt,
          backendId: ws.id,
        }));
        
        const allWorkspaces = [DEFAULT_WORKSPACE, ...backendWorkspaces];
        setWorkspaces(allWorkspaces);
        
        // Set active workspace from preferences or default
        if (prefs.activeWorkspaceId) {
          const prefWs = allWorkspaces.find(w => w.backendId === prefs.activeWorkspaceId);
          if (prefWs) {
            setActiveWorkspaceId(prefWs.id);
          }
        }
        
        // Load data for active workspace
        const activeWs = allWorkspaces.find(w => w.id === (prefs.activeWorkspaceId ? allWorkspaces.find(w2 => w2.backendId === prefs.activeWorkspaceId)?.id : DEFAULT_WORKSPACE.id)) || DEFAULT_WORKSPACE;
        if (activeWs.backendId) {
          const cols = await apiService.getCollections(activeWs.backendId);
          setCollections(cols.map((c: any) => ({
            id: `col_${c.id}`,
            workspaceId: activeWs.id,
            name: c.name,
            createdAt: c.createdAt,
          })));
          
          const reqs = await apiService.getSavedRequests(activeWs.backendId);
          setSavedRequests(reqs.map((r: any) => ({
            ...r,
            id: r.id || `req_${Date.now()}`,
            workspaceId: activeWs.id,
          })));
          
          const envs = await apiService.getEnvironments(activeWs.backendId);
          setEnvironments(envs.map((e: any) => ({
            id: `env_${e.id}`,
            name: e.name,
            variables: e.variables || [],
          })));
          
          if (prefs.activeEnvId) {
            const prefEnv = envs.find((e: any) => e.id === prefs.activeEnvId);
            if (prefEnv) {
              setActiveEnvId(`env_${prefEnv.id}`);
            }
          }
          
          const hist = await apiService.getHistory(activeWs.backendId);
          setHistory(hist.map((h: any) => ({
            ...h,
            id: h.id || `hist_${Date.now()}`,
            workspaceId: activeWs.id,
          })));
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setAuthError(`Unable to reach auth server. Is the proxy server running on ${API_BASE_URL}?`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    if (!user?.backendId) return;
    
    setInboxLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.backendId }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        // Refresh invitations
        await fetchInvitations(user.email);
        
        // Refresh workspaces list from backend
        const wsRes = await fetch(`${API_BASE_URL}/workspaces?userId=${user.backendId}`);
        const wsData = await wsRes.json();
        if (wsRes.ok && wsData.workspaces) {
          const backendWorkspaces: Workspace[] = wsData.workspaces.map((ws: any) => ({
            id: `ws_${ws.id}`,
            name: ws.name,
            createdAt: ws.createdAt,
            backendId: ws.id,
          }));
          
          const allWorkspaces = [DEFAULT_WORKSPACE, ...backendWorkspaces];
          setWorkspaces(allWorkspaces);
          
          // Switch to the newly joined workspace
          const joinedWs = allWorkspaces.find(w => w.backendId === data.workspaceId);
          if (joinedWs) {
            setActiveWorkspaceId(joinedWs.id);
            
            // Load workspace data
            const [cols, reqs, envs, hist] = await Promise.all([
              apiService.getCollections(joinedWs.backendId!),
              apiService.getSavedRequests(joinedWs.backendId!),
              apiService.getEnvironments(joinedWs.backendId!),
              apiService.getHistory(joinedWs.backendId!),
            ]);
            
            setCollections(cols.map((c: any) => ({
              id: `col_${c.id}`,
              workspaceId: joinedWs.id,
              name: c.name,
              createdAt: c.createdAt,
            })));
            
            setSavedRequests(reqs.map((r: any) => ({
              ...r,
              id: String(r.id) || `req_${Date.now()}`,
              workspaceId: joinedWs.id,
              collectionId: r.collectionId ? `col_${r.collectionId}` : undefined,
            })));
            
            setEnvironments(envs.map((e: any) => ({
              id: `env_${e.id}`,
              name: e.name,
              variables: e.variables || [],
            })));
            
            setHistory(hist.map((h: any) => ({
              ...h,
              id: h.id || `hist_${Date.now()}`,
              workspaceId: joinedWs.id,
            })));
          }
        }
        
        alert('You have joined the workspace!');
      } else {
        alert(data?.error || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Accept invitation error:', err);
      alert('Unable to accept invitation');
    } finally {
      setInboxLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitationId: number) => {
    if (!user?.backendId) return;
    
    setInboxLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.backendId }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        // Refresh invitations
        await fetchInvitations(user.email);
      } else {
        alert(data?.error || 'Failed to decline invitation');
      }
    } catch (err) {
      console.error('Decline invitation error:', err);
      alert('Unable to decline invitation');
    } finally {
      setInboxLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setInvitations([]);
    localStorage.removeItem('current_user');
    // Reset to default state
    setWorkspaces([DEFAULT_WORKSPACE]);
    setActiveWorkspaceId(DEFAULT_WORKSPACE.id);
    setCollections([]);
    setSavedRequests([]);
    setEnvironments([]);
    setHistory([]);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || !user?.backendId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.backendId, name: newWorkspaceName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.workspace) {
        const newWs: Workspace = {
          id: `ws_${data.workspace.id}`,
          name: data.workspace.name,
          createdAt: data.workspace.createdAt,
          backendId: data.workspace.id,
        };
        setWorkspaces([...workspaces, newWs]);
        setActiveWorkspaceId(newWs.id);
        setNewWorkspaceName('');
        setShowCreateWorkspaceModal(false);
        setShowWorkspaceMenu(false);
      } else {
        alert(data?.error || 'Failed to create workspace');
      }
    } catch (err) {
      console.error('Create workspace error:', err);
      alert('Unable to create workspace');
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    const activeWs = getActiveWorkspace();
    
    // For Personal Workspace, create collection locally only (no backend)
    if (!activeWs.backendId) {
      const newCol: Collection = {
        id: crypto.randomUUID(),
        workspaceId: activeWorkspaceId,
        name: newCollectionName.trim(),
        createdAt: Date.now(),
      };
      setCollections([...collections, newCol]);
      setNewCollectionName('');
      setShowCreateCollectionModal(false);
      setExpandedCollections(prev => new Set(prev).add(newCol.id));
      if (showSaveRequestModal) {
        setSelectedCollectionId(newCol.id);
      }
      return;
    }

    try {
      const col = await apiService.createCollection(activeWs.backendId, newCollectionName.trim());
      const newCol: Collection = {
        id: `col_${col.id}`,
        workspaceId: activeWorkspaceId,
        name: col.name,
        createdAt: col.createdAt,
      };
      setCollections([...collections, newCol]);
      setNewCollectionName('');
      setShowCreateCollectionModal(false);
      setExpandedCollections(prev => new Set(prev).add(newCol.id));
      if (showSaveRequestModal) {
        setSelectedCollectionId(newCol.id);
      }
    } catch (err) {
      console.error('Create collection error:', err);
      alert('Unable to create collection');
    }
  };

  const toggleCollection = (id: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteCollection = async (id: string) => {
    if (!confirm("Are you sure? This will delete all requests inside this collection.")) return;
    
    // Check if it's a backend collection or local (Personal Workspace)
    if (id.startsWith('col_')) {
      const backendId = parseInt(id.replace('col_', ''));
      if (!isNaN(backendId)) {
        try {
          await apiService.deleteCollection(backendId);
        } catch (err) {
          console.error('Delete collection error:', err);
          alert('Unable to delete collection');
          return;
        }
      }
    }
    
    // Remove from state (works for both backend and local collections)
    setCollections(prev => prev.filter(c => c.id !== id));
    setSavedRequests(prev => prev.filter(r => r.collectionId !== id));
  };

  const deleteSavedRequest = async (id: string) => {
    const backendId = parseInt(id.replace('req_', ''));
    if (isNaN(backendId)) {
      // Old format without backend ID, just remove from state
      setSavedRequests(prev => prev.filter(r => r.id !== id));
      return;
    }
    
    try {
      await apiService.deleteSavedRequest(backendId);
      setSavedRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Delete saved request error:', err);
      alert('Unable to delete request');
    }
  };

  const handleRequestChange = (next: ApiRequest) => {
    setRequestTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, request: next } : tab
    ));
    // Preferences are persisted via useEffect hook
  };

  // Tab Management Functions
  const createNewTab = () => {
    const newTabId = `tab_${Date.now()}`;
    const newRequest: ApiRequest = {
      ...DEFAULT_REQUEST,
      id: newTabId,
      name: 'New Request',
    };
    setRequestTabs(prev => [...prev, { id: newTabId, request: newRequest, response: null }]);
    setActiveTabId(newTabId);
  };

  const closeTab = (tabId: string) => {
    if (requestTabs.length === 1) {
      // Don't close the last tab, just reset it
      const resetRequest = { ...DEFAULT_REQUEST, id: 'default', name: 'New Request' };
      setRequestTabs([{ id: 'default', request: resetRequest, response: null }]);
      setActiveTabId('default');
      return;
    }
    
    const newTabs = requestTabs.filter(tab => tab.id !== tabId);
    setRequestTabs(newTabs);
    
    if (activeTabId === tabId) {
      const currentIndex = requestTabs.findIndex(tab => tab.id === tabId);
      const newActiveIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      setActiveTabId(newTabs[newActiveIndex]?.id || newTabs[0]?.id);
    }
  };

  const closeOtherTabs = (keepTabId: string) => {
    const keepTab = requestTabs.find(tab => tab.id === keepTabId);
    if (keepTab) {
      setRequestTabs([keepTab]);
      setActiveTabId(keepTabId);
    }
  };

  const duplicateTab = (tabId: string) => {
    const tabToDuplicate = requestTabs.find(tab => tab.id === tabId);
    if (tabToDuplicate) {
      const newTabId = `tab_${Date.now()}`;
      const duplicatedRequest = {
        ...tabToDuplicate.request,
        id: newTabId,
        name: `${tabToDuplicate.request.name} (Copy)`,
      };
      setRequestTabs(prev => [...prev, { id: newTabId, request: duplicatedRequest, response: null }]);
      setActiveTabId(newTabId);
    }
  };

  const renameTab = (tabId: string, newName: string) => {
    setRequestTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, request: { ...tab.request, name: newName } } : tab
    ));
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteLoading(true);

    try {
      const ws = getActiveWorkspace();

      // Ensure workspace has a backend id; if not, create it now
      let backendId = ws.backendId;
      if (!backendId && user) {
        const wsRes = await fetch(`${API_BASE_URL}/workspaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: Number(user.id), name: ws.name }),
        });
        const wsData = await wsRes.json();
        if (!wsRes.ok || !wsData.workspace?.id) {
          setInviteError(wsData?.error || 'Failed to create workspace on server');
          setInviteLoading(false);
          return;
        }
        backendId = wsData.workspace.id;
        setWorkspaces(prev =>
          prev.map(w => (w.id === ws.id ? { ...w, backendId } : w))
        );
      }

      if (!backendId) {
        setInviteError('Workspace is not synced with server yet.');
        setInviteLoading(false);
        return;
      }

      if (!user?.backendId) {
        setInviteError('User not authenticated properly');
        setInviteLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/workspaces/${backendId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, inviterId: user.backendId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data?.error || 'Failed to send invite');
        setInviteLoading(false);
        return;
      }

      setInviteLoading(false);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch (err: any) {
      console.error('Invite error:', err);
        setInviteError(`Unable to reach server. Is the proxy server running on ${API_BASE_URL}?`);
      setInviteLoading(false);
    }
  };

  const openSaveRequestModal = () => {
    // Check if this request is already saved
    const existing = savedRequests.find(r => r.id === request.id);
    
    if (existing) {
        // If it's already saved, update it directly without showing modal
        handleUpdateRequest(existing);
    } else {
        // Show modal for new requests
        setSaveRequestName(request.name || 'New Request');
        // Default to first collection if available
        const wsCollections = collections.filter(c => c.workspaceId === activeWorkspaceId);
        if (wsCollections.length > 0) {
            setSelectedCollectionId(wsCollections[0].id);
        }
        setShowSaveRequestModal(true);
    }
  };

  const handleUpdateRequest = async (existingRequest?: SavedRequest) => {
    const existing = existingRequest || savedRequests.find(r => r.id === request.id);
    if (!existing) return;
    
    const activeWs = getActiveWorkspace();
    if (!activeWs.backendId) {
      alert('Cannot update request in Personal Workspace');
      return;
    }

    try {
      const collectionBackendId = existing.collectionId ? parseInt(existing.collectionId.replace('col_', '')) : null;
      const requestId = parseInt(request.id.toString().replace('req_', ''));
      
      await apiService.saveRequest({
        ...request,
        id: requestId,
        name: request.name || existing.name,
        collectionId: collectionBackendId ? String(collectionBackendId) : undefined,
        workspaceId: String(activeWs.backendId),
      });
      
      // Backend returns { success: true } on update, so we use the current request data
      const updatedSavedReq: SavedRequest = {
        ...request,
        id: String(requestId),
        workspaceId: activeWorkspaceId,
        collectionId: existing.collectionId,
        updatedAt: Date.now(),
      };
      
      setSavedRequests(prev => prev.map(r => r.id === request.id ? updatedSavedReq : r));
      
      // Update the tab with the saved request, preserving all request properties
      // Don't overwrite the request, just update the saved state
      setRequestTabs(prev => prev.map(tab => 
        tab.id === activeTabId ? { 
          ...tab, 
          request: { 
            ...tab.request, // Keep all existing request properties
            id: String(requestId), // Update ID to match saved request
          } 
        } : tab
      ));
    } catch (err) {
      console.error('Update request error:', err);
      alert('Unable to update request');
    }
  };

  const handleSaveRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCollectionId || !saveRequestName.trim()) return;
      const activeWs = getActiveWorkspace();
      if (!activeWs.backendId) {
        alert('Cannot save request in Personal Workspace');
        return;
      }

      try {
        const collectionBackendId = parseInt(selectedCollectionId.replace('col_', ''));
        const isUpdate = request.id && savedRequests.find(r => r.id === request.id);
        const requestId = isUpdate ? parseInt(request.id.toString().replace('req_', '')) : undefined;
        
        const savedReq = await apiService.saveRequest({
          ...request,
          id: requestId,
          name: saveRequestName,
          collectionId: String(collectionBackendId),
          workspaceId: String(activeWs.backendId),
        });
        
        const newSavedReq: SavedRequest = {
          ...savedReq,
          id: String(savedReq.id) || `req_${Date.now()}`,
          workspaceId: activeWorkspaceId,
          collectionId: selectedCollectionId,
        };
        
        if (isUpdate) {
          setSavedRequests(prev => prev.map(r => r.id === request.id ? newSavedReq : r));
        } else {
          setSavedRequests([...savedRequests, newSavedReq]);
        }
        // Update the tab with the saved request, always using the saved request ID
        // This ensures the Update button shows correctly for saved requests
        setRequestTabs(prev => prev.map(tab => 
          tab.id === activeTabId ? { 
            ...tab, 
            request: { 
              ...newSavedReq, 
              id: newSavedReq.id, // Always use saved request ID so Update button works correctly
            } 
          } : tab
        ));
        setShowSaveRequestModal(false);
        setExpandedCollections(prev => new Set(prev).add(selectedCollectionId));
      } catch (err) {
        console.error('Save request error:', err);
        alert('Unable to save request');
      }
  };

  // Environment Handlers
  const handleCreateEnvironment = async () => {
    const activeWs = getActiveWorkspace();
    if (!activeWs.backendId) {
      alert('Cannot create environment in Personal Workspace');
      return;
    }
    
    try {
      const env = await apiService.saveEnvironment({
        workspaceId: activeWs.backendId,
        name: 'New Environment',
        variables: [],
      });
      const newEnv: Environment = {
        id: `env_${env.id}`,
        name: env.name,
        variables: env.variables || [],
      };
      setEnvironments([...environments, newEnv]);
      setEditingEnvId(newEnv.id);
    } catch (err) {
      console.error('Create environment error:', err);
      alert('Unable to create environment');
    }
  };

  const updateEnvironment = async (id: string, updates: Partial<Environment>) => {
    const activeWs = getActiveWorkspace();
    if (!activeWs.backendId) {
      // Personal workspace - just update state
      setEnvironments(envs => envs.map(e => e.id === id ? { ...e, ...updates } : e));
      return;
    }
    
    const env = environments.find(e => e.id === id);
    if (!env) return;
    
    const backendId = parseInt(id.replace('env_', ''));
    try {
      await apiService.saveEnvironment({
        id: backendId,
        workspaceId: activeWs.backendId,
        name: updates.name || env.name,
        variables: updates.variables || env.variables,
      });
      setEnvironments(envs => envs.map(e => e.id === id ? { ...e, ...updates } : e));
    } catch (err) {
      console.error('Update environment error:', err);
      alert('Unable to update environment');
    }
  };

  const deleteEnvironment = async (id: string) => {
    const activeWs = getActiveWorkspace();
    if (!activeWs.backendId) {
      setEnvironments(envs => envs.filter(e => e.id !== id));
      if (activeEnvId === id) setActiveEnvId(null);
      if (editingEnvId === id) setEditingEnvId(null);
      return;
    }
    
    const backendId = parseInt(id.replace('env_', ''));
    try {
      await apiService.deleteEnvironment(backendId);
      setEnvironments(envs => envs.filter(e => e.id !== id));
      if (activeEnvId === id) setActiveEnvId(null);
      if (editingEnvId === id) setEditingEnvId(null);
    } catch (err) {
      console.error('Delete environment error:', err);
      alert('Unable to delete environment');
    }
  };

  const handleSendRequest = async () => {
    setLoading(true);
    setRequestTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, response: null } : tab
    ));
    
    const activeWs = getActiveWorkspace();
    const timestamp = Date.now();
    const newHistoryItem: HistoryItem = {
      id: `hist_${timestamp}`,
      workspaceId: activeWorkspaceId,
      timestamp,
      request: { ...request }, // snapshot
    };

    try {
      // Get current environment variables
      const activeEnv = environments.find(e => e.id === activeEnvId);
      const envVars = activeEnv ? activeEnv.variables : [];

      const result = await executeRequest(request, envVars);
      setRequestTabs(prev => prev.map(tab => 
        tab.id === activeTabId ? { ...tab, response: result } : tab
      ));
      
      // Save to backend history if workspace has backendId
      if (activeWs.backendId && user?.backendId) {
        try {
          await apiService.addHistoryItem(activeWs.backendId, user.backendId, request, result.statusCode);
        } catch (histErr) {
          console.error('Failed to save history:', histErr);
        }
      }
      
      // Update local history
      setHistory(prev => {
        const updated = [{ ...newHistoryItem, responseStatus: result.statusCode }, ...prev];
        const sliced = updated.slice(0, 50); // Keep last 50
        return sliced;
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const restoreRequest = (req: ApiRequest) => {
    // Check if this request is already open in a tab
    // For saved requests, check by the original request ID
    const isSavedRequest = req.id && (req.id.toString().startsWith('req_') || !isNaN(Number(req.id)));
    
    if (isSavedRequest) {
      // Check if a tab with this saved request ID already exists
      const existingTab = requestTabs.find(tab => {
        const tabRequestId = tab.request.id;
        return tabRequestId === req.id || 
               (tabRequestId.toString().startsWith('req_') && tabRequestId === req.id) ||
               (req.id.toString().startsWith('req_') && tabRequestId === req.id);
      });
      
      if (existingTab) {
        // Switch to the existing tab instead of creating a new one
        setActiveTabId(existingTab.id);
        return;
      }
    }
    
    // Create a new tab with the restored request
    // Preserve the original request ID if it's a saved request
    const newTabId = isSavedRequest ? req.id.toString() : `tab_${Date.now()}`;
    const restoredRequest = { 
      ...DEFAULT_REQUEST,
      ...req, 
      id: newTabId,
      useProxy: req.useProxy ?? false 
    };
    setRequestTabs(prev => [...prev, { id: newTabId, request: restoredRequest, response: null }]);
    setActiveTabId(newTabId);
  };

  const filteredHistory = history.filter(h => 
    h.workspaceId === activeWorkspaceId || 
    (!h.workspaceId && activeWorkspaceId === DEFAULT_WORKSPACE.id)
  );

  const filteredCollections = collections.filter(c => c.workspaceId === activeWorkspaceId);
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || DEFAULT_WORKSPACE;
  const activeEnvironment = environments.find(e => e.id === activeEnvId);
  const activeEnvVars = activeEnvironment?.variables || [];

  if (!isInitialized) {
      return <div className="min-h-screen bg-background flex items-center justify-center text-textSecondary">Loading CommunicateX...</div>;
  }

  // Auth Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-12">
            <h1 className="text-6xl font-bold text-white tracking-tight mb-4">
              CommunicateX<span className="text-primary">.</span>
            </h1>
            <p className="text-textSecondary text-lg leading-relaxed">
              Experience the power of a professional REST API client. 
              Master your endpoints in an ever-evolving tech landscape.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-3 mb-8">
               <div className="p-2 bg-surfaceHighlight rounded-lg text-primary">
                  <Zap size={20} />
               </div>
               <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Authentication</span>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder-zinc-600"
                  placeholder="user@communicatex.dev"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder-zinc-600"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-4 bg-primary hover:bg-primaryHover disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all glow-primary mt-2"
              >
                {authLoading
                  ? (isLogin ? 'Signing in...' : 'Creating account...')
                  : (isLogin ? 'Enter CommunicateX' : 'Join CommunicateX')}
              </button>
            </form>

            {authError && (
              <div className="mt-4 text-sm text-danger">
                {authError}
              </div>
            )}

            <div className="mt-8 text-center pt-6 border-t border-border">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-textSecondary hover:text-white transition-colors"
              >
                {isLogin ? "New here? Create an account." : "Have credentials? Sign in."}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main App Layout
  return (
    <div className="flex h-screen bg-background text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-72 bg-surface border-r border-border flex flex-col relative z-10">
        {/* Workspace Switcher Header */}
        <div className="p-4 border-b border-border relative">
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
               className="flex-1 flex items-center justify-between p-2 rounded-lg hover:bg-surfaceLight transition-colors group"
             >
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-surfaceHighlight border border-border flex items-center justify-center text-primary">
                   <Box size={18} />
                 </div>
                 <div className="flex flex-col items-start">
                   <span className="text-xs text-textSecondary font-medium">Workspace</span>
                   <span className="text-sm font-bold text-white truncate max-w-[140px]">{activeWorkspace.name}</span>
                 </div>
               </div>
               <ChevronDown size={16} className={`text-textSecondary transition-transform ${showWorkspaceMenu ? 'rotate-180' : ''}`} />
             </button>
             {activeWorkspaceId !== DEFAULT_WORKSPACE.id && (
               <button
                 onClick={() => setShowInviteModal(true)}
                 className="p-2 rounded-lg text-textSecondary hover:text-primary hover:bg-surfaceLight transition-colors"
                 title="Invite a collaborator to this workspace"
               >
                 <Mail size={16} />
               </button>
             )}
           </div>

           {/* Dropdown Menu */}
           {showWorkspaceMenu && (
             <>
               <div className="fixed inset-0 z-10" onClick={() => setShowWorkspaceMenu(false)}></div>
               <div className="absolute top-full left-4 right-4 mt-2 bg-surfaceHighlight border border-border rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {workspaces.map(ws => (
                      <div
                        key={ws.id}
                        className={`group flex items-center gap-2 p-2.5 rounded-lg mb-1 transition-colors ${activeWorkspaceId === ws.id ? 'bg-surfaceLight' : 'hover:bg-surfaceLight/50'}`}
                      >
                        <button
                          onClick={async () => {
                            setActiveWorkspaceId(ws.id);
                            setShowWorkspaceMenu(false);
                            // Load workspace data from backend
                            if (ws.backendId && user?.backendId) {
                              try {
                                const [cols, reqs, envs, hist] = await Promise.all([
                                  apiService.getCollections(ws.backendId),
                                  apiService.getSavedRequests(ws.backendId),
                                  apiService.getEnvironments(ws.backendId),
                                  apiService.getHistory(ws.backendId),
                                ]);
                                
                                setCollections(cols.map((c: any) => ({
                                  id: `col_${c.id}`,
                                  workspaceId: ws.id,
                                  name: c.name,
                                  createdAt: c.createdAt,
                                })));
                                
                                setSavedRequests(reqs.map((r: any) => ({
                                  ...r,
                                  id: String(r.id) || `req_${Date.now()}`,
                                  workspaceId: ws.id,
                                  collectionId: r.collectionId ? `col_${r.collectionId}` : undefined,
                                })));
                                
                                setEnvironments(envs.map((e: any) => ({
                                  id: `env_${e.id}`,
                                  name: e.name,
                                  variables: e.variables || [],
                                })));
                                
                                setHistory(hist.map((h: any) => ({
                                  ...h,
                                  id: h.id || `hist_${Date.now()}`,
                                  workspaceId: ws.id,
                                })));
                                
                                // Load preferences to set active env
                                const prefs = await apiService.getPreferences(user.backendId);
                                if (prefs.activeEnvId) {
                                  const prefEnv = envs.find((e: any) => e.id === prefs.activeEnvId);
                                  if (prefEnv) {
                                    setActiveEnvId(`env_${prefEnv.id}`);
                                  }
                                }
                              } catch (err) {
                                console.error('Failed to load workspace data:', err);
                              }
                            } else {
                              // Default workspace - clear backend data
                              setCollections([]);
                              setSavedRequests([]);
                              setEnvironments([]);
                              setHistory([]);
                              setActiveEnvId(null);
                            }
                          }}
                          className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all ${
                            activeWorkspaceId === ws.id 
                              ? 'text-white font-medium' 
                              : 'text-textSecondary hover:text-white'
                          }`}
                        >
                          <span>{ws.name}</span>
                          {activeWorkspaceId === ws.id && <Check size={14} className="text-primary" />}
                        </button>
                        {ws.id !== DEFAULT_WORKSPACE.id && ws.backendId && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Are you sure you want to delete "${ws.name}"? This will permanently delete all collections, requests, environments, and history in this workspace.`)) {
                                return;
                              }
                              
                              if (!user?.backendId) return;
                              
                              try {
                                const res = await fetch(`${API_BASE_URL}/workspaces/${ws.backendId}`, {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: user.backendId }),
                                });
                                
                                const data = await res.json();
                                if (res.ok && data.success) {
                                  // Remove from workspaces list
                                  const updatedWorkspaces = workspaces.filter(w => w.id !== ws.id);
                                  setWorkspaces(updatedWorkspaces);
                                  
                                  // If deleted workspace was active, switch to default or first available
                                  if (activeWorkspaceId === ws.id) {
                                    const newActive = updatedWorkspaces.find(w => w.id === DEFAULT_WORKSPACE.id) || updatedWorkspaces[0];
                                    if (newActive) {
                                      setActiveWorkspaceId(newActive.id);
                                      // Load data for new active workspace
                                      if (newActive.backendId && user.backendId) {
                                        const [cols, reqs, envs, hist] = await Promise.all([
                                          apiService.getCollections(newActive.backendId),
                                          apiService.getSavedRequests(newActive.backendId),
                                          apiService.getEnvironments(newActive.backendId),
                                          apiService.getHistory(newActive.backendId),
                                        ]);
                                        
                                        setCollections(cols.map((c: any) => ({
                                          id: `col_${c.id}`,
                                          workspaceId: newActive.id,
                                          name: c.name,
                                          createdAt: c.createdAt,
                                        })));
                                        
                                        setSavedRequests(reqs.map((r: any) => ({
                                          ...r,
                                          id: String(r.id) || `req_${Date.now()}`,
                                          workspaceId: newActive.id,
                                          collectionId: r.collectionId ? `col_${r.collectionId}` : undefined,
                                        })));
                                        
                                        setEnvironments(envs.map((e: any) => ({
                                          id: `env_${e.id}`,
                                          name: e.name,
                                          variables: e.variables || [],
                                        })));
                                        
                                        setHistory(hist.map((h: any) => ({
                                          ...h,
                                          id: h.id || `hist_${Date.now()}`,
                                          workspaceId: newActive.id,
                                        })));
                                      } else {
                                        setCollections([]);
                                        setSavedRequests([]);
                                        setEnvironments([]);
                                        setHistory([]);
                                        setActiveEnvId(null);
                                      }
                                    }
                                  }
                                  
                                  setShowWorkspaceMenu(false);
                                } else {
                                  alert(data?.error || 'Failed to delete workspace');
                                }
                              } catch (err) {
                                console.error('Delete workspace error:', err);
                                alert('Unable to delete workspace');
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 text-textSecondary hover:text-danger transition-opacity p-1.5 rounded hover:bg-surfaceLight/30"
                            title="Delete workspace"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-border/50 bg-surfaceLight/20">
                    <button
                      onClick={() => {
                        setShowCreateWorkspaceModal(true);
                        setShowWorkspaceMenu(false);
                      }} 
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus size={14} />
                      <span>New Workspace</span>
                    </button>
                  </div>
               </div>
             </>
           )}
        </div>

        {/* Environment Section - Collapsible */}
        <div className="border-b border-border/50 bg-surface">
          <div className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surfaceLight/30 transition-colors group">
            <button
              onClick={() => setIsEnvExpanded(!isEnvExpanded)}
              className="flex-1 flex items-center gap-2 text-left"
            >
              <ChevronRight size={14} className={`text-textSecondary transition-transform ${isEnvExpanded ? 'rotate-90' : ''}`} />
              <Database size={14} className={activeEnvId ? "text-primary" : "text-textSecondary"} />
              <span className="text-xs font-semibold uppercase tracking-wider text-textSecondary">Environment</span>
              {activeEnvId && (
                <span className="text-xs text-primary font-medium truncate max-w-[100px]">
                  ({environments.find(e => e.id === activeEnvId)?.name || 'Active'})
                </span>
              )}
            </button>
            {activeWorkspaceId !== DEFAULT_WORKSPACE.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateEnvironment();
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-textSecondary hover:text-primary transition-opacity rounded hover:bg-surfaceLight/30"
                title="New Environment"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
          
          {isEnvExpanded && (
            <div className="px-4 pb-3 space-y-1.5">
              <button
                onClick={() => setActiveEnvId(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                  !activeEnvId 
                    ? 'bg-surfaceLight/80 text-white shadow-sm' 
                    : 'text-textSecondary hover:text-white hover:bg-surfaceLight/30'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Database size={13} className={!activeEnvId ? "text-primary" : "text-textSecondary"} />
                  <span className="font-medium">No Environment</span>
                </span>
                {!activeEnvId && <Check size={13} className="text-primary" />}
              </button>
              {environments.map(env => (
                <button
                  key={env.id}
                  onClick={() => setActiveEnvId(env.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all group ${
                    activeEnvId === env.id 
                      ? 'bg-surfaceLight/80 text-white shadow-sm' 
                      : 'text-textSecondary hover:text-white hover:bg-surfaceLight/30'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Database size={13} className={activeEnvId === env.id ? "text-primary" : "text-textSecondary"} />
                    <span className="font-medium truncate">{env.name}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeEnvId === env.id && <Check size={13} className="text-primary" />}
                    {activeWorkspaceId !== DEFAULT_WORKSPACE.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEnvId(env.id);
                          setShowEnvModal(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-textSecondary hover:text-primary transition-opacity rounded hover:bg-surfaceLight/30"
                        title="Edit environment"
                      >
                        <Settings size={11} />
                      </button>
                    )}
                  </div>
                </button>
              ))}
              {environments.length === 0 && activeWorkspaceId !== DEFAULT_WORKSPACE.id && (
                <div className="text-[10px] text-textSecondary px-3 py-2 italic text-center">
                  No environments. Create one to manage variables.
                </div>
              )}
              {activeWorkspaceId !== DEFAULT_WORKSPACE.id && environments.length > 0 && (
                <button
                  onClick={() => setShowEnvModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mt-2 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/30"
                >
                  <Settings size={11} />
                  Manage Environments
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar View Switcher */}
        <div className="flex p-2 gap-1 border-b border-border/50 bg-surface">
            <button 
                onClick={() => setSidebarView('collections')}
                className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${
                  sidebarView === 'collections' 
                    ? 'bg-surfaceHighlight text-primary' 
                    : 'text-textSecondary hover:text-white hover:bg-surfaceLight/30'
                }`}
                title="Collections"
            >
                <Folder size={16} />
            </button>
            <button 
                onClick={() => setSidebarView('history')}
                className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${
                  sidebarView === 'history' 
                    ? 'bg-surfaceHighlight text-primary' 
                    : 'text-textSecondary hover:text-white hover:bg-surfaceLight/30'
                }`}
                title="History"
            >
                <Clock size={16} />
            </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
          
          {/* HISTORY VIEW */}
          {sidebarView === 'history' && (
             <ul className="space-y-2">
               {filteredHistory.map((item) => (
                 <li key={item.id}>
                   <button 
                     onClick={() => restoreRequest(item.request)}
                     className="w-full text-left p-3 rounded-lg hover:bg-surfaceLight/50 border border-transparent hover:border-border/50 transition-all group relative overflow-hidden"
                   >
                     <div className="flex items-center justify-between mb-2">
                       <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                         item.request.method === 'GET' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                         item.request.method === 'POST' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                         item.request.method === 'DELETE' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                         'bg-orange-500/10 border-orange-500/20 text-orange-400'
                       }`}>
                         {item.request.method}
                       </span>
                       <span className={`text-[10px] font-mono font-semibold ${item.responseStatus && item.responseStatus >= 400 ? 'text-danger' : 'text-success'}`}>
                         {item.responseStatus || '...'}
                       </span>
                     </div>
                     <div className="text-xs text-zinc-300 truncate font-medium group-hover:text-white transition-colors">
                       {item.request.url.replace(/^https?:\/\//, '')}
                     </div>
                   </button>
                 </li>
               ))}
               {filteredHistory.length === 0 && (
                  <li className="p-8 text-center border border-dashed border-border/50 rounded-lg">
                   <p className="text-xs text-textSecondary">No history in this workspace.</p>
                 </li>
               )}
             </ul>
          )}

          {/* COLLECTIONS VIEW */}
          {sidebarView === 'collections' && (
             <div className="space-y-3">
                 {activeWorkspaceId !== DEFAULT_WORKSPACE.id && (
                   <button 
                      onClick={() => setShowCreateCollectionModal(true)}
                      className="w-full flex items-center justify-center p-2 border border-dashed border-border/50 rounded-lg text-textSecondary hover:text-primary hover:border-primary/50 hover:bg-surfaceLight/20 transition-all"
                      title="New Collection"
                   >
                      <Plus size={16} />
                   </button>
                 )}

                 {filteredCollections.length === 0 && (
                     <div className="text-center text-xs text-textSecondary italic py-6">Create a collection to organize your requests.</div>
                 )}

                 {filteredCollections.map(col => {
                     const isExpanded = expandedCollections.has(col.id);
                     const colRequests = savedRequests.filter(r => r.collectionId === col.id);
                     
                     return (
                         <div key={col.id} className="group/col">
                             <div 
                                className="flex items-center justify-between mb-2 p-2 rounded-lg hover:bg-surfaceLight/30 group/header transition-colors"
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setCollectionContextMenu({ x: e.clientX, y: e.clientY, collectionId: col.id });
                                }}
                             >
                                 <button 
                                    onClick={() => toggleCollection(col.id)}
                                    className="flex items-center gap-2.5 flex-1 overflow-hidden"
                                 >
                                     <ChevronRight size={14} className={`text-textSecondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                     {isExpanded ? <FolderOpen size={16} className="text-primary" /> : <Folder size={16} className="text-primary/70" />}
                                     <span className="text-sm font-medium text-zinc-300 truncate">{col.name}</span>
                                 </button>
                                 <button 
                                    onClick={() => deleteCollection(col.id)}
                                    className="opacity-0 group-hover/header:opacity-100 text-textSecondary hover:text-danger transition-opacity p-1.5 rounded hover:bg-surfaceLight/50"
                                 >
                                    <Trash2 size={13} />
                                 </button>
                             </div>

                             {isExpanded && (
                                 <div className="pl-5 border-l border-border/30 ml-3 space-y-1">
                                     {colRequests.length === 0 && (
                                         <div className="text-[10px] text-textSecondary pl-4 py-2 italic">Empty collection</div>
                                     )}
                                     {colRequests.filter(req => req && req.id).map(req => (
                                         <div key={req.id} className="flex items-center group/req">
                                            <button
                                               onClick={() => restoreRequest(req)}
                                               className={`flex-1 flex items-center gap-2.5 p-2 rounded-lg hover:bg-surfaceLight/50 text-left overflow-hidden transition-all ${request.id === req.id ? 'bg-surfaceLight/50 ring-1 ring-border/50' : ''}`}
                                            >
                                                <span className={`text-[9px] font-bold w-9 text-center rounded px-1 py-0.5 ${
                                                    req.method === 'GET' ? 'text-blue-400 bg-blue-400/10' :
                                                    req.method === 'POST' ? 'text-emerald-400 bg-emerald-400/10' :
                                                    req.method === 'DELETE' ? 'text-red-400 bg-red-400/10' :
                                                    'text-orange-400 bg-orange-400/10'
                                                }`}>
                                                    {req.method}
                                                </span>
                                                <span className="text-xs text-zinc-300 truncate font-medium">{req.name}</span>
                                            </button>
                                            <button 
                                                onClick={() => deleteSavedRequest(req.id)}
                                                className="opacity-0 group-hover/req:opacity-100 p-1.5 text-textSecondary hover:text-danger rounded transition-opacity hover:bg-surfaceLight/30"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     );
                 })}
             </div>
          )}

        </div>

        {/* User Footer */}
        <div className="p-4 mx-4 mb-4 mt-auto bg-surfaceLight/50 border border-border/50 rounded-xl">
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-orange-900/20">
                {user.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">{user.name}</span>
                <span className="text-[10px] text-textSecondary">Pro Plan</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (user) fetchInvitations(user.email);
                  setShowInboxModal(true);
                }}
                className="text-textSecondary hover:text-primary transition-colors p-2 hover:bg-white/5 rounded-md relative"
                title="View invitations"
              >
                <Mail size={16} />
                {invitations.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-danger rounded-full text-[8px] flex items-center justify-center text-white font-bold">
                    {invitations.length}
                  </span>
                )}
              </button>
              <button 
                onClick={handleLogout}
                className="text-textSecondary hover:text-white transition-colors p-2 hover:bg-white/5 rounded-md"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative z-20">
        {/* Background gradient spot */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-surfaceHighlight/20 to-transparent pointer-events-none"></div>
        

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden z-0">
          {/* Request Tabs Bar */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg overflow-x-auto custom-scrollbar">
            {requestTabs.map((tab) => (
              <div
                key={tab.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-md transition-all min-w-[100px] max-w-[180px] relative ${
                  activeTabId === tab.id
                    ? 'bg-surfaceLight/80 text-white'
                    : 'text-textSecondary hover:text-white hover:bg-surfaceLight/30'
                }`}
                onClick={() => setActiveTabId(tab.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                }}
              >
                {activeTabId === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                )}
                <span className={`text-xs font-medium truncate flex-1 ${
                  activeTabId === tab.id ? 'text-white' : 'text-textSecondary'
                }`}>
                  {tab.request.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-surfaceLight/50 rounded transition-all flex-shrink-0"
                  title="Close tab"
                >
                  <X size={12} className="text-textSecondary hover:text-white" />
                </button>
              </div>
            ))}
            <button
              onClick={createNewTab}
              className="px-2 py-2 text-textSecondary hover:text-white hover:bg-surfaceLight/30 rounded-md transition-all flex items-center justify-center flex-shrink-0"
              title="New Request"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Context Menu */}
          {contextMenu && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setContextMenu(null)}
              />
              <div
                className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <button
                  onClick={() => {
                    const tab = requestTabs.find(t => t.id === contextMenu.tabId);
                    if (tab) {
                      const newName = prompt('Rename request:', tab.request.name);
                      if (newName) renameTab(contextMenu.tabId, newName);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                >
                  <Edit size={14} />
                  Rename Request
                </button>
                <button
                  onClick={() => {
                    duplicateTab(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                >
                  <Copy size={14} />
                  Duplicate Tab
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => {
                    closeTab(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                >
                  <X size={14} />
                  Close Tab
                </button>
                <button
                  onClick={() => {
                    closeOtherTabs(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                >
                  <X size={14} />
                  Close Other Tabs
                </button>
              </div>
            </>
          )}

          {/* Collection Context Menu */}
          {collectionContextMenu && (
            <>
              <div
                className="fixed inset-0 z-[55]"
                onClick={() => setCollectionContextMenu(null)}
              />
              <div
                className="fixed z-[60] bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
                style={{ left: collectionContextMenu.x, top: collectionContextMenu.y }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const collection = collections.find(c => c.id === collectionContextMenu.collectionId);
                    if (collection && activeWorkspaceId !== DEFAULT_WORKSPACE.id) {
                      const newTabId = `tab_${Date.now()}`;
                      const newRequest: ApiRequest = {
                        ...DEFAULT_REQUEST,
                        id: newTabId,
                        name: 'New Request',
                      };
                      setRequestTabs(prev => [...prev, { id: newTabId, request: newRequest, response: null }]);
                      setActiveTabId(newTabId);
                      setSelectedCollectionId(collectionContextMenu.collectionId);
                    }
                    setCollectionContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                >
                  <Plus size={14} />
                  New Request
                </button>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Rename button clicked!');
                    
                    const collection = collections.find(c => c.id === collectionContextMenu.collectionId);
                    console.log('Found collection:', collection, 'collectionId:', collectionContextMenu.collectionId);
                    
                    if (!collection) {
                      console.error('Collection not found:', collectionContextMenu.collectionId);
                      setCollectionContextMenu(null);
                      return;
                    }
                    
                    if (activeWorkspaceId === DEFAULT_WORKSPACE.id) {
                      alert('Cannot rename collections in the default workspace');
                      setCollectionContextMenu(null);
                      return;
                    }
                    
                    const newName = prompt('Rename collection:', collection.name);
                    if (!newName || !newName.trim()) {
                      setCollectionContextMenu(null);
                      return;
                    }
                    
                    if (newName.trim() === collection.name) {
                      setCollectionContextMenu(null);
                      return;
                    }
                    
                    try {
                      const backendId = parseInt(collection.id.replace('col_', ''));
                      console.log('Renaming collection:', { collectionId: collection.id, backendId, newName: newName.trim() });
                      
                      if (isNaN(backendId)) {
                        throw new Error(`Invalid collection ID: ${collection.id}`);
                      }
                      
                      const updated = await apiService.updateCollection(backendId, newName.trim());
                      console.log('Collection renamed successfully:', updated);
                      
                      setCollections(prev => prev.map(c => 
                        c.id === collection.id ? { ...c, name: newName.trim() } : c
                      ));
                    } catch (err) {
                      console.error('Rename collection error:', err);
                      alert(`Unable to rename collection: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                    setCollectionContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors cursor-pointer"
                >
                  <Edit size={14} />
                  Rename Collection
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCollection(collectionContextMenu.collectionId);
                    setCollectionContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:text-danger hover:bg-surfaceLight transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Collection
                </button>
              </div>
            </>
          )}

          <div className="flex gap-4 overflow-hidden flex-1">
          {/* Request Panel (Left/Top) */}
          <div className="w-1/2 flex flex-col min-w-[400px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden relative">
            <RequestPanel 
              request={request}
              onRequestChange={handleRequestChange}
              onSend={handleSendRequest}
              onSave={openSaveRequestModal}
              loading={loading}
              environmentVariables={activeEnvVars}
              isSavedRequest={!!(request.id && savedRequests.find(r => r.id === request.id))}
            />
          </div>
          
          {/* Response Panel (Right/Bottom) */}
          <div className="w-1/2 flex flex-col min-w-[400px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
             <ResponsePanel response={response} loading={loading} />
          </div>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
             <h2 className="text-xl font-bold text-white mb-1">Create Workspace</h2>
             <p className="text-sm text-textSecondary mb-6">Separate your personal and work API collections.</p>
             
             <form onSubmit={handleCreateWorkspace}>
               <div className="mb-6">
                 <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Workspace Name</label>
                 <input 
                    type="text" 
                    autoFocus
                    required
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Project Alpha"
                 />
               </div>
               <div className="flex justify-end gap-3">
                 <button 
                   type="button"
                   onClick={() => setShowCreateWorkspaceModal(false)}
                   className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit"
                   className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primaryHover transition-colors shadow-lg shadow-orange-900/20"
                 >
                   Create Workspace
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}
      
      {/* Create Collection Modal */}
      {showCreateCollectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
             <h2 className="text-xl font-bold text-white mb-1">New Collection</h2>
             <p className="text-sm text-textSecondary mb-6">Group your requests into folders.</p>
             
             <form onSubmit={handleCreateCollection}>
               <div className="mb-6">
                 <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Collection Name</label>
                 <input 
                    type="text" 
                    autoFocus
                    required
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Auth APIs"
                 />
               </div>
               <div className="flex justify-end gap-3">
                 <button 
                   type="button"
                   onClick={() => setShowCreateCollectionModal(false)}
                   className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit"
                   className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primaryHover transition-colors shadow-lg shadow-orange-900/20"
                 >
                   Create
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* Inbox Modal - View Pending Invitations */}
      {showInboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-primary" />
                <h2 className="text-xl font-bold text-white">Invitations</h2>
                {invitations.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded-full">
                    {invitations.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowInboxModal(false)}
                className="text-textSecondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 max-h-96">
              {inboxLoading ? (
                <div className="flex items-center justify-center py-8 text-textSecondary">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/30 border-t-primary"></div>
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-12 text-textSecondary">
                  <Mail size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No pending invitations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="bg-surfaceLight border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-white mb-1">{inv.workspaceName}</h3>
                          <p className="text-xs text-textSecondary">
                            Invited by <span className="text-white font-medium">{inv.inviterName}</span>
                          </p>
                          <p className="text-xs text-textSecondary mt-1">
                            Role: <span className="text-white">{inv.role === 'member' ? 'Member' : 'Viewer'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleAcceptInvitation(inv.id)}
                          disabled={inboxLoading}
                          className="flex-1 px-3 py-2 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvitation(inv.id)}
                          disabled={inboxLoading}
                          className="px-3 py-2 bg-surfaceHighlight hover:bg-surfaceLight text-textSecondary hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite User to Workspace Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-white mb-1">Invite to Workspace</h2>
            <p className="text-sm text-textSecondary mb-6">
              Share <span className="font-semibold text-white">{activeWorkspace.name}</span> with another user.
            </p>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">
                  User Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-zinc-600"
                  placeholder="collaborator@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'member' | 'viewer')}
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="member">Member (can edit)</option>
                  <option value="viewer">Viewer (read only)</option>
                </select>
              </div>

              {inviteError && (
                <div className="text-sm text-danger">
                  {inviteError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError(null);
                    setInviteLoading(false);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading || !inviteEmail}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primaryHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Request Modal */}
      {showSaveRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
             <div className="flex items-center gap-2 mb-1 text-primary">
                 <Save size={20} />
                 <h2 className="text-xl font-bold text-white">
                   {request.id && savedRequests.find(r => r.id === request.id) ? 'Update Request' : 'Save Request'}
                 </h2>
             </div>
             <p className="text-sm text-textSecondary mb-6">
               {request.id && savedRequests.find(r => r.id === request.id) 
                 ? 'Update this saved request with your changes.' 
                 : 'Save this request to a collection for later use.'}
             </p>
             
             <form onSubmit={handleSaveRequest}>
               <div className="mb-4">
                 <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Request Name</label>
                 <input 
                    type="text" 
                    autoFocus
                    required
                    value={saveRequestName}
                    onChange={(e) => setSaveRequestName(e.target.value)}
                    className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Get User Profile"
                 />
               </div>
               
               <div className="mb-6">
                 <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider">Collection</label>
                    <button 
                        type="button" 
                        onClick={() => setShowCreateCollectionModal(true)}
                        className="text-xs text-primary hover:underline"
                    >
                        + Create New
                    </button>
                 </div>
                 {filteredCollections.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-lg p-2 bg-surfaceLight/30">
                        {filteredCollections.map(col => (
                            <label key={col.id} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-surfaceLight transition-colors">
                                <input 
                                    type="radio"
                                    name="collection"
                                    value={col.id}
                                    checked={selectedCollectionId === col.id}
                                    onChange={() => setSelectedCollectionId(col.id)}
                                    className="accent-primary"
                                />
                                <div className="flex items-center gap-2">
                                    <Folder size={14} className="text-textSecondary" />
                                    <span className="text-sm font-medium">{col.name}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                 ) : (
                    <div className="p-4 border border-dashed border-border rounded-lg text-center">
                        <p className="text-xs text-textSecondary mb-2">No collections in this workspace.</p>
                        <button 
                            type="button"
                            onClick={() => setShowCreateCollectionModal(true)}
                            className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20"
                        >
                            Create Collection
                        </button>
                    </div>
                 )}
               </div>

               <div className="flex justify-end gap-3">
                 <button 
                   type="button"
                   onClick={() => setShowSaveRequestModal(false)}
                   className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-white hover:bg-surfaceLight transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit"
                   disabled={!selectedCollectionId}
                   className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primaryHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {request.id && savedRequests.find(r => r.id === request.id) ? 'Update' : 'Save'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* Environment Manager Modal */}
      {showEnvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
           <div className="w-full max-w-4xl h-[600px] bg-surface border border-border rounded-2xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95">
              
              {/* Sidebar List */}
              <div className="w-64 bg-surfaceLight border-r border-border flex flex-col">
                 <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Environments</h2>
                    <button onClick={handleCreateEnvironment} className="text-primary hover:text-primaryHover">
                       <Plus size={18} />
                    </button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2">
                    {environments.length === 0 && (
                      <div className="p-4 text-center text-xs text-textSecondary italic">No environments created.</div>
                    )}
                    {environments.map(env => (
                      <button
                        key={env.id}
                        onClick={() => setEditingEnvId(env.id)}
                        className={`w-full text-left p-3 rounded-lg text-sm mb-1 flex items-center justify-between group ${editingEnvId === env.id ? 'bg-surface border border-primary/30 text-white' : 'text-textSecondary hover:bg-surface/50 hover:text-white'}`}
                      >
                         <span className="truncate">{env.name}</span>
                         {editingEnvId === env.id && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                      </button>
                    ))}
                 </div>
              </div>

              {/* Edit Area */}
              <div className="flex-1 flex flex-col bg-surface">
                 {editingEnvId ? (
                   <>
                     {(() => {
                        const env = environments.find(e => e.id === editingEnvId)!;
                        return (
                          <>
                             <div className="p-6 border-b border-border flex justify-between items-center">
                                <div className="flex-1 mr-8">
                                   <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-1">Environment Name</label>
                                   <input 
                                      type="text" 
                                      value={env.name}
                                      onChange={(e) => updateEnvironment(env.id, { name: e.target.value })}
                                      className="w-full bg-transparent text-xl font-bold text-white focus:outline-none border-b border-transparent focus:border-primary pb-1"
                                   />
                                </div>
                                <button 
                                  onClick={() => deleteEnvironment(env.id)}
                                  className="text-textSecondary hover:text-danger p-2 hover:bg-danger/10 rounded-lg transition-colors"
                                  title="Delete Environment"
                                >
                                   <Trash2 size={18} />
                                </button>
                             </div>
                             <div className="flex-1 p-6 overflow-hidden">
                                <KeyValueEditor 
                                  title="Environment Variables" 
                                  items={env.variables} 
                                  onChange={(newVars) => updateEnvironment(env.id, { variables: newVars })}
                                />
                             </div>
                          </>
                        )
                     })()}
                   </>
                 ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-textSecondary opacity-50">
                      <Database size={48} className="mb-4" strokeWidth={1} />
                      <p>Select or create an environment to configure variables.</p>
                   </div>
                 )}
                 <div className="p-4 border-t border-border flex justify-end">
                    <button 
                      onClick={() => setShowEnvModal(false)}
                      className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors"
                    >
                      Done
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;