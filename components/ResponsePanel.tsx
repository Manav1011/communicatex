import React, { useState } from 'react';
import { ApiResponse } from '../types';
import { Clock, Database, AlertCircle, CheckCircle, Terminal, FileCode, Layers, Cookie, Copy, Download, Maximize2, Minimize2, Eye, EyeOff, ChevronRight, ChevronDown, GitCompare, Bookmark } from 'lucide-react';

interface ResponsePanelProps {
  response: ApiResponse | null;
  loading: boolean;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({ response, loading, addToast }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'diff' | 'tests'>('body');
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');
  const [isExpanded, setIsExpanded] = useState(false);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [pinnedResponse, setPinnedResponse] = useState<ApiResponse | null>(null);

  const togglePath = (path: string) => {
    const next = new Set(collapsedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setCollapsedPaths(next);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-textSecondary bg-surface">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-border border-t-primary animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium animate-pulse">Processing Request...</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-textSecondary opacity-70 bg-surface">
        <Terminal size={64} strokeWidth={1} className="mb-6" />
        <p className="text-sm font-medium">Ready to capture response</p>
      </div>
    );
  }

  const isError = response.statusCode === 0 || response.statusCode >= 400;

  // Custom status color logic for the dark theme
  const getStatusColor = (code: number) => {
    if (code === 0 || code >= 500) return 'text-danger bg-danger/10 border-danger/20';
    if (code >= 400) return 'text-indigo-600 dark:text-indigo-400 bg-indigo-600/10 border-indigo-600/20';
    if (code >= 300) return 'text-cyan-600 dark:text-cyan-400 bg-cyan-600/10 border-cyan-600/20';
    return 'text-success bg-success/10 border-success/20'; // 200s
  };

  const statusStyle = getStatusColor(response.statusCode);

  // Detect Content Type
  const contentType = response.headers['content-type'] || '';
  const isImage = contentType.startsWith('image/');
  const isHtml = contentType.includes('text/html');
  const isJson = contentType.includes('application/json') || (typeof response.data === 'object');

  // Format JSON response
  const formatJson = (data: any): string => {
    try {
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      }
      return JSON.stringify(data, null, 2);
    } catch {
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      addToast('Failed to copy', 'error');
    }
  };

  const downloadResponse = () => {
    const content = typeof response.data === 'object'
      ? JSON.stringify(response.data, null, 2)
      : response.data;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.${isJson ? 'json' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const responseText = typeof response.data === 'object'
    ? (viewMode === 'pretty' ? formatJson(response.data) : JSON.stringify(response.data))
    : response.data;

  const renderJsonNode = (val: any, path: string = 'root', isLast: boolean = true, depth: number = 0): React.ReactNode => {
    const isCollapsible = val !== null && typeof val === 'object';
    const isCollapsed = collapsedPaths.has(path);
    const indent = depth * 20;

    const copyPath = (e: React.MouseEvent, p: string) => {
      e.stopPropagation();
      const cleanPath = p.replace(/^root\./, '').replace(/^root/, '');
      navigator.clipboard.writeText(cleanPath);
      addToast(`Path copied: ${cleanPath}`, 'success');
    };

    const renderValue = (v: any, currentPath: string) => {
      const className = "transition-all hover:bg-primary/20 hover:text-white rounded px-0.5 cursor-pointer";
      if (v === null) return <span onClick={(e) => copyPath(e, currentPath)} className={`text-zinc-500 ${className}`}>null</span>;
      if (typeof v === 'string') return <span onClick={(e) => copyPath(e, currentPath)} className={`text-emerald-400 ${className}`}>"{v}"</span>;
      if (typeof v === 'number') return <span onClick={(e) => copyPath(e, currentPath)} className={`text-blue-400 ${className}`}>{v}</span>;
      if (typeof v === 'boolean') return <span onClick={(e) => copyPath(e, currentPath)} className={`text-orange-400 ${className}`}>{v.toString()}</span>;
      return null;
    };

    if (!isCollapsible) {
      return (
        <div className="flex items-start hover:bg-surfaceLight/20 px-2 group" style={{ paddingLeft: indent }}>
          <div className="flex-1 flex gap-2">
            {renderValue(val, path)}
            {!isLast && <span className="text-foreground">,</span>}
          </div>
        </div>
      );
    }

    const isArray = Array.isArray(val);
    const entries = isArray ? val.map((v: any, i: number) => [i, v]) : Object.entries(val);
    const isEmpty = entries.length === 0;

    return (
      <div key={path} className="flex flex-col">
        <div
          className="flex items-start hover:bg-surfaceLight/20 px-2 group cursor-pointer"
          style={{ paddingLeft: indent }}
          onClick={(e) => { e.stopPropagation(); togglePath(path); }}
        >
          <div className="w-4 h-4 mt-1 mr-1 flex items-center justify-center text-textSecondary/50 group-hover:text-primary">
            {!isEmpty && (isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />)}
          </div>
          <div className="flex-1 flex gap-1">
            <span className="text-foreground font-bold">{isArray ? '[' : '{'}</span>
            {isCollapsed && <span className="text-textSecondary/60 bg-surfaceLight/30 px-1 rounded text-[10px] animate-pulse">...</span>}
            {isCollapsed && <span className="text-foreground font-bold">{isArray ? ']' : '}'}</span>}
            {isCollapsed && !isLast && <span className="text-foreground">,</span>}
          </div>
        </div>

        {!isCollapsed && (
          <div className="flex flex-col">
            {entries.map(([key, childVal], i) => (
              <div key={`${path}-${key}`} className="flex flex-col">
                <div className="flex items-start hover:bg-surfaceLight/20 px-2 group w-full" style={{ paddingLeft: indent + 20 }}>
                  <div className="w-4 mr-1 shrink-0" /> {/* Chevron gutter space */}
                  <div className="flex gap-1 items-start min-w-0 flex-1">
                    {!isArray && (
                      <span
                        onClick={(e) => copyPath(e, `${path}.${key}`)}
                        className="text-purple-400 font-medium shrink-0 cursor-pointer hover:bg-primary/20 rounded px-0.5 transition-all"
                      >
                        "{key}":
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      {typeof childVal === 'object' && childVal !== null ? (
                        renderJsonNode(childVal, isArray ? `${path}[${key}]` : `${path}.${key}`, i === entries.length - 1, 0)
                      ) : (
                        <div className="inline-flex gap-1">
                          {renderValue(childVal, isArray ? `${path}[${key}]` : `${path}.${key}`)}
                          {i === entries.length - 1 ? null : <span className="text-foreground">,</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isCollapsed && (
          <div className="flex items-start hover:bg-surfaceLight/20 px-2 group" style={{ paddingLeft: indent }}>
            <div className="w-4 mr-1" />
            <span className="text-foreground font-bold">{isArray ? ']' : '}'}</span>
            {!isLast && <span className="text-foreground">,</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Response Meta Bar */}
      <div className="flex flex-col border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-6 p-4 pb-2">
          <div className={`px-3 py-1 rounded-md border border-border text-sm font-mono font-bold flex items-center gap-2 ${statusStyle}`}>
            {isError ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
            {response.statusCode === 0 ? 'ERROR' : `${response.statusCode} ${response.statusText}`}
          </div>

          <div className="h-4 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <Clock size={14} className="text-textSecondary" />
            <span className="text-xs text-textSecondary uppercase font-bold tracking-wider">Time</span>
            <span className="text-sm font-mono text-foreground">
              {response.time}ms
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Database size={14} className="text-textSecondary" />
            <span className="text-xs text-textSecondary uppercase font-bold tracking-wider">Size</span>
            <span className="text-sm font-mono text-foreground">
              {(response.size / 1024).toFixed(2)} KB
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                setPinnedResponse(response);
                addToast('Response pinned for comparison', 'success');
              }}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-all ${pinnedResponse ? 'bg-primary/20 text-primary border border-primary/30' : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/50 border border-transparent'}`}
              title="Pin this response to compare with others"
            >
              <Bookmark size={14} fill={pinnedResponse ? "currentColor" : "none"} />
              {pinnedResponse ? 'Pinned' : 'Pin'}
            </button>
          </div>
        </div>

        {/* Tabs and Actions */}
        <div className="flex items-center justify-between px-2 border-b border-border">
          <div className="flex">
            <button
              onClick={() => { setActiveTab('body'); setViewMode('pretty'); }}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'body' && viewMode === 'pretty'
                ? 'border-primary text-primary'
                : 'border-transparent text-textSecondary hover:text-foreground'
                }`}
            >
              {isJson ? 'JSON' : 'Pretty'}
            </button>
            <button
              onClick={() => { setActiveTab('body'); setViewMode('raw'); }}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'body' && viewMode === 'raw'
                ? 'border-primary text-primary'
                : 'border-transparent text-textSecondary hover:text-foreground'
                }`}
            >
              Raw
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'headers'
                ? 'border-primary text-primary'
                : 'border-transparent text-textSecondary hover:text-foreground'
                }`}
            >
              Headers {Object.keys(response.headers).length > 0 && <span className="text-[10px] ml-1 bg-surfaceHighlight px-1 rounded opacity-60">{Object.keys(response.headers).length}</span>}
            </button>
            {pinnedResponse && response && (
              <button
                onClick={() => setActiveTab('diff')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'diff'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-textSecondary hover:text-foreground'
                  }`}
              >
                <GitCompare size={14} />
                Diff
              </button>
            )}
            {response.testResults && (
              <button
                onClick={() => setActiveTab('tests')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'tests'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-textSecondary hover:text-foreground'
                  }`}
              >
                Tests
                <span className={`text-[10px] ml-1 px-1.5 rounded-full font-bold ${response.testResults.every(r => r.passed)
                  ? 'bg-success/20 text-success'
                  : 'bg-danger/20 text-danger'
                  }`}>
                  {response.testResults.filter(r => r.passed).length}/{response.testResults.length}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-2">
            <button
              onClick={() => copyToClipboard(responseText)}
              className="p-1.5 text-textSecondary hover:text-foreground hover:bg-surfaceLight rounded transition-all"
              title="Copy to clipboard"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={downloadResponse}
              className="p-1.5 text-textSecondary hover:text-foreground hover:bg-surfaceLight rounded transition-all"
              title="Download response"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Response Body */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-auto custom-scrollbar">
          {activeTab === 'body' && (
            <>
              {response.error ? (
                <div className="p-6">
                  <div className="bg-red-950/30 border border-red-900/50 p-6 rounded-lg text-red-200 text-sm">
                    <h4 className="font-bold mb-2 flex items-center gap-2">
                      <AlertCircle size={16} /> Request Failed
                    </h4>
                    <p className="font-mono opacity-80">{response.error}</p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full text-sm font-mono text-foreground">
                  {isImage ? (
                    <div className="flex items-center justify-center h-full p-8 bg-surfaceLight/20">
                      <div className="text-center">
                        <p className="mb-4 text-textSecondary">Image Preview</p>
                        <img src={response.url || ''} alt="Response" className="max-w-full max-h-[400px] rounded border border-border" />
                      </div>
                    </div>
                  ) : isHtml ? (
                    <iframe
                      title="Response Preview"
                      srcDoc={response.data}
                      className="w-full h-full bg-white border-none"
                      sandbox="allow-scripts"
                    />
                  ) : viewMode === 'pretty' && isJson ? (
                    <div className="py-4 select-text">
                      {renderJsonNode(response.data)}
                    </div>
                  ) : (
                    <div className="flex h-full font-mono text-xs leading-relaxed">
                      {/* Line Numbers */}
                      <div className="w-12 bg-surfaceLight/20 text-textSecondary/40 text-right pr-3 pt-4 select-none border-r border-border flex-shrink-0">
                        {responseText.split('\n').map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                      {/* Code Content */}
                      <pre className="flex-1 p-4 overflow-x-auto whitespace-pre scrollbar-hide">
                        {responseText}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'headers' && (
            <div className="p-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="text-xs font-bold text-textSecondary uppercase tracking-wider border-b border-border pb-2 w-1/3">Key</th>
                    <th className="text-xs font-bold text-textSecondary uppercase tracking-wider border-b border-border pb-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(response.headers).map(([key, value]) => (
                    <tr key={key} className="group hover:bg-surfaceLight/30">
                      <td className="py-2 pr-4 border-b border-border font-mono text-primary text-xs break-all align-top">{key}</td>
                      <td className="py-2 border-b border-border font-mono text-foreground text-xs break-all">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'diff' && pinnedResponse && response && (
            <div className="p-6">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between p-4 bg-surfaceHighlight/20 rounded-xl border border-white/5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-textSecondary uppercase font-bold tracking-wider">Comparing with</span>
                    <span className="text-sm font-bold text-foreground truncate max-w-sm">
                      {pinnedResponse.url || 'Original Pinned Response'}
                    </span>
                  </div>
                  <button
                    onClick={() => setPinnedResponse(null)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-textSecondary hover:text-danger transition-all"
                  >
                    Clear Pin
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 font-mono text-sm leading-relaxed">
                  {(() => {
                    const diffs: React.ReactNode[] = [];
                    const current = typeof response.data === 'object' ? response.data : {};
                    const pinned = typeof pinnedResponse.data === 'object' ? pinnedResponse.data : {};

                    const allKeys = Array.from(new Set([...Object.keys(current), ...Object.keys(pinned)]));

                    allKeys.forEach(key => {
                      const cVal = JSON.stringify(current[key]);
                      const pVal = JSON.stringify(pinned[key]);

                      if (!(key in pinned)) {
                        diffs.push(
                          <div key={key} className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <span className="text-xs text-emerald-400 font-bold uppercase mb-1 block tracking-widest">Added</span>
                            <div className="flex gap-2">
                              <span className="text-foreground font-bold">"{key}":</span>
                              <span className="text-emerald-400">{cVal}</span>
                            </div>
                          </div>
                        );
                      } else if (!(key in current)) {
                        diffs.push(
                          <div key={key} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <span className="text-xs text-red-400 font-bold uppercase mb-1 block tracking-widest">Removed</span>
                            <div className="flex gap-2">
                              <span className="text-textSecondary line-through font-bold">"{key}":</span>
                              <span className="text-red-400 line-through">{pVal}</span>
                            </div>
                          </div>
                        );
                      } else if (cVal !== pVal) {
                        diffs.push(
                          <div key={key} className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                            <span className="text-xs text-primary font-bold uppercase mb-1 block tracking-widest">Modified</span>
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <span className="text-foreground font-bold">"{key}":</span>
                                <span className="text-textSecondary line-through text-xs px-1 bg-white/5 rounded italic">{pVal}</span>
                                <ChevronRight size={14} className="text-primary mt-1" />
                                <span className="text-primary font-bold">{cVal}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    });

                    if (diffs.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center p-20 text-textSecondary bg-surfaceLight/10 rounded-2xl border border-dashed border-white/10">
                          <CheckCircle size={48} className="text-success mb-4 opacity-50" />
                          <p className="font-bold text-foreground">Perfect Match!</p>
                          <p className="text-xs">No structural differences found between these responses.</p>
                        </div>
                      );
                    }

                    return diffs;
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tests' && response.testResults && (
            <div className="p-4 space-y-3">
              {response.testResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${result.passed
                      ? 'bg-success/5 border-success/10 shadow-sm'
                      : 'bg-danger/5 border-danger/10 shadow-sm'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${result.passed ? 'text-success' : 'text-danger'}`}>
                      {result.passed ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-bold text-foreground">
                          {result.testCaseName}
                        </h3>
                        {result.passed ? (
                          <span className="text-[10px] font-bold text-success uppercase tracking-wider bg-success/10 px-2 py-0.5 rounded-full">Pass</span>
                        ) : (
                          <span className="text-[10px] font-bold text-danger uppercase tracking-wider bg-danger/10 px-2 py-0.5 rounded-full">Fail</span>
                        )}
                      </div>
                      <p className="text-xs text-textSecondary font-medium leading-relaxed">
                        {result.message}
                      </p>
                      {!result.passed && result.actualValue !== undefined && (
                        <div className="mt-2 text-[11px] font-mono bg-black/20 p-2 rounded-lg border border-white/5 text-textSecondary overflow-x-auto">
                          <span className="text-danger/60 mr-1">Actual:</span>
                          {typeof result.actualValue === 'object' ? JSON.stringify(result.actualValue) : String(result.actualValue)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {response.testResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bookmark size={48} className="text-textSecondary/20 mb-4" />
                  <p className="text-sm font-medium text-foreground">No test results to show</p>
                  <p className="text-xs text-textSecondary mt-1">Define assertions in the "Tests" tab of your request to see results here.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsePanel;