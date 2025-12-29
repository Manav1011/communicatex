import React, { useState, useEffect } from 'react';
import { ApiRequest, ApiResponse, HttpMethod, AuthMethod, HistoryItem, User, MOCK_USER, Workspace, Environment, KeyValueItem, Collection, SavedRequest } from './types';
import { executeRequest } from './services/apiExecutor';
import { dbService } from './services/db';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import KeyValueEditor from './components/KeyValueEditor';
import { History, LogOut, Zap, LayoutGrid, Clock, ChevronDown, ChevronRight, Plus, Check, Box, Database, Trash2, Settings, Folder, Save, MoreVertical, FolderOpen, FileText } from 'lucide-react';

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
  useProxy: false
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

  // Collections State
  const [collections, setCollections] = useState<Collection[]>([]);
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
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

  const [request, setRequest] = useState<ApiRequest>(DEFAULT_REQUEST);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  // Load user and data from IndexedDB
  useEffect(() => {
    const initData = async () => {
      try {
        const savedUser = await dbService.getAppState<User>('current_user');
        if (savedUser) setUser(savedUser);
        
        // Load Workspaces
        const savedWorkspaces = await dbService.getAll<Workspace>('workspaces');
        if (savedWorkspaces.length > 0) {
          setWorkspaces(savedWorkspaces);
        }

        const savedActiveWs = await dbService.getAppState<string>('active_workspace_id');
        if (savedActiveWs) {
          setActiveWorkspaceId(savedActiveWs);
        }
        
        // Load Environments
        const savedEnvs = await dbService.getAll<Environment>('environments');
        if (savedEnvs.length > 0) {
            setEnvironments(savedEnvs);
        }
        
        const savedActiveEnv = await dbService.getAppState<string>('active_env_id');
        if (savedActiveEnv) {
          setActiveEnvId(savedActiveEnv);
        }

        // Load Collections & Saved Requests
        const savedCols = await dbService.getAll<Collection>('collections');
        setCollections(savedCols.sort((a, b) => a.createdAt - b.createdAt));

        const savedReqs = await dbService.getAll<SavedRequest>('saved_requests');
        setSavedRequests(savedReqs);

        // Load History (sort by timestamp desc)
        const savedHistory = await dbService.getAll<HistoryItem>('history');
        if (savedHistory.length > 0) {
          setHistory(savedHistory.sort((a, b) => b.timestamp - a.timestamp));
        }
      } catch (error) {
        console.error("Failed to initialize DB:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    initData();
  }, []);

  // Persist workspaces
  useEffect(() => {
    if (!isInitialized) return;
    dbService.saveAll('workspaces', workspaces);
    dbService.setAppState('active_workspace_id', activeWorkspaceId);
  }, [workspaces, activeWorkspaceId, isInitialized]);

  // Persist environments
  useEffect(() => {
    if (!isInitialized) return;
    dbService.saveAll('environments', environments);
    if (activeEnvId) {
        dbService.setAppState('active_env_id', activeEnvId);
    } else {
        dbService.clearAppState('active_env_id');
    }
  }, [environments, activeEnvId, isInitialized]);

  // Persist history
  useEffect(() => {
    if (!isInitialized) return;
    dbService.saveAll('history', history);
  }, [history, isInitialized]);

  // Persist collections and saved requests
  useEffect(() => {
    if (!isInitialized) return;
    dbService.saveAll('collections', collections);
  }, [collections, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    dbService.saveAll('saved_requests', savedRequests);
  }, [savedRequests, isInitialized]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => {
      setUser(MOCK_USER);
      dbService.setAppState('current_user', MOCK_USER);
    }, 500);
  };

  const handleLogout = () => {
    setUser(null);
    dbService.clearAppState('current_user');
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    const newWs: Workspace = {
      id: crypto.randomUUID(),
      name: newWorkspaceName,
      createdAt: Date.now(),
    };

    setWorkspaces([...workspaces, newWs]);
    setActiveWorkspaceId(newWs.id);
    setNewWorkspaceName('');
    setShowCreateWorkspaceModal(false);
    setShowWorkspaceMenu(false);
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    const newCol: Collection = {
      id: crypto.randomUUID(),
      workspaceId: activeWorkspaceId,
      name: newCollectionName,
      createdAt: Date.now(),
    };

    setCollections([...collections, newCol]);
    setNewCollectionName('');
    setShowCreateCollectionModal(false);
    // Expand the new collection and auto-select it for saving if modal is open
    setExpandedCollections(prev => new Set(prev).add(newCol.id));
    if (showSaveRequestModal) {
      setSelectedCollectionId(newCol.id);
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

  const deleteCollection = (id: string) => {
    if(confirm("Are you sure? This will delete all requests inside this collection.")) {
      setCollections(prev => prev.filter(c => c.id !== id));
      setSavedRequests(prev => prev.filter(r => r.collectionId !== id));
    }
  };

  const deleteSavedRequest = (id: string) => {
     setSavedRequests(prev => prev.filter(r => r.id !== id));
  };

  const openSaveRequestModal = () => {
    // If request already belongs to a collection, we could just update it.
    // For now, let's treat "Save" as "Save As" logic if id doesn't match a saved request,
    // or allow updating if it does.
    const existing = savedRequests.find(r => r.id === request.id);
    
    if (existing) {
        // Update existing directly? Or ask confirmation? 
        // For simplicity, let's overwrite for now if it's already a saved request.
        const updated: SavedRequest = {
            ...request,
            collectionId: existing.collectionId,
            workspaceId: existing.workspaceId,
            updatedAt: Date.now()
        };
        setSavedRequests(prev => prev.map(r => r.id === request.id ? updated : r));
        alert("Request updated!");
    } else {
        setSaveRequestName(request.name || 'New Request');
        // Default to first collection if available
        const wsCollections = collections.filter(c => c.workspaceId === activeWorkspaceId);
        if (wsCollections.length > 0) {
            setSelectedCollectionId(wsCollections[0].id);
        }
        setShowSaveRequestModal(true);
    }
  };

  const handleSaveRequest = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCollectionId || !saveRequestName.trim()) return;

      const newSavedReq: SavedRequest = {
          ...request,
          id: crypto.randomUUID(), // Assign new ID to persist it
          name: saveRequestName,
          collectionId: selectedCollectionId,
          workspaceId: activeWorkspaceId,
          updatedAt: Date.now()
      };

      setSavedRequests([...savedRequests, newSavedReq]);
      // Load this new saved request into the main panel so subsequent saves update it
      setRequest(newSavedReq);
      setShowSaveRequestModal(false);
      setExpandedCollections(prev => new Set(prev).add(selectedCollectionId));
  };

  // Environment Handlers
  const handleCreateEnvironment = () => {
    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name: 'New Environment',
      variables: []
    };
    setEnvironments([...environments, newEnv]);
    setEditingEnvId(newEnv.id);
  };

  const updateEnvironment = (id: string, updates: Partial<Environment>) => {
    setEnvironments(envs => envs.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteEnvironment = (id: string) => {
    setEnvironments(envs => envs.filter(e => e.id !== id));
    if (activeEnvId === id) setActiveEnvId(null);
    if (editingEnvId === id) setEditingEnvId(null);
  };

  const handleSendRequest = async () => {
    setLoading(true);
    setResponse(null);
    
    // Add to history immediately for UX, update status later
    const historyId = crypto.randomUUID();
    const newHistoryItem: HistoryItem = {
      id: historyId,
      workspaceId: activeWorkspaceId,
      timestamp: Date.now(),
      request: { ...request }, // snapshot
    };

    try {
      // Get current environment variables
      const activeEnv = environments.find(e => e.id === activeEnvId);
      const envVars = activeEnv ? activeEnv.variables : [];

      const result = await executeRequest(request, envVars);
      setResponse(result);
      
      // Update history with status
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
    // Ensure new fields are initialized if restoring old request data
    setRequest({ 
        ...DEFAULT_REQUEST,
        ...req, 
        useProxy: req.useProxy ?? false 
    }); 
    setResponse(null);
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
                className="w-full py-4 bg-primary hover:bg-primaryHover text-white font-bold rounded-lg transition-all glow-primary mt-2"
              >
                {isLogin ? 'Enter CommunicateX' : 'Join CommunicateX'}
              </button>
            </form>

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
      <div className="w-72 bg-surface border-r border-border flex flex-col z-20">
        {/* Workspace Switcher Header */}
        <div className="p-4 border-b border-border relative">
           <button 
             onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
             className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surfaceLight transition-colors group"
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

           {/* Dropdown Menu */}
           {showWorkspaceMenu && (
             <>
               <div className="fixed inset-0 z-10" onClick={() => setShowWorkspaceMenu(false)}></div>
               <div className="absolute top-full left-4 right-4 mt-2 bg-surfaceHighlight border border-border rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {workspaces.map(ws => (
                      <button
                        key={ws.id}
                        onClick={() => {
                          setActiveWorkspaceId(ws.id);
                          setShowWorkspaceMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-sm mb-1 ${activeWorkspaceId === ws.id ? 'bg-surfaceLight text-white' : 'text-textSecondary hover:text-white hover:bg-surfaceLight/50'}`}
                      >
                        <span>{ws.name}</span>
                        {activeWorkspaceId === ws.id && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 border-t border-border bg-surfaceLight/30">
                    <button
                      onClick={() => {
                        setShowCreateWorkspaceModal(true);
                        setShowWorkspaceMenu(false);
                      }} 
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus size={14} />
                      <span>New Workspace</span>
                    </button>
                  </div>
               </div>
             </>
           )}
        </div>

        {/* Sidebar View Switcher */}
        <div className="flex p-2 gap-1 border-b border-border bg-surface">
            <button 
                onClick={() => setSidebarView('collections')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${sidebarView === 'collections' ? 'bg-surfaceHighlight text-white' : 'text-textSecondary hover:text-zinc-300'}`}
            >
                <Folder size={14} /> Collections
            </button>
            <button 
                onClick={() => setSidebarView('history')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${sidebarView === 'history' ? 'bg-surfaceHighlight text-white' : 'text-textSecondary hover:text-zinc-300'}`}
            >
                <Clock size={14} /> History
            </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          {/* HISTORY VIEW */}
          {sidebarView === 'history' && (
             <ul className="space-y-1">
               {filteredHistory.map((item) => (
                 <li key={item.id}>
                   <button 
                     onClick={() => restoreRequest(item.request)}
                     className="w-full text-left p-3 rounded-lg hover:bg-surfaceLight border border-transparent hover:border-border transition-all group relative overflow-hidden"
                   >
                     <div className="flex items-center justify-between mb-1.5">
                       <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                         item.request.method === 'GET' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                         item.request.method === 'POST' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                         item.request.method === 'DELETE' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                         'bg-orange-500/10 border-orange-500/20 text-orange-400'
                       }`}>
                         {item.request.method}
                       </span>
                       <span className={`text-[10px] font-mono ${item.responseStatus && item.responseStatus >= 400 ? 'text-danger' : 'text-success'}`}>
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
                  <li className="p-8 text-center border border-dashed border-border rounded-lg">
                   <p className="text-xs text-textSecondary">No history in this workspace.</p>
                 </li>
               )}
             </ul>
          )}

          {/* COLLECTIONS VIEW */}
          {sidebarView === 'collections' && (
             <div className="space-y-4">
                 <button 
                    onClick={() => setShowCreateCollectionModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-border rounded-lg text-textSecondary hover:text-primary hover:border-primary/50 transition-colors text-xs font-bold uppercase tracking-wider"
                 >
                    <Plus size={14} /> New Collection
                 </button>

                 {filteredCollections.length === 0 && (
                     <div className="text-center text-xs text-textSecondary italic py-4">Create a collection to organize your requests.</div>
                 )}

                 {filteredCollections.map(col => {
                     const isExpanded = expandedCollections.has(col.id);
                     const colRequests = savedRequests.filter(r => r.collectionId === col.id);
                     
                     return (
                         <div key={col.id} className="group/col">
                             <div className="flex items-center justify-between mb-1 p-1 pr-2 rounded-md hover:bg-surfaceLight/50 group/header">
                                 <button 
                                    onClick={() => toggleCollection(col.id)}
                                    className="flex items-center gap-2 flex-1 overflow-hidden"
                                 >
                                     <ChevronRight size={14} className={`text-textSecondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                     {isExpanded ? <FolderOpen size={16} className="text-primary" /> : <Folder size={16} className="text-primary/70" />}
                                     <span className="text-sm font-medium text-zinc-300 truncate">{col.name}</span>
                                 </button>
                                 <button 
                                    onClick={() => deleteCollection(col.id)}
                                    className="opacity-0 group-hover/header:opacity-100 text-textSecondary hover:text-danger transition-opacity p-1"
                                 >
                                    <Trash2 size={12} />
                                 </button>
                             </div>

                             {isExpanded && (
                                 <div className="pl-4 border-l border-border/50 ml-2 space-y-0.5">
                                     {colRequests.length === 0 && (
                                         <div className="text-[10px] text-textSecondary pl-4 py-1 italic">Empty collection</div>
                                     )}
                                     {colRequests.map(req => (
                                         <div key={req.id} className="flex items-center group/req">
                                            <button
                                               onClick={() => restoreRequest(req)}
                                               className={`flex-1 flex items-center gap-2 p-1.5 rounded-md hover:bg-surfaceLight text-left overflow-hidden ${request.id === req.id ? 'bg-surfaceLight ring-1 ring-border' : ''}`}
                                            >
                                                <span className={`text-[9px] font-bold w-8 text-center rounded px-0.5 py-0.5 ${
                                                    req.method === 'GET' ? 'text-blue-400 bg-blue-400/10' :
                                                    req.method === 'POST' ? 'text-emerald-400 bg-emerald-400/10' :
                                                    req.method === 'DELETE' ? 'text-red-400 bg-red-400/10' :
                                                    'text-orange-400 bg-orange-400/10'
                                                }`}>
                                                    {req.method}
                                                </span>
                                                <span className="text-xs text-zinc-300 truncate">{req.name}</span>
                                            </button>
                                            <button 
                                                onClick={() => deleteSavedRequest(req.id)}
                                                className="opacity-0 group-hover/req:opacity-100 p-1.5 text-textSecondary hover:text-danger"
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
        <div className="p-4 m-4 mt-2 bg-surfaceLight border border-border rounded-xl">
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Background gradient spot */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-surfaceHighlight/20 to-transparent pointer-events-none"></div>
        
        {/* Environment Selector (Floating Top Right) */}
        <div className="absolute top-4 right-4 z-20">
           <div className="relative">
             <button
               onClick={() => setShowEnvMenu(!showEnvMenu)}
               className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-surface border border-border rounded-lg hover:border-primary/50 transition-colors shadow-lg"
             >
                <Database size={14} className={activeEnvId ? "text-primary" : "text-textSecondary"} />
                <span className={`text-xs font-medium ${activeEnvId ? "text-white" : "text-textSecondary"}`}>
                   {activeEnvironment ? activeEnvironment.name : "No Environment"}
                </span>
                <ChevronDown size={14} className="text-textSecondary" />
             </button>

             {showEnvMenu && (
               <>
                 <div className="fixed inset-0" onClick={() => setShowEnvMenu(false)}></div>
                 <div className="absolute top-full right-0 mt-2 w-56 bg-surfaceHighlight border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-1.5">
                       <button
                          onClick={() => { setActiveEnvId(null); setShowEnvMenu(false); }}
                          className={`w-full flex items-center justify-between p-2 rounded-md text-xs mb-1 ${!activeEnvId ? 'bg-surfaceLight text-white' : 'text-textSecondary hover:text-white hover:bg-surfaceLight/50'}`}
                       >
                         <span>No Environment</span>
                         {!activeEnvId && <Check size={12} className="text-primary" />}
                       </button>
                       <div className="h-px bg-border my-1"></div>
                       {environments.map(env => (
                          <button
                            key={env.id}
                            onClick={() => { setActiveEnvId(env.id); setShowEnvMenu(false); }}
                            className={`w-full flex items-center justify-between p-2 rounded-md text-xs mb-1 ${activeEnvId === env.id ? 'bg-surfaceLight text-white' : 'text-textSecondary hover:text-white hover:bg-surfaceLight/50'}`}
                          >
                            <span className="truncate">{env.name}</span>
                            {activeEnvId === env.id && <Check size={12} className="text-primary" />}
                          </button>
                       ))}
                    </div>
                    <div className="p-2 border-t border-border bg-surfaceLight/30">
                       <button
                         onClick={() => { setShowEnvModal(true); setShowEnvMenu(false); }}
                         className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors justify-center"
                       >
                         <Settings size={12} />
                         Manage Environments
                       </button>
                    </div>
                 </div>
               </>
             )}
           </div>
        </div>

        <div className="flex-1 flex p-4 gap-4 overflow-hidden z-10 pt-16">
          {/* Request Panel (Left/Top) */}
          <div className="w-1/2 flex flex-col min-w-[400px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
            <RequestPanel 
              request={request}
              onRequestChange={setRequest}
              onSend={handleSendRequest}
              onSave={openSaveRequestModal}
              loading={loading}
              environmentVariables={activeEnvVars}
            />
          </div>
          
          {/* Response Panel (Right/Bottom) */}
          <div className="w-1/2 flex flex-col min-w-[400px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
             <ResponsePanel response={response} loading={loading} />
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

      {/* Save Request Modal */}
      {showSaveRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
             <div className="flex items-center gap-2 mb-1 text-primary">
                 <Save size={20} />
                 <h2 className="text-xl font-bold text-white">Save Request</h2>
             </div>
             <p className="text-sm text-textSecondary mb-6">Save this request to a collection for later use.</p>
             
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
                   Save
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