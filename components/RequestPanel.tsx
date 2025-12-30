import React, { useState } from 'react';
import { ApiRequest, HttpMethod, KeyValueItem, AuthMethod } from '../types';
import { Play, Save, Layers, Shield, FileJson, Link, Globe, Code, X, ArrowDownToLine, Info, Plus, Trash2, CheckCircle2, Terminal } from 'lucide-react';
import KeyValueEditor from './KeyValueEditor';
import AutocompleteInput from './AutocompleteInput';
import CustomSelect from './CustomSelect';
import RequestAuth from './request/RequestAuth';
import RequestBody from './request/RequestBody';
import RequestTests from './request/RequestTests';
import RequestScripts from './request/RequestScripts';
import { generateCurl, generateJavascript, generatePython } from '../services/codeGenerator';

interface RequestPanelProps {
  request: ApiRequest;
  onRequestChange: (req: ApiRequest) => void;
  onSend: () => void;
  onSave: () => void;
  loading: boolean;
  environmentVariables?: KeyValueItem[];
  isSavedRequest?: boolean;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const RequestPanel: React.FC<RequestPanelProps> = ({ request, onRequestChange, onSend, onSave, loading, environmentVariables = [], isSavedRequest = false, addToast }) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'tests' | 'scripts'>('params');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
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
      case HttpMethod.PUT: return 'text-indigo-500';
      case HttpMethod.PATCH: return 'text-yellow-500';
      case HttpMethod.HEAD: return 'text-purple-500';
      case HttpMethod.OPTIONS: return 'text-pink-500';
      default: return 'text-foreground';
    }
  };

  const methodOptions = [
    HttpMethod.GET,
    HttpMethod.POST,
    HttpMethod.PUT,
    HttpMethod.PATCH,
    HttpMethod.DELETE,
    HttpMethod.HEAD,
    HttpMethod.OPTIONS,
  ].map(m => ({
    value: m,
    label: m,
    className: getMethodColor(m) + ' font-bold'
  }));

  const generatedCode = () => {
    switch (codeLang) {
      case 'curl': return generateCurl(request);
      case 'js': return generateJavascript(request);
      case 'python': return generatePython(request);
      default: return '';
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Unified Control Center: Method & URL */}
      <div className="px-4 py-3 border-b border-border bg-surfaceLight/30 sticky top-0 z-40">
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex bg-background border border-border rounded-lg focus-within:border-primary/50 transition-all overflow-hidden h-10">
            {/* Method Selector */}
            <div className="h-full min-w-[90px] border-r border-border bg-surfaceLight/20">
              <CustomSelect
                value={request.method}
                onChange={handleMethodChange}
                options={methodOptions}
                className={`w-full h-full px-3 font-bold text-[11px] tracking-wider ${getMethodColor(request.method)}`}
                dropdownClassName="w-32"
              />
            </div>

            <div className="flex-1 h-full min-w-0">
              <AutocompleteInput
                value={request.url}
                onChange={handleUrlChange}
                variables={environmentVariables}
                placeholder="https://api.example.com/v1/endpoint"
                className="w-full h-full bg-transparent px-4 text-foreground text-sm focus:outline-none font-mono placeholder-zinc-700"
              />
            </div>

            {/* In-bar Actions */}
            <div className="h-full flex items-center px-1 gap-0.5 border-l border-border bg-surfaceLight/10">
              <button
                onClick={() => {
                  const curl = prompt('Paste cURL command:');
                  if (curl) handleUrlChange(curl);
                }}
                className="p-1.5 text-textSecondary hover:text-primary transition-all rounded-md"
                title="Import cURL"
              >
                <ArrowDownToLine size={14} />
              </button>
              <button
                onClick={toggleProxy}
                className={`p-1.5 rounded-md transition-all ${request.useProxy
                  ? 'text-primary bg-primary/10'
                  : 'text-textSecondary hover:text-foreground'
                  }`}
                title={request.useProxy ? "Proxy Enabled" : "Proxy Disabled"}
              >
                <Globe size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCodeModal(true)}
              className="p-2.5 text-textSecondary hover:text-foreground hover:bg-surfaceLight rounded-lg transition-all border border-transparent hover:border-border"
              title="Generate Code"
            >
              <Code size={16} />
            </button>

            <button
              onClick={() => setShowMetadataModal(true)}
              className="p-2.5 text-textSecondary hover:text-foreground hover:bg-surfaceLight rounded-lg transition-all"
              title="Request Metadata"
            >
              <Info size={16} />
            </button>

            <div className="flex items-center ml-1 overflow-hidden rounded-lg shadow-lg">
              <button
                onClick={onSave}
                className="h-10 px-4 bg-surfaceHighlight hover:bg-surfaceLight text-foreground font-bold text-xs flex items-center gap-2 border-r border-background transition-all"
                title={isSavedRequest ? "Update Request" : "Save Request"}
              >
                <Save size={14} />
                <span className="hidden xl:inline">{isSavedRequest ? 'Update' : 'Save'}</span>
              </button>
              <button
                onClick={onSend}
                disabled={loading}
                className={`h-10 px-6 bg-primary hover:bg-primaryHover text-white font-bold text-xs flex items-center gap-2 transition-all ${loading ? 'opacity-70' : 'active:brightness-110'}`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white"></div>
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
                <span>{loading ? 'Sending' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Tabs */}
      <div className="flex px-4 border-b border-border bg-surface relative z-30">
        {[
          { id: 'params', label: 'Params', icon: Link },
          { id: 'headers', label: 'Headers', icon: Layers },
          { id: 'auth', label: 'Auth', icon: Shield },
          { id: 'body', label: 'Body', icon: FileJson },
          { id: 'tests', label: 'Tests', icon: CheckCircle2 },
          { id: 'scripts', label: 'Scripts', icon: Terminal }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all relative ${activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-foreground'
              }`}
          >
            <tab.icon size={13} className={activeTab === tab.id ? 'text-primary' : 'text-textSecondary/50'} />
            {tab.label}
            {tab.id === 'params' && request.params && request.params.filter(p => p.enabled).length > 0 && <span className="absolute top-2 right-2 w-1 h-1 rounded-full bg-primary/60"></span>}
            {tab.id === 'headers' && request.headers && request.headers.filter(p => p.enabled).length > 0 && <span className="absolute top-2 right-2 w-1 h-1 rounded-full bg-primary/60"></span>}
            {tab.id === 'tests' && request.testCases && request.testCases.filter(p => p.enabled).length > 0 && <span className="absolute top-2 right-2 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>}
            {tab.id === 'scripts' && request.postRequestScript && <span className="absolute top-2 right-2 w-1 h-1 rounded-full bg-primary/60"></span>}
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

          {activeTab === 'tests' && (
            <RequestTests
              request={request}
              onRequestChange={onRequestChange}
            />
          )}

          {activeTab === 'scripts' && (
            <RequestScripts
              request={request}
              onRequestChange={onRequestChange}
              environmentVariables={environmentVariables}
            />
          )}
        </div>
      </div>

      {/* Metadata Modal */}
      {showMetadataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-border bg-surfaceLight/30">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">Request Metadata</h3>
              </div>
              <button onClick={() => setShowMetadataModal(false)} className="text-textSecondary hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Request Name</label>
                <input
                  type="text"
                  value={request.name}
                  onChange={(e) => onRequestChange({ ...request, name: e.target.value })}
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. Get User Profile"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Summary (Short)</label>
                <input
                  type="text"
                  value={request.summary || ''}
                  onChange={(e) => onRequestChange({ ...request, summary: e.target.value })}
                  className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  placeholder="A brief summary of what this request does"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Description (Long)</label>
                <textarea
                  value={request.description || ''}
                  onChange={(e) => onRequestChange({ ...request, description: e.target.value })}
                  className="w-full h-32 bg-surfaceLight border border-border p-3 rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                  placeholder="Detailed explanation of the endpoint, parameters, and behaviors..."
                />
              </div>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider">Expected Responses</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newResponses = [...(request.expectedResponses || [])];
                      newResponses.push({ id: Math.random().toString(36).substr(2, 9), statusCode: '200', description: 'Success' });
                      onRequestChange({ ...request, expectedResponses: newResponses });
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded text-[10px] font-bold uppercase transition-all"
                  >
                    <Plus size={12} />
                    Add Response
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {(!request.expectedResponses || request.expectedResponses.length === 0) && (
                    <p className="text-[11px] text-textSecondary italic text-center py-4 bg-surfaceLight/10 rounded-lg">No predefined responses. Add one to document this endpoint.</p>
                  )}
                  {request.expectedResponses?.map((res, index) => (
                    <div key={res.id} className="p-3 bg-surfaceLight/20 rounded-lg border border-border/40 group mb-3 last:mb-0 shadow-sm transition-all hover:bg-surfaceLight/30">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={res.statusCode}
                          onChange={(e) => {
                            const newRes = [...request.expectedResponses!];
                            newRes[index] = { ...res, statusCode: e.target.value };
                            onRequestChange({ ...request, expectedResponses: newRes });
                          }}
                          className="w-16 bg-surfaceLight border border-border px-2 py-1 rounded text-xs font-bold text-foreground focus:border-primary outline-none"
                          placeholder="200"
                        />
                        <input
                          type="text"
                          value={res.description}
                          onChange={(e) => {
                            const newRes = [...request.expectedResponses!];
                            newRes[index] = { ...res, description: e.target.value };
                            onRequestChange({ ...request, expectedResponses: newRes });
                          }}
                          className="flex-1 bg-surfaceLight border border-border px-2 py-1 rounded text-xs text-foreground focus:border-primary outline-none"
                          placeholder="Description"
                        />
                        <button
                          onClick={() => {
                            const newRes = request.expectedResponses!.filter((_, i) => i !== index);
                            onRequestChange({ ...request, expectedResponses: newRes });
                          }}
                          className="p-1 text-textSecondary/40 hover:text-danger hover:bg-danger/10 rounded transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <textarea
                        value={res.bodyContent || ''}
                        onChange={(e) => {
                          const newRes = [...request.expectedResponses!];
                          newRes[index] = { ...res, bodyContent: e.target.value };
                          onRequestChange({ ...request, expectedResponses: newRes });
                        }}
                        className="w-full h-20 bg-black/20 border border-border/50 p-2 rounded text-[10px] font-mono text-textSecondary focus:text-foreground focus:border-primary outline-none resize-none"
                        placeholder="Sample JSON response body..."
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface flex justify-end">
              <button
                onClick={() => setShowMetadataModal(false)}
                className="px-6 py-2 bg-primary hover:bg-primaryHover text-white text-sm font-bold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Generation Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-border bg-surfaceLight/30">
              <div className="flex items-center gap-2">
                <Code size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">Generate Code</h3>
              </div>
              <button onClick={() => setShowCodeModal(false)} className="text-textSecondary hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="flex border-b border-border">
              <button onClick={() => setCodeLang('curl')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${codeLang === 'curl' ? 'bg-surfaceLight/80 text-primary border-b-2 border-primary' : 'text-textSecondary hover:bg-surfaceLight/50 hover:text-foreground'}`}>cURL</button>
              <button onClick={() => setCodeLang('js')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${codeLang === 'js' ? 'bg-surfaceLight/80 text-primary border-b-2 border-primary' : 'text-textSecondary hover:bg-surfaceLight/50 hover:text-foreground'}`}>JavaScript</button>
              <button onClick={() => setCodeLang('python')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${codeLang === 'python' ? 'bg-surfaceLight/80 text-primary border-b-2 border-primary' : 'text-textSecondary hover:bg-surfaceLight/50 hover:text-foreground'}`}>Python</button>
            </div>

            <div className="p-0 bg-[#0d0d0d]">
              <textarea
                readOnly
                value={generatedCode()}
                className="w-full h-64 p-4 bg-transparent text-sm font-mono text-foreground outline-none resize-none"
              />
            </div>

            <div className="p-4 border-t border-border bg-surface flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode());
                  setShowCodeModal(false);
                  addToast('Copied to clipboard!', 'success');
                }}
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