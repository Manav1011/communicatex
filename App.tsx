import React, { useState, useEffect } from 'react';
import { ApiRequest, ApiResponse, HttpMethod, AuthMethod, HistoryItem, User, MOCK_USER, Workspace, Environment, KeyValueItem, Collection, SavedRequest, Invitation, Toast } from './types';
import { parseCurl } from './services/curlParser';
import { executeRequest } from './services/apiExecutor';
import { apiService, API_BASE_URL } from './services/api';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import KeyValueEditor from './components/KeyValueEditor';
import CommandPalette from './components/CommandPalette';
import { parseOpenApi } from './services/openApiParser';
import { History, LogOut, Zap, LayoutGrid, Clock, ChevronDown, ChevronRight, Plus, Check, Box, Database, Trash2, Settings, Folder, Save, MoreVertical, FolderOpen, FileText, Mail, X, Copy, Edit, ExternalLink, Columns, Rows, Sun, Moon, SunDim, Search, Palette, Globe, Download, PanelLeftOpen, PanelLeftClose, Bot } from 'lucide-react';
import { saveResponseToDB, getResponseFromDB, deleteResponseFromDB } from './services/storage';
import { generateOpenApi } from './services/openApiGenerator';

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
  useProxy: true,
  testCases: [],
  postRequestScript: ''
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const activeTab = requestTabs.find(tab => tab.id === activeTabId) || requestTabs[0];
  const request = activeTab?.request || DEFAULT_REQUEST;
  const response = activeTab?.response || null;
  const [loading, setLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal');
  type Theme = 'dark' | 'light' | 'midnight' | 'aubergine' | 'nord' | 'forest' | 'hacker' | 'dream-orange';
  const [theme, setTheme] = useState<Theme>('dark');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(380);
  const [showSidebar, setShowSidebar] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Filtering & Dirty State Logic
  const filteredHistory = history.filter(h =>
    h.request.url.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
    h.request.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
    h.request.method.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  const filteredCollections = collections.filter(c =>
    c.workspaceId === activeWorkspaceId &&
    (c.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
      savedRequests.some(r => r.collectionId === c.id && r.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())))
  );

  const isTabDirty = (tabId: string) => {
    const tab = requestTabs.find(t => t.id === tabId);
    if (!tab) return false;
    const saved = savedRequests.find(r => r.id === tab.request.id);
    if (!saved) {
      // For new requests, check if they differ from default
      return tab.request.name !== 'New Request' ||
        tab.request.url !== DEFAULT_REQUEST.url ||
        tab.request.bodyContent !== DEFAULT_REQUEST.bodyContent ||
        tab.request.headers.length > 0;
    }

    // Compare essential properties to detect changes
    const current = { ...tab.request, id: undefined };
    const reference = { ...saved, id: undefined, collectionId: undefined, workspaceId: undefined, updatedAt: undefined };
    return JSON.stringify(current) !== JSON.stringify(reference);
  };

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // OpenAPI Import State
  const [showImportOpenApiModal, setShowImportOpenApiModal] = useState(false);
  const [importOpenApiUrl, setImportOpenApiUrl] = useState('');
  const [importOpenApiFile, setImportOpenApiFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'url' | 'file'>('url');
  const [importOpenApiWorkspaceName, setImportOpenApiWorkspaceName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Global Key Commands
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }

      // Close all modals on Escape
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setContextMenu(null);
        setCollectionContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSelectAction = (actionId: string, params?: any) => {
    if (actionId === 'new_request') {
      handleCreateRequest();
    } else if (actionId === 'clear_history') {
      if (confirm('Clear all history items?')) {
        setHistory([]);
        addToast('History cleared', 'info');
      }
    } else if (actionId === 'logout') {
      handleLogout();
    } else if (actionId.startsWith('theme_')) {
      const t = params as Theme;
      setTheme(t);
      localStorage.setItem('theme', t);
      applyThemeToElement(t);
      addToast(`Theme set to ${t}`, 'info');
    } else if (actionId.startsWith('layout_')) {
      const mode = params as 'horizontal' | 'vertical';
      setLayoutMode(mode);
      addToast(`Layout set to ${mode}`, 'info');
    }
  };

  const handleCreateRequest = () => {
    const newTabId = `tab_${Date.now()}`;
    const newRequest = { ...DEFAULT_REQUEST, id: newTabId };
    setRequestTabs(prev => [...prev, { id: newTabId, request: newRequest, response: null }]);
    setActiveTabId(newTabId);
    addToast('New request created', 'info');
  };

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

  // Theme & Brightness & State Persistence Effect
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      applyThemeToElement(savedTheme);
    }

    const savedBrightness = localStorage.getItem('brightness');
    if (savedBrightness) {
      const b = parseInt(savedBrightness);
      setBrightness(b);
      document.body.style.filter = `brightness(${b}%)`;
    }

    // Load persisted tabs (Client Side Storage)
    const loadState = async () => {
      try {
        const savedTabsJson = localStorage.getItem('communicatex_tabs');
        if (savedTabsJson) {
          const simpleTabs = JSON.parse(savedTabsJson);
          if (Array.isArray(simpleTabs) && simpleTabs.length > 0) {
            // Rehydrate with responses from IndexedDB
            const hydratedTabs = await Promise.all(simpleTabs.map(async (tab: any) => {
              const res = await getResponseFromDB(tab.id);
              return { ...tab, response: res };
            }));
            setRequestTabs(hydratedTabs);

            const savedActiveId = localStorage.getItem('communicatex_active_tab');
            if (savedActiveId && hydratedTabs.find(t => t.id === savedActiveId)) {
              setActiveTabId(savedActiveId);
            } else {
              setActiveTabId(hydratedTabs[0].id);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load persisted state:', e);
      }
    };
    loadState();
  }, []);

  // Persist Tabs & Responses
  useEffect(() => {
    if (requestTabs.length === 0) return;

    // Debounce save slightly to avoid thrashing during typing
    const handler = setTimeout(() => {
      // 1. Save Tab Structure to LocalStorage (without Heavy Response)
      const tabsToSave = requestTabs.map(t => ({
        id: t.id,
        request: t.request,
        response: null // Don't save response in LS
      }));
      localStorage.setItem('communicatex_tabs', JSON.stringify(tabsToSave));
      localStorage.setItem('communicatex_active_tab', activeTabId);

      // 2. Save Responses to IndexedDB (Only if present)
      requestTabs.forEach(t => {
        if (t.response) {
          saveResponseToDB(t.id, t.response);
        }
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [requestTabs, activeTabId]);

  const applyThemeToElement = (t: Theme) => {
    const root = document.documentElement;
    root.classList.remove('light', 'theme-midnight', 'theme-aubergine', 'theme-nord', 'theme-forest', 'theme-hacker', 'theme-dream-orange');
    if (t === 'light') root.classList.add('light');
    else if (t === 'midnight') root.classList.add('theme-midnight');
    else if (t === 'aubergine') root.classList.add('theme-aubergine');
    else if (t === 'nord') root.classList.add('theme-nord');
    else if (t === 'forest') root.classList.add('theme-forest');
    else if (t === 'hacker') root.classList.add('theme-hacker');
    else if (t === 'dream-orange') root.classList.add('theme-dream-orange');
  };

  const cycleBrightness = () => {
    const nextB = brightness <= 70 ? 100 : brightness - 10;
    setBrightness(nextB);
    document.body.style.filter = `brightness(${nextB}%)`;
    localStorage.setItem('brightness', nextB.toString());
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
        addToast(`Switched to "${workspace.name}"`, 'info');
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
    addToast('Logged out successfully', 'info');
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
        addToast(`Workspace "${newWs.name}" created!`, 'success');
      } else {
        alert(data?.error || 'Failed to create workspace');
      }
    } catch (err) {
      console.error('Create workspace error:', err);
      alert('Unable to create workspace');
    }
  };

  // Export OpenAPI
  const handleExportOpenApi = () => {
    try {
      const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || DEFAULT_WORKSPACE;
      const openApiJson = generateOpenApi(activeWorkspace, collections, savedRequests);

      const blob = new Blob([openApiJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeWorkspace.name.replace(/\s+/g, '_').toLowerCase()}_openapi.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast('OpenAPI schema exported successfully', 'success');
      setShowWorkspaceMenu(false);
    } catch (err) {
      console.error('Export Error:', err);
      addToast('Failed to export OpenAPI schema', 'error');
    }
  };

  const handleImportOpenApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importOpenApiWorkspaceName.trim() || !user?.backendId) return;

    // Validation
    if (importMode === 'url' && !importOpenApiUrl.trim()) {
      addToast('Please enter a valid URL', 'error');
      return;
    }
    if (importMode === 'file' && !importOpenApiFile) {
      addToast('Please select a file to import', 'error');
      return;
    }

    setIsImporting(true);
    try {
      // 1. Parse Schema
      let result;
      if (importMode === 'url') {
        const { parseOpenApi } = await import('./services/openApiParser');
        result = await parseOpenApi(importOpenApiUrl.trim());
      } else {
        // File Mode
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsText(importOpenApiFile!);
        });

        const { parseOpenApiContent } = await import('./services/openApiParser');
        let schema;
        try {
          schema = JSON.parse(fileContent);
        } catch (e) {
          throw new Error('Invalid JSON file');
        }
        result = parseOpenApiContent(schema);
      }
      addToast(`Schema parsed: ${result.title}`, 'info');

      // 2. Create Workspace
      const workspace = await apiService.createWorkspace(user.backendId, importOpenApiWorkspaceName.trim());
      const newWs: Workspace = {
        id: `ws_${workspace.id}`,
        name: workspace.name,
        createdAt: workspace.createdAt,
        backendId: workspace.id,
      };
      setWorkspaces(prev => [...prev, newWs]);
      setActiveWorkspaceId(newWs.id);

      // 2.5. Create Default Environment if baseUrl exists
      if (result.baseUrl) {
        try {
          const env = await apiService.saveEnvironment({
            workspaceId: workspace.id,
            name: 'Production',
            variables: [{
              id: 'var_' + Math.random().toString(36).substr(2, 9),
              key: 'baseUrl',
              value: result.baseUrl,
              enabled: true
            }]
          });
          const newEnv: Environment = {
            id: `env_${env.id}`,
            name: env.name,
            variables: env.variables,
          };
          setEnvironments(prev => [...prev, newEnv]);
          setActiveEnvId(newEnv.id);
        } catch (e) {
          console.warn('Failed to create default environment:', e);
        }
      }

      // 3. Create Collections and Requests
      for (const group of result.groups) {
        const collection = await apiService.createCollection(workspace.id, group.tag);
        for (const req of group.requests) {
          await apiService.saveRequest({
            ...DEFAULT_REQUEST,
            ...req,
            name: req.name || 'Untitled',
            workspaceId: workspace.id,
            collectionId: String(collection.id),
          });
        }
      }

      // 4. Refresh Data
      const [cols, reqs] = await Promise.all([
        apiService.getCollections(workspace.id),
        apiService.getSavedRequests(workspace.id),
      ]);

      setCollections(cols.map((c: any) => ({
        id: `col_${c.id}`,
        workspaceId: newWs.id,
        name: c.name,
        createdAt: c.createdAt,
      })));

      setSavedRequests(reqs.map((r: any) => ({
        ...(r.request || {}),
        ...r,
        id: String(r.id),
        workspaceId: newWs.id,
        collectionId: r.collectionId ? `col_${r.collectionId}` : undefined,
      })));

      addToast(`Imported ${result.groups.length} collections from ${result.title}`, 'success');
      setShowImportOpenApiModal(false);
      setImportOpenApiUrl('');
      setImportOpenApiWorkspaceName('');
    } catch (err) {
      console.error('Import OpenAPI Error:', err);
      addToast(err instanceof Error ? err.message : 'Failed to import OpenAPI schema', 'error');
    } finally {
      setIsImporting(false);
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
    // Check for cURL import in URL field
    if (next.url?.trim().toLowerCase().startsWith('curl ')) {
      const parsed = parseCurl(next.url);
      if (parsed) {
        addToast('cURL command imported successfully!', 'success');
        const importedRequest = {
          ...next,
          ...parsed,
          name: parsed.url ? new URL(parsed.url).pathname.split('/').pop() || next.name : next.name
        };
        setRequestTabs(prev => prev.map(tab =>
          tab.id === activeTabId ? { ...tab, request: importedRequest } : tab
        ));
        return;
      }
    }

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
    // Clean up IndexedDB for this tab
    deleteResponseFromDB(tabId);

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
      // Cleanup IndexedDB for all other tabs
      requestTabs.forEach(tab => {
        if (tab.id !== keepTabId) {
          deleteResponseFromDB(tab.id);
        }
      });
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
      addToast(`Request "${request.name || existing.name}" updated!`, 'success');

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
      setShowEnvModal(true);
    } catch (err) {
      console.error('Create environment error:', err);
      alert('Unable to create environment');
    }
  };

  const updateEnvironment = (id: string, updates: Partial<Environment>) => {
    setEnvironments(envs => envs.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleEnvModalDone = async () => {
    setShowEnvModal(false);
    const activeWs = getActiveWorkspace();
    if (activeWs.backendId && user) {
      try {
        await Promise.all(environments.map(env => {
          const backendId = parseInt(env.id.replace('env_', ''));
          return apiService.saveEnvironment({
            id: isNaN(backendId) ? undefined : backendId,
            workspaceId: activeWs.backendId!,
            name: env.name,
            variables: env.variables,
          });
        }));
      } catch (err) {
        console.error('Failed to sync environments:', err);
      }
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

  const executePostRequestScript = (script: string, request: ApiRequest, response: ApiResponse): string[] => {
    if (!script) return [];
    const logs: string[] = [];

    try {
      const activeEnv = environments.find(e => e.id === activeEnvId);

      let currentVars = activeEnv ? [...activeEnv.variables] : [];
      let envChanged = false;

      const formatArg = (arg: any) => {
        if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
        return String(arg);
      };

      const ctx = {
        request,
        response,
        env: {
          set: (key: string, value: string) => {
            const index = currentVars.findIndex(v => v.key === key);
            if (index !== -1) {
              currentVars[index] = { ...currentVars[index], value: String(value) };
            } else {
              currentVars.push({ id: `var_${Date.now()}`, key, value: String(value), enabled: true });
            }
            envChanged = true;
          },
          get: (key: string) => {
            return currentVars.find(v => v.key === key)?.value;
          }
        },
        toast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
          addToast(message, type);
        },
        console: {
          log: (...args: any[]) => {
            const msg = args.map(formatArg).join(' ');
            logs.push(msg);
            console.log('[Script Log]', msg);
          },
          error: (...args: any[]) => {
            const msg = args.map(formatArg).join(' ');
            logs.push(`ERROR: ${msg}`);
            console.error('[Script Error]', msg);
          }
        }
      };

      const runner = new Function('ctx', script);
      runner(ctx);

      if (envChanged && activeEnv) {
        updateEnvironment(activeEnv.id, { variables: currentVars });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logs.push(`RUNTIME ERROR: ${errorMsg}`);
      console.error('Post-request script error:', err);
      addToast(`Script Error: ${errorMsg}`, 'error');
    }
    return logs;
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

      // Execute post-request script
      let logs: string[] = [];
      if (request.postRequestScript) {
        logs = executePostRequestScript(request.postRequestScript, request, result);
      }

      const finalResult = { ...result, scriptLogs: logs };

      setRequestTabs(prev => prev.map(tab =>
        tab.id === activeTabId ? { ...tab, response: finalResult } : tab
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
      ...(req as any).request, // Flatten nested data if it exists
      ...req,
      id: newTabId,
      useProxy: req.useProxy ?? false
    };
    setRequestTabs(prev => [...prev, { id: newTabId, request: restoredRequest, response: null }]);
    setActiveTabId(newTabId);
  };

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
            <h1 className="text-6xl font-bold text-foreground tracking-tight mb-4">
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
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder-zinc-600"
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
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder-zinc-600"
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

            <div className="mt-8 text-center pt-6">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-textSecondary hover:text-foreground transition-colors"
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <div className={`flex flex-col relative z-20 transition-all duration-300 ease-in-out border-r border-white/5 bg-surface overflow-hidden ${showSidebar ? 'w-[280px]' : 'w-0 border-none pointer-events-none'}`}>
        <div className={`flex flex-col h-full w-[280px] transition-opacity duration-200 ${showSidebar ? 'opacity-100' : 'opacity-0'}`}>
          {/* Workspace Switcher Header */}
          <div className="px-4 py-5 border-b border-white/5 relative bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                className="flex-1 flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.03] transition-all group border border-transparent hover:border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surfaceHighlight/30 flex items-center justify-center text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/5 group-hover:scale-105 transition-transform">
                    <Box size={20} className="filter drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-[9px] text-primary/60 font-black uppercase tracking-[0.2em] leading-none mb-1">Workspace</span>
                    <span className="text-[14px] font-bold text-foreground/90 truncate max-w-[120px] leading-tight">{activeWorkspace.name}</span>
                  </div>
                </div>
                <ChevronDown size={14} className={`text-textSecondary/30 transition-transform duration-300 ${showWorkspaceMenu ? 'rotate-180' : ''}`} />
              </button>
              {activeWorkspaceId !== DEFAULT_WORKSPACE.id && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="p-2.5 rounded-xl text-textSecondary/40 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 shadow-sm"
                  title="Invite a collaborator"
                >
                  <Mail size={16} />
                </button>
              )}
            </div>

            {/* Dropdown Menu */}
            {showWorkspaceMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowWorkspaceMenu(false)}></div>
                <div className="absolute top-full left-4 right-4 mt-2 bg-surfaceHighlight rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                                  ...(r.request || {}),
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
                          className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all ${activeWorkspaceId === ws.id
                            ? 'text-white font-medium'
                            : 'text-textSecondary hover:text-foreground'
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
                                          ...(r.request || {}),
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
                  <div className="p-3 bg-surfaceLight/10">
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
                    <button
                      onClick={() => {
                        setShowImportOpenApiModal(true);
                        setShowWorkspaceMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-400/10 transition-colors mt-1"
                    >
                      <Globe size={14} />
                      <span>Import OpenAPI</span>
                    </button>
                    <button
                      onClick={handleExportOpenApi}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-400 hover:bg-blue-400/10 transition-colors mt-1"
                    >
                      <Download size={14} />
                      <span>Export OpenAPI</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Environment Section - Collapsible */}
          <div className="bg-surface/50 mt-2">
            <div className="w-full flex items-center justify-between px-3 py-2 hover:bg-surfaceLight/30 transition-colors group">
              <button
                onClick={() => setIsEnvExpanded(!isEnvExpanded)}
                className="flex-1 flex items-center gap-2 text-left"
              >
                <ChevronRight size={12} className={`text-textSecondary/50 transition-transform ${isEnvExpanded ? 'rotate-90' : ''}`} />
                <Database size={12} className={activeEnvId ? "text-primary/80" : "text-textSecondary/60"} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-textSecondary/80">Environment</span>
                {activeEnvId && (
                  <span className="text-[10px] text-primary/80 font-medium truncate max-w-[80px]">
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
              <div className="px-3 pb-2 space-y-1">
                <button
                  onClick={() => { setActiveEnvId(null); addToast('Switched to no environment', 'info'); }}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-all ${!activeEnvId
                    ? 'bg-surfaceHighlight text-foreground shadow-sm'
                    : 'text-textSecondary/70 hover:text-foreground hover:bg-surfaceLight/20'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <Database size={11} className={!activeEnvId ? "text-primary/70" : "text-textSecondary/40"} />
                    <span className="font-medium">No Environment</span>
                  </span>
                  {!activeEnvId && <Check size={11} className="text-primary" />}
                </button>
                {environments.map(env => (
                  <div
                    key={env.id}
                    onClick={() => { setActiveEnvId(env.id); addToast(`Switched to environment: ${env.name}`, 'info'); }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all group cursor-pointer ${activeEnvId === env.id
                      ? 'bg-surfaceLight/80 text-foreground shadow-sm'
                      : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/30'
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
                  </div>
                ))}
                {environments.length === 0 && activeWorkspaceId !== DEFAULT_WORKSPACE.id && (
                  <div className="text-[10px] text-textSecondary px-3 py-2 italic text-center">
                    No environments. Create one to manage variables.
                  </div>
                )}
                {activeWorkspaceId !== DEFAULT_WORKSPACE.id && environments.length > 0 && (
                  <button
                    onClick={() => setShowEnvModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-textSecondary hover:text-primary hover:bg-surfaceLight/50 rounded-lg transition-all"
                  >
                    <Settings size={11} />
                    Manage Environments
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar View Switcher & Search */}
          {/* Sidebar View Switcher & Search */}
          <div className="flex flex-col gap-3 px-4 py-4">
            {/* View Switcher */}
            <div className="flex gap-1 bg-surfaceHighlight/20 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setSidebarView('collections')}
                className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all text-[11px] font-bold tracking-tight ${sidebarView === 'collections'
                  ? 'bg-surface shadow-[0_2px_10px_rgba(0,0,0,0.3)] text-primary border border-white/5'
                  : 'text-textSecondary/60 hover:text-foreground hover:bg-white/5'
                  }`}
              >
                <Folder size={12} className={`mr-2 transition-colors ${sidebarView === 'collections' ? 'text-primary' : ''}`} />
                Collections
              </button>
              <button
                onClick={() => setSidebarView('history')}
                className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all text-[11px] font-bold tracking-tight ${sidebarView === 'history'
                  ? 'bg-surface shadow-[0_2px_10px_rgba(0,0,0,0.3)] text-primary border border-white/5'
                  : 'text-textSecondary/60 hover:text-foreground hover:bg-white/5'
                  }`}
              >
                <Clock size={12} className={`mr-2 transition-colors ${sidebarView === 'history' ? 'text-primary' : ''}`} />
                History
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative group/search">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary/40 group-focus-within/search:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Filter collections..."
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl text-[12px] text-foreground placeholder-textSecondary/50 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">

            {/* HISTORY VIEW */}
            {sidebarView === 'history' && (
              <ul className="space-y-2">
                {filteredHistory.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => restoreRequest(item.request)}
                      className="w-full text-left p-2 rounded-lg hover:bg-surfaceLight/50 border border-transparent hover:border-border transition-all group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.request.method === 'GET' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                          item.request.method === 'POST' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            item.request.method === 'DELETE' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                              'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          }`}>
                          {item.request.method}
                        </span>
                        <span className={`text-[10px] font-mono font-semibold ${item.responseStatus && item.responseStatus >= 400 ? 'text-danger' : 'text-success'}`}>
                          {item.responseStatus || '...'}
                        </span>
                      </div>
                      <div className="text-[11px] text-textSecondary truncate font-medium group-hover:text-foreground transition-colors">
                        {item.request.url.replace(/^https?:\/\//, '')}
                      </div>
                    </button>
                  </li>
                ))}
                {filteredHistory.length === 0 && (
                  <li className="p-4 text-center border border-border rounded-lg bg-surfaceLight/5">
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
                    className="w-full flex items-center justify-center py-2 mb-2 bg-white/5 hover:bg-primary/5 text-primary/70 hover:text-primary rounded-xl border border-dashed border-white/10 hover:border-primary/30 transition-all font-bold text-[10px] uppercase tracking-[0.1em]"
                  >
                    <Plus size={14} className="mr-2" />
                    New Collection
                  </button>
                )}

                {filteredCollections.length === 0 && (
                  <div className="text-center text-xs text-textSecondary italic py-6">Create a collection to organize your requests.</div>
                )}

                {filteredCollections.map(col => {
                  const isExpanded = expandedCollections.has(col.id);
                  const colRequests = savedRequests.filter(r => r.collectionId === col.id);

                  return (
                    <div key={col.id} className="group/col mb-1 last:mb-0">
                      <div
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.03] group/header transition-all border border-transparent hover:border-white/5"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCollectionContextMenu({ x: e.clientX, y: e.clientY, collectionId: col.id });
                        }}
                      >
                        <button
                          onClick={() => toggleCollection(col.id)}
                          className="flex items-center gap-3 flex-1 overflow-hidden"
                        >
                          <ChevronRight size={12} className={`text-textSecondary/20 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                          <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-primary/10' : 'bg-surfaceHighlight/20'}`}>
                            {isExpanded ? <FolderOpen size={14} className="text-primary" /> : <Folder size={14} className="text-textSecondary/60" />}
                          </div>
                          <span className={`text-[13px] font-semibold truncate transition-colors ${isExpanded ? 'text-foreground' : 'text-textSecondary/80 group-hover/header:text-foreground'}`}>{col.name}</span>
                        </button>
                        <button
                          onClick={() => deleteCollection(col.id)}
                          className="opacity-0 group-hover/header:opacity-100 text-textSecondary/30 hover:text-danger transition-all p-1.5 rounded-lg hover:bg-danger/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="pl-4 border-l border-white/5 ml-4.5 my-1 space-y-1">
                          {colRequests.length === 0 && (
                            <div className="text-[10px] text-textSecondary/30 pl-4 py-3 italic">Empty collection</div>
                          )}
                          {colRequests.filter(req => req && req.id).map(req => (
                            <div key={req.id} className="flex items-center group/req">
                              <button
                                onClick={() => restoreRequest(req)}
                                className={`flex-1 flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] text-left overflow-hidden transition-all border border-transparent ${request.id === req.id ? 'bg-primary/5 border-primary/20 shadow-sm' : 'hover:border-white/5'}`}
                              >
                                <div className={`w-10 text-[9px] font-black tracking-tighter text-center rounded-lg py-1 border shadow-sm ${req.method === 'GET' ? 'text-blue-400 bg-blue-500/5 border-blue-500/10' :
                                  req.method === 'POST' ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' :
                                    req.method === 'DELETE' ? 'text-red-400 bg-red-500/5 border-red-500/10' :
                                      'text-indigo-400 bg-indigo-500/5 border-indigo-500/10'
                                  }`}>
                                  {req.method}
                                </div>
                                <span className={`text-[12px] truncate font-bold transition-colors ${request.id === req.id ? 'text-primary' : 'text-textSecondary/80 group-hover/req:text-foreground'}`}>{req.name}</span>
                              </button>
                              <button
                                onClick={() => deleteSavedRequest(req.id)}
                                className="opacity-0 group-hover/req:opacity-100 p-2 text-textSecondary/30 hover:text-danger rounded-xl transition-all hover:bg-danger/10"
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
          <div className="mx-4 mb-4 mt-auto p-3 bg-surfaceHighlight/10 backdrop-blur-md rounded-2xl border border-white/5 transition-all group hover:bg-surfaceHighlight/20 hover:border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[11px] font-black text-white shadow-lg shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-[12px] font-bold text-foreground/90 truncate">{user.name}</span>
                  <span className="text-[10px] text-textSecondary/40 font-bold uppercase tracking-widest leading-none mt-0.5">Pro User</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (user) fetchInvitations(user.email);
                    setShowInboxModal(true);
                  }}
                  className="text-textSecondary/30 hover:text-primary transition-all p-2 hover:bg-primary/10 rounded-lg relative group/icon"
                  title="View invitations"
                >
                  <Mail size={14} />
                  {invitations.length > 0 && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-danger rounded-full ring-2 ring-surface animate-pulse" />
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className="text-textSecondary/30 hover:text-danger p-2 transition-all hover:bg-danger/10 rounded-lg"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
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
          <div className="flex items-center gap-1 border-b border-white/5 px-2 bg-gradient-to-r from-surfaceHighlight/5 to-transparent">
            {/* Sidebar Toggle */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 mr-1 text-textSecondary/40 hover:text-primary hover:bg-primary/10 rounded-xl transition-all border border-transparent hover:border-primary/20 group/sidebar-toggle"
              title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
            >
              {showSidebar ? <PanelLeftClose size={18} className="group-hover/sidebar-toggle:-translate-x-0.5 transition-transform" /> : <PanelLeftOpen size={18} className="text-primary animate-pulse" />}
            </button>

            <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide min-w-0 pr-4">
              {requestTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`group flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-all min-w-[120px] max-w-[200px] relative cursor-pointer select-none mb-[-1px] ${activeTabId === tab.id
                    ? 'bg-surfaceHighlight/50 text-foreground font-medium'
                    : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/10'
                    }`}
                  onClick={() => setActiveTabId(tab.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                  }}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${tab.request.method === 'GET' ? 'bg-blue-500' :
                    tab.request.method === 'POST' ? 'bg-emerald-500' :
                      tab.request.method === 'DELETE' ? 'bg-red-500' :
                        tab.request.method === 'PUT' ? 'bg-indigo-500' :
                          'bg-zinc-500'
                    }`} />
                  <span className="text-xs truncate flex-1 leading-none">
                    {tab.request.name}
                  </span>
                  {isTabDirty(tab.id) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)] flex-shrink-0" title="Unsaved changes" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all flex-shrink-0 ${activeTabId === tab.id ? 'hover:bg-surfaceLight' : 'hover:bg-surfaceLight/30'}`}
                    title="Close tab"
                  >
                    <X size={12} className="text-textSecondary hover:text-foreground" />
                  </button>
                </div>
              ))}
              <button
                onClick={createNewTab}
                className="px-3 py-2 text-textSecondary hover:text-foreground hover:bg-surfaceLight/10 rounded-t-lg transition-all flex items-center justify-center flex-shrink-0"
                title="New Request"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex flex-shrink-0 border-l border-border ml-2 pl-2 gap-1 py-1 mr-2 items-center">
              <button
                onClick={() => setLayoutMode('horizontal')}
                className={`p-1.5 rounded-md transition-all ${layoutMode === 'horizontal' ? 'text-primary bg-primary/10' : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/50'}`}
                title="Side-by-side layout"
              >
                <Columns size={14} />
              </button>
              <button
                onClick={() => setLayoutMode('vertical')}
                className={`p-1.5 rounded-md transition-all ${layoutMode === 'vertical' ? 'text-primary bg-primary/10' : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/50'}`}
                title="Stacked layout"
              >
                <Rows size={14} />
              </button>
              <div className="w-px h-4 bg-border/50 mx-1"></div>

              <div className="relative">
                <button
                  onClick={() => setShowThemeMenu(!showThemeMenu)}
                  className={`p-1.5 rounded-md transition-all ${showThemeMenu ? 'text-primary bg-primary/10' : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/50'}`}
                  title="Change Theme"
                >
                  <Palette size={14} />
                </button>

                {showThemeMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowThemeMenu(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-surfaceHighlight rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[70] overflow-hidden p-1 animate-in fade-in zoom-in-95">
                      {[
                        { id: 'dark', label: 'Classic Dark', color: '#000000' },
                        { id: 'light', label: 'Default Light', color: '#ffffff' },
                        { id: 'midnight', label: 'Midnight Blue', color: '#0f172a' },
                        { id: 'aubergine', label: 'Aubergine', color: '#1a1d21' },
                        { id: 'nord', label: 'Nord Ice', color: '#2e3440' },
                        { id: 'forest', label: 'Emerald Forest', color: '#064e3b' },
                        { id: 'hacker', label: 'Hacker/Matrix', color: '#050505' },
                        { id: 'dream-orange', label: 'Dream Orange', color: '#ff7900' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            const nt = t.id as Theme;
                            setTheme(nt);
                            localStorage.setItem('theme', nt);
                            applyThemeToElement(nt);
                            setShowThemeMenu(false);
                            addToast(`Theme set to ${t.label}`, 'info');
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${theme === t.id ? 'bg-surfaceLight text-primary' : 'text-textSecondary hover:bg-surfaceLight/50 hover:text-foreground'}`}
                        >
                          <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: t.color }}></div>
                          {t.label}
                          {theme === t.id && <Check size={12} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowAiPanel(!showAiPanel)}
                className={`p-1.5 rounded-md transition-all ${showAiPanel ? 'text-primary bg-primary/10' : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/50'}`}
                title="AI Agent"
              >
                <Bot size={14} />
              </button>

              <button
                onClick={cycleBrightness}
                className="p-1.5 rounded-md text-textSecondary hover:text-foreground hover:bg-surfaceLight/50 transition-all flex items-center gap-1"
                title="Adjust Brightness"
              >
                <SunDim size={14} />
                <span className="text-[10px] font-bold w-6">{brightness}%</span>
              </button>
            </div>
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
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
                >
                  <Edit size={14} />
                  Rename Request
                </button>
                <button
                  onClick={() => {
                    duplicateTab(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
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
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
                >
                  <X size={14} />
                  Close Tab
                </button>
                <button
                  onClick={() => {
                    closeOtherTabs(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
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
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
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
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors cursor-pointer"
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

          <div className="flex flex-row overflow-hidden flex-1 border-t border-border bg-background">
            <div className={`flex ${showAiPanel ? 'flex-col' : (layoutMode === 'horizontal' ? 'flex-row' : 'flex-col')} overflow-hidden flex-1 transition-all duration-300`}>
              {/* Request Panel (Left/Top) */}
              <div className={`flex-1 flex flex-col min-w-[400px] border-border relative overflow-hidden transition-all duration-300 ${layoutMode === 'horizontal' ? 'border-r' : 'border-b'}`}>
                <RequestPanel
                  request={request}
                  onRequestChange={handleRequestChange}
                  onSend={handleSendRequest}
                  onSave={openSaveRequestModal}
                  loading={loading}
                  environmentVariables={activeEnvVars}
                  isSavedRequest={!!(request.id && savedRequests.find(r => r.id === request.id))}
                  addToast={addToast}
                />
              </div>

              {/* Response Panel (Right/Bottom) */}
              <div className="flex-1 flex flex-col min-w-[400px] overflow-hidden transition-all duration-300">
                <ResponsePanel response={response} loading={loading} addToast={addToast} />
              </div>
            </div>

            {showAiPanel && (
              <div
                className="bg-surfaceHighlight/10 backdrop-blur-sm rounded-2xl overflow-hidden flex flex-col border border-white/5 relative shadow-2xl animate-in slide-in-from-right duration-300 z-10"
                style={{ width: `${aiPanelWidth}px` }}
              >
                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/80">AI Agent</span>
                  </div>
                  <span className="text-[9px] font-black text-primary/80 bg-primary/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">Alpha</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-transparent to-primary/5">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.2)] group hover:scale-110 transition-transform duration-500">
                    <Bot size={40} className="text-primary/60 group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground/90 mb-3 tracking-tight">AI Assistant</h3>
                  <p className="text-xs text-textSecondary/50 max-w-[220px] leading-relaxed font-medium">
                    The AI Agent is coming soon to help you automate, optimize, and document your API requests.
                  </p>
                  <div className="mt-8 px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-[10px] font-bold text-textSecondary/40 uppercase tracking-widest animate-pulse">
                    Coming Soon
                  </div>
                </div>

                {/* Resizer handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 transition-colors z-30"
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startWidth = aiPanelWidth;
                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const newWidth = startWidth - (moveEvent.clientX - startX);
                      if (newWidth > 280 && newWidth < 800) setAiPanelWidth(newWidth);
                    };
                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                    };
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-foreground mb-1">Create Workspace</h2>
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
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. Project Alpha"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateWorkspaceModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primaryHover transition-colors shadow-lg shadow-blue-900/20"
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
            <h2 className="text-xl font-bold text-foreground mb-1">New Collection</h2>
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
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. Auth APIs"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateCollectionModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primaryHover transition-colors shadow-lg shadow-blue-900/20"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import OpenAPI Modal */}
      {showImportOpenApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-foreground mb-1">Import OpenAPI Schema</h2>
            <p className="text-sm text-textSecondary mb-6">Import endpoints from an OpenAPI 3.x URL.</p>

            <form onSubmit={handleImportOpenApi}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Import Source</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setImportMode('url')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${importMode === 'url' ? 'bg-primary text-white' : 'bg-surfaceLight text-textSecondary hover:text-foreground'}`}
                    >
                      URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('file')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${importMode === 'file' ? 'bg-primary text-white' : 'bg-surfaceLight text-textSecondary hover:text-foreground'}`}
                    >
                      File Upload
                    </button>
                  </div>
                </div>

                {importMode === 'url' ? (
                  <div>
                    <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Schema URL</label>
                    <input
                      type="url"
                      autoFocus
                      required={importMode === 'url'}
                      value={importOpenApiUrl}
                      onChange={(e) => setImportOpenApiUrl(e.target.value)}
                      className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="https://api.example.com/openapi.json"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Select File</label>
                    <input
                      type="file"
                      accept=".json"
                      required={importMode === 'file'}
                      onChange={(e) => setImportOpenApiFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full bg-surfaceLight border border-border p-2 rounded-lg text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                    />
                    <p className="mt-1 text-[10px] text-textSecondary">Supported format: JSON (OpenAPI 3.0+)</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Target Workspace Name</label>
                  <input
                    type="text"
                    required
                    value={importOpenApiWorkspaceName}
                    onChange={(e) => setImportOpenApiWorkspaceName(e.target.value)}
                    className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. My Imported API"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportOpenApiModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Importing...
                    </>
                  ) : 'Import Schema'}
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
                <h2 className="text-xl font-bold text-foreground">Invitations</h2>
                {invitations.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded-full">
                    {invitations.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowInboxModal(false)}
                className="text-textSecondary hover:text-foreground transition-colors"
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
                          <h3 className="text-sm font-bold text-foreground mb-1">{inv.workspaceName}</h3>
                          <p className="text-xs text-textSecondary">
                            Invited by <span className="text-foreground font-medium">{inv.inviterName}</span>
                            <span className="mx-2 text-textSecondary opacity-30">|</span>
                            Role: <span className="text-foreground">{inv.role === 'member' ? 'Member' : 'Viewer'}</span>
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
                          className="px-3 py-2 bg-surfaceHighlight hover:bg-surfaceLight text-textSecondary hover:text-foreground text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <h2 className="text-xl font-bold text-foreground mb-1">Invite to Workspace</h2>
            <p className="text-sm text-textSecondary mb-6">
              Share <span className="font-semibold text-foreground">{activeWorkspace.name}</span> with another user.
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
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-zinc-600"
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
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
                  className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
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
              <h2 className="text-xl font-bold text-foreground">
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
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
                  <div className="p-4 bg-surfaceLight/20 rounded-lg text-center">
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
                  className="px-4 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-foreground hover:bg-surfaceLight transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="w-full max-w-5xl h-[650px] bg-background border border-border rounded-2xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95">

            {/* Sidebar List */}
            <div className="w-72 bg-surface/30 border-r border-border flex flex-col">
              <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-textSecondary uppercase tracking-widest">Environments</h2>
                  <button
                    onClick={handleCreateEnvironment}
                    className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-all"
                    title="New Environment"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary/40" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full bg-black/40 rounded-lg py-2 pl-9 pr-3 text-xs text-foreground focus:outline-none focus:bg-black/60 transition-all placeholder-zinc-700"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {environments.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-xs text-textSecondary italic mb-2">No environments yet.</p>
                    <button onClick={handleCreateEnvironment} className="text-xs text-primary hover:underline">Create one</button>
                  </div>
                )}
                {environments.map(env => (
                  <div
                    key={env.id}
                    onClick={() => setEditingEnvId(env.id)}
                    className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all ${editingEnvId === env.id
                      ? 'bg-primary/10 text-primary shadow-[0_0_20px_-5px_rgba(59,130,246,0.2)]'
                      : 'text-textSecondary hover:bg-surfaceLight/20 hover:text-foreground'
                      }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className={`w-1.5 h-1.5 rounded-full transition-all ${editingEnvId === env.id ? 'bg-primary scale-125' : 'bg-surfaceHighlight'}`} />
                      <span className={`truncate text-sm ${editingEnvId === env.id ? 'font-bold' : 'font-medium'}`}>{env.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit Area */}
            <div className="flex-1 flex flex-col bg-background relative">
              <div className="absolute top-6 right-6 z-10">
                <button
                  onClick={handleEnvModalDone}
                  className="p-2 text-textSecondary hover:text-foreground hover:bg-surfaceLight/50 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {editingEnvId ? (
                <>
                  {(() => {
                    const env = environments.find(e => e.id === editingEnvId)!;
                    return (
                      <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-10 pb-6">
                          <div className="flex items-end justify-between gap-8 mb-8">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Database size={14} className="text-primary" />
                                <span className="text-[10px] font-bold text-textSecondary uppercase tracking-[0.2em]">Environment Management</span>
                              </div>
                              <input
                                type="text"
                                value={env.name}
                                onChange={(e) => updateEnvironment(env.id, { name: e.target.value })}
                                className="w-full bg-transparent text-4xl font-bold text-foreground focus:outline-none placeholder-zinc-800 tracking-tight"
                                placeholder="Environment Name"
                              />
                            </div>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this environment?')) {
                                  deleteEnvironment(env.id);
                                }
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger/10 rounded-xl transition-all mb-1"
                            >
                              <Trash2 size={16} />
                              Delete Environment
                            </button>
                          </div>

                          <div className="h-px bg-gradient-to-r from-border via-border to-transparent"></div>
                        </div>

                        <div className="flex-1 px-10 pb-10 overflow-hidden flex flex-col">
                          <div className="flex-1 overflow-hidden flex flex-col">
                            <KeyValueEditor
                              title="Variable Definitions"
                              items={env.variables}
                              onChange={(newVars) => updateEnvironment(env.id, { variables: newVars })}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-textSecondary text-center p-20">
                  <div className="w-24 h-24 bg-surfaceLight/20 rounded-[2rem] flex items-center justify-center mb-8 rotate-12 transition-transform hover:rotate-0">
                    <Database size={48} className="text-primary/40" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Manage Environments</h3>
                  <p className="text-sm text-textSecondary max-w-xs mx-auto">Select an environment from the sidebar to configure its variables and constants.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border border-white/5 animate-in slide-in-from-right-full duration-300 ${toast.type === 'success' ? 'bg-emerald-600/90 text-white backdrop-blur-md' :
              toast.type === 'error' ? 'bg-rose-600/90 text-white backdrop-blur-md' :
                'bg-surfaceHighlight/90 text-foreground backdrop-blur-md'
              }`}
          >
            {toast.type === 'success' && <Check size={18} />}
            {toast.type === 'error' && <X size={18} />}
            {toast.type === 'info' && <Zap size={18} className="text-primary" />}
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        savedRequests={savedRequests}
        onSelectRequest={(req) => restoreRequest(req)}
        onSelectAction={handleSelectAction}
      />
    </div>
  );
};

export default App;