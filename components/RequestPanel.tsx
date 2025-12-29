import React, { useState } from 'react';
import { ApiRequest, HttpMethod, KeyValueItem, AuthMethod } from '../types';
import { Play, Save, Layers, Shield, FileJson, Link, Globe, Code, X } from 'lucide-react';
import KeyValueEditor from './KeyValueEditor';
import AutocompleteInput from './AutocompleteInput';
import CustomSelect from './CustomSelect';
import RequestAuth from './request/RequestAuth';
import RequestBody from './request/RequestBody';
import { generateCurl, generateJavascript, generatePython } from '../services/codeGenerator';

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
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeLang, setCodeLang] = useState<'curl' | 'js' | 'python'>('curl');

  const handleMethodChange = (val: string) => {
    onRequestChange({ ...request, method: val as HttpMethod });
  };

  const handleUrlChange = (value: string) => {
    onRequestChange({ ...request, url: value });
  };

  const toggleProxy = () => {
    onRequestChange({ ...request, useProxy: !request.useProxy });
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

  const generatedCode = () => {
      switch(codeLang) {
          case 'curl': return generateCurl(request);
          case 'js': return generateJavascript(request);
          case 'python': return generatePython(request);
          default: return '';
      }
  }

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

            {/* Proxy Toggle */}
            <div className="border-l border-border h-full flex items-center justify-center w-10 px-1">
                <button
                  onClick={toggleProxy}
                  className={`p-1.5 rounded-md transition-all ${
                      request.useProxy 
                        ? 'text-primary bg-primary/10 shadow-[0_0_10px_-3px_rgba(234,88,12,0.5)]' 
                        : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title={request.useProxy ? "Proxy Enabled: Bypassing CORS" : "Proxy Disabled: Direct Browser Request"}
                >
                   <Globe size={16} />
                </button>
            </div>
          </div>
          
          <button 
             onClick={() => setShowCodeModal(true)}
             className="px-3 bg-surfaceHighlight hover:bg-surfaceLight border border-border text-zinc-400 hover:text-white rounded-lg transition-all"
             title="Generate Code"
          >
             <Code size={16} />
          </button>

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
            <RequestAuth 
                request={request}
                onRequestChange={onRequestChange}
                environmentVariables={environmentVariables}
            />
          )}

          {activeTab === 'body' && (
            <RequestBody 
                request={request}
                onRequestChange={onRequestChange}
                environmentVariables={environmentVariables}
            />
          )}
        </div>
      </div>

      {/* Code Generation Modal */}
      {showCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between p-4 border-b border-border bg-surfaceLight/30">
                      <div className="flex items-center gap-2">
                        <Code size={18} className="text-primary" />
                        <h3 className="font-bold text-white">Generate Code</h3>
                      </div>
                      <button onClick={() => setShowCodeModal(false)} className="text-textSecondary hover:text-white"><X size={18} /></button>
                  </div>
                  
                  <div className="flex border-b border-border">
                      <button onClick={() => setCodeLang('curl')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${codeLang === 'curl' ? 'bg-surfaceLight text-white border-b-2 border-primary' : 'text-textSecondary hover:bg-surfaceLight/50'}`}>cURL</button>
                      <button onClick={() => setCodeLang('js')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${codeLang === 'js' ? 'bg-surfaceLight text-white border-b-2 border-primary' : 'text-textSecondary hover:bg-surfaceLight/50'}`}>JavaScript</button>
                      <button onClick={() => setCodeLang('python')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${codeLang === 'python' ? 'bg-surfaceLight text-white border-b-2 border-primary' : 'text-textSecondary hover:bg-surfaceLight/50'}`}>Python</button>
                  </div>

                  <div className="p-0 bg-[#0d0d0d]">
                      <textarea 
                        readOnly 
                        value={generatedCode()} 
                        className="w-full h-64 p-4 bg-transparent text-sm font-mono text-zinc-300 outline-none resize-none"
                      />
                  </div>

                  <div className="p-4 border-t border-border bg-surface flex justify-end">
                      <button 
                        onClick={() => { navigator.clipboard.writeText(generatedCode()); setShowCodeModal(false); }}
                        className="px-4 py-2 bg-primary hover:bg-primaryHover text-white text-sm font-bold rounded-lg"
                      >
                          Copy to Clipboard
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default RequestPanel;