import React, { useState } from 'react';
import { ApiRequest, HttpMethod, KeyValueItem, AuthMethod } from '../types';
import { Play, Save, Layers, Shield, FileJson, Link, ChevronDown } from 'lucide-react';
import KeyValueEditor from './KeyValueEditor';
import AutocompleteInput from './AutocompleteInput';
import CustomSelect from './CustomSelect';

interface RequestPanelProps {
  request: ApiRequest;
  onRequestChange: (req: ApiRequest) => void;
  onSend: () => void;
  onSave: () => void;
  loading: boolean;
  environmentVariables?: KeyValueItem[];
}

const RequestPanel: React.FC<RequestPanelProps> = ({ request, onRequestChange, onSend, onSave, loading, environmentVariables = [] }) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'auth' | 'body'>('params');

  const handleMethodChange = (val: string) => {
    onRequestChange({ ...request, method: val as HttpMethod });
  };

  const handleUrlChange = (value: string) => {
    onRequestChange({ ...request, url: value });
  };

  const updateParams = (items: KeyValueItem[]) => onRequestChange({ ...request, params: items });
  const updateHeaders = (items: KeyValueItem[]) => onRequestChange({ ...request, headers: items });
  
  const getMethodColor = (m: string) => {
    switch (m) {
      case HttpMethod.GET: return 'text-blue-500';
      case HttpMethod.POST: return 'text-emerald-500';
      case HttpMethod.DELETE: return 'text-red-500';
      case HttpMethod.PUT: return 'text-orange-500';
      case HttpMethod.PATCH: return 'text-yellow-500';
      default: return 'text-zinc-200';
    }
  };

  const methodOptions = Object.values(HttpMethod).map(m => ({
    value: m,
    label: m,
    className: getMethodColor(m) + ' font-bold'
  }));

  const authOptions = [
    { value: AuthMethod.NONE, label: 'No Authentication' },
    { value: AuthMethod.BEARER, label: 'Bearer Token' },
    { value: AuthMethod.BASIC, label: 'Basic Auth' },
    { value: AuthMethod.API_KEY, label: 'API Key' },
  ];

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Top Bar: Method & URL */}
      <div className="p-4 border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex gap-2 h-11">
          <div className="flex-1 flex bg-surfaceLight border border-border rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all z-20">
            {/* Method Selector */}
            <div className="border-r border-border h-full min-w-[110px]">
               <CustomSelect 
                 value={request.method}
                 onChange={handleMethodChange}
                 options={methodOptions}
                 className={`w-full h-full px-4 font-bold text-sm ${getMethodColor(request.method)}`}
                 dropdownClassName="w-32"
               />
            </div>

            <div className="flex-1 h-full min-w-0">
               <AutocompleteInput 
                  value={request.url}
                  onChange={handleUrlChange}
                  variables={environmentVariables}
                  placeholder="https://api.example.com/v1/endpoint"
                  className="w-full h-full bg-transparent px-4 text-zinc-100 text-sm focus:outline-none font-mono placeholder-zinc-600"
               />
            </div>
          </div>
          
          <button 
            onClick={onSave}
            className="px-4 bg-surfaceHighlight hover:bg-surfaceLight border border-border text-zinc-200 font-bold rounded-lg flex items-center gap-2 transition-all active:scale-95"
            title="Save to Collection"
          >
             <Save size={16} />
             <span className="hidden xl:inline">Save</span>
          </button>

          <button 
            onClick={onSend}
            disabled={loading}
            className={`px-6 bg-primary hover:bg-primaryHover text-white font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-orange-900/20 ${loading ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
          >
            {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
            ) : (
                <Play size={16} fill="currentColor" /> 
            )}
            <span className="hidden sm:inline">{loading ? 'Sending' : 'Send'}</span>
          </button>
        </div>
      </div>

      {/* Configuration Tabs */}
      <div className="flex px-2 pt-2 border-b border-border bg-surface">
        {[
          { id: 'params', label: 'Params', icon: Link },
          { id: 'headers', label: 'Headers', icon: Layers },
          { id: 'auth', label: 'Auth', icon: Shield },
          { id: 'body', label: 'Body', icon: FileJson }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id 
                ? 'border-primary text-white bg-surfaceLight/50 rounded-t-lg' 
                : 'border-transparent text-textSecondary hover:text-zinc-300 hover:bg-surfaceLight/30 rounded-t-lg'
            }`}
          >
            <tab.icon size={14} className={activeTab === tab.id ? 'text-primary' : ''} />
            {tab.label}
            {tab.id === 'params' && request.params.filter(p => p.enabled).length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1"></span>}
            {tab.id === 'headers' && request.headers.filter(p => p.enabled).length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1"></span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-0 overflow-hidden bg-surface relative">
        <div className="absolute inset-0 p-4 overflow-y-auto">
          {activeTab === 'params' && (
            <KeyValueEditor 
              title="Query Parameters" 
              items={request.params} 
              onChange={updateParams} 
              variables={environmentVariables}
            />
          )}

          {activeTab === 'headers' && (
            <KeyValueEditor 
              title="HTTP Headers" 
              items={request.headers} 
              onChange={updateHeaders} 
              variables={environmentVariables}
            />
          )}

          {activeTab === 'auth' && (
            <div className="h-full flex flex-col max-w-xl animate-in fade-in duration-300">
              <div className="mb-6">
                  <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Authentication Type</label>
                  <CustomSelect 
                    value={request.auth.type}
                    onChange={(val) => onRequestChange({...request, auth: { ...request.auth, type: val as AuthMethod }})}
                    options={authOptions}
                    className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-sm text-zinc-200"
                  />
              </div>

              {request.auth.type === AuthMethod.BEARER && (
                <div>
                  <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Token</label>
                  <div className="h-32 bg-surfaceLight border border-border rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary relative focus-within:z-10">
                    <AutocompleteInput
                      type="textarea"
                      value={request.auth.token || ''}
                      onChange={(val) => onRequestChange({...request, auth: { ...request.auth, token: val }})}
                      variables={environmentVariables}
                      placeholder="Enter your JWT or OAuth token here"
                      className="w-full h-full bg-transparent p-3 text-sm text-zinc-200 font-mono outline-none resize-none placeholder-zinc-600"
                    />
                  </div>
                </div>
              )}

              {request.auth.type === AuthMethod.BASIC && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Username</label>
                    <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
                       <AutocompleteInput 
                          value={request.auth.username || ''}
                          onChange={(val) => onRequestChange({...request, auth: { ...request.auth, username: val }})}
                          variables={environmentVariables}
                          className="w-full bg-transparent p-3 text-sm text-zinc-200 outline-none"
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Password</label>
                     <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
                        <AutocompleteInput 
                            type="password"
                            value={request.auth.password || ''}
                            onChange={(val) => onRequestChange({...request, auth: { ...request.auth, password: val }})}
                            variables={environmentVariables}
                            className="w-full bg-transparent p-3 text-sm text-zinc-200 outline-none"
                        />
                    </div>
                  </div>
                </div>
              )}

              {request.auth.type === AuthMethod.API_KEY && (
                <div className="space-y-5">
                  <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Key</label>
                         <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
                            <AutocompleteInput 
                                placeholder="X-API-KEY"
                                value={request.auth.apiKeyKey || ''}
                                onChange={(val) => onRequestChange({...request, auth: { ...request.auth, apiKeyKey: val }})}
                                variables={environmentVariables}
                                className="w-full bg-transparent p-3 text-sm text-zinc-200 outline-none"
                            />
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Value</label>
                         <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
                            <AutocompleteInput 
                                placeholder="Key Value"
                                value={request.auth.apiKeyValue || ''}
                                onChange={(val) => onRequestChange({...request, auth: { ...request.auth, apiKeyValue: val }})}
                                variables={environmentVariables}
                                className="w-full bg-transparent p-3 text-sm text-zinc-200 outline-none"
                            />
                        </div>
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-3">Add To</label>
                      <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer group">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${request.auth.apiKeyLocation === 'header' ? 'border-primary' : 'border-zinc-600'}`}>
                                {request.auth.apiKeyLocation === 'header' && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                              </div>
                              <input 
                                type="radio" 
                                className="hidden"
                                name="apikey_loc" 
                                checked={request.auth.apiKeyLocation === 'header'} 
                                onChange={() => onRequestChange({...request, auth: {...request.auth, apiKeyLocation: 'header'}})}
                              />
                              <span className="text-sm text-zinc-300 group-hover:text-white">Header</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${request.auth.apiKeyLocation === 'query' ? 'border-primary' : 'border-zinc-600'}`}>
                                {request.auth.apiKeyLocation === 'query' && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                              </div>
                              <input 
                                type="radio" 
                                className="hidden"
                                name="apikey_loc" 
                                checked={request.auth.apiKeyLocation === 'query'} 
                                onChange={() => onRequestChange({...request, auth: {...request.auth, apiKeyLocation: 'query'}})}
                              />
                              <span className="text-sm text-zinc-300 group-hover:text-white">Query Params</span>
                          </label>
                      </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'body' && (
            <div className="h-full flex flex-col animate-in fade-in duration-300">
              <div className="mb-4 flex gap-6 border-b border-border pb-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${request.bodyType === 'none' ? 'border-primary' : 'border-zinc-600'}`}>
                    {request.bodyType === 'none' && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                  </div>
                  <input 
                    key="radio-none"
                    type="radio" 
                    className="hidden"
                    name="bodyType" 
                    checked={request.bodyType === 'none'}
                    onChange={() => onRequestChange({...request, bodyType: 'none'})}
                  />
                  <span className="text-sm text-zinc-300 group-hover:text-white">None</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${request.bodyType === 'json' ? 'border-primary' : 'border-zinc-600'}`}>
                    {request.bodyType === 'json' && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                  </div>
                  <input 
                    key="radio-json"
                    type="radio" 
                    className="hidden"
                    name="bodyType" 
                    checked={request.bodyType === 'json'}
                    onChange={() => onRequestChange({...request, bodyType: 'json'})}
                  />
                  <span className="text-sm text-zinc-300 group-hover:text-white">JSON</span>
                </label>
              </div>
              {request.bodyType === 'json' && (
                <div className="flex-1 relative bg-surfaceLight border border-border rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary focus-within:z-10">
                  <AutocompleteInput 
                    type="textarea"
                    value={request.bodyContent}
                    onChange={(val) => onRequestChange({ ...request, bodyContent: val })}
                    variables={environmentVariables}
                    className="absolute inset-0 w-full h-full bg-transparent p-4 text-sm font-mono text-zinc-200 outline-none resize-none leading-relaxed placeholder-zinc-600"
                    placeholder="{\n  \"key\": \"value\"\n}"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestPanel;