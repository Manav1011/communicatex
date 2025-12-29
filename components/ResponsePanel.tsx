import React, { useState } from 'react';
import { ApiResponse } from '../types';
import { Clock, Database, AlertCircle, CheckCircle, Terminal, FileCode, Layers, Cookie, Copy, Download, Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react';

interface ResponsePanelProps {
  response: ApiResponse | null;
  loading: boolean;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({ response, loading }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');
  const [isExpanded, setIsExpanded] = useState(false);

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
      <div className="h-full flex flex-col items-center justify-center text-textSecondary opacity-40 bg-surface">
        <Terminal size={64} strokeWidth={1} className="mb-6" />
        <p className="text-sm font-medium">Ready to capture response</p>
      </div>
    );
  }

  const isError = response.statusCode === 0 || response.statusCode >= 400;
  
  // Custom status color logic for the dark theme
  const getStatusColor = (code: number) => {
    if (code === 0 || code >= 500) return 'text-danger bg-danger/10 border-danger/20';
    if (code >= 400) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    if (code >= 300) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
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
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
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

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Response Meta Bar */}
      <div className="flex flex-col border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-6 p-4 pb-2">
            <div className={`px-3 py-1 rounded-md border text-sm font-mono font-bold flex items-center gap-2 ${statusStyle}`}>
                {isError ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
                {response.statusCode === 0 ? 'ERROR' : `${response.statusCode} ${response.statusText}`}
            </div>
            
            <div className="h-4 w-px bg-border"></div>

            <div className="flex items-center gap-2">
            <Clock size={14} className="text-textSecondary" />
            <span className="text-xs text-textSecondary uppercase font-bold tracking-wider">Time</span>
            <span className="text-sm font-mono text-zinc-200">
                {response.time}ms
            </span>
            </div>

            <div className="flex items-center gap-2">
            <Database size={14} className="text-textSecondary" />
            <span className="text-xs text-textSecondary uppercase font-bold tracking-wider">Size</span>
            <span className="text-sm font-mono text-zinc-200">
                {(response.size / 1024).toFixed(2)} KB
            </span>
            </div>
        </div>

        {/* Tabs and Actions */}
        <div className="flex items-center justify-between px-2 border-b border-border">
          <div className="flex">
             <button
                onClick={() => setActiveTab('body')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'body' 
                    ? 'border-primary text-white' 
                    : 'border-transparent text-textSecondary hover:text-zinc-300'
                }`}
              >
                <FileCode size={14} /> Body
              </button>
              <button
                onClick={() => setActiveTab('headers')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'headers' 
                    ? 'border-primary text-white' 
                    : 'border-transparent text-textSecondary hover:text-zinc-300'
                }`}
              >
                <Layers size={14} /> Headers
              </button>
          </div>
          
          {activeTab === 'body' && response && !response.error && (
            <div className="flex items-center gap-2 px-2">
              {isJson && (
                <button
                  onClick={() => setViewMode(viewMode === 'pretty' ? 'raw' : 'pretty')}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-textSecondary hover:text-white hover:bg-surfaceLight rounded transition-all"
                  title={viewMode === 'pretty' ? 'Raw View' : 'Pretty View'}
                >
                  {viewMode === 'pretty' ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{viewMode === 'pretty' ? 'Raw' : 'Pretty'}</span>
                </button>
              )}
              <button
                onClick={() => copyToClipboard(responseText)}
                className="p-1.5 text-textSecondary hover:text-white hover:bg-surfaceLight rounded transition-all"
                title="Copy to clipboard"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={downloadResponse}
                className="p-1.5 text-textSecondary hover:text-white hover:bg-surfaceLight rounded transition-all"
                title="Download response"
              >
                <Download size={14} />
              </button>
            </div>
          )}
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
                    <div className="w-full h-full text-sm font-mono text-zinc-300">
                        {isImage ? (
                            <div className="flex items-center justify-center h-full p-8 bg-surfaceLight/20">
                                {/* If data is base64 or URL, render it. Assuming data is URI if proxy, or Base64/Blob if handled by executor differently */}
                                {/* For simple text proxy, image data might be raw text. Real app needs blob handling. 
                                    Assuming standard URL fetch for now if it's a direct link, or we'd need Blob support in executor.
                                    This example assumes 'data' is renderable if it's a URL or if we can handle it.
                                */}
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
                        ) : (
                            <pre className={`whitespace-pre-wrap break-all p-4 font-mono text-sm ${
                              viewMode === 'pretty' && isJson ? 'text-zinc-300' : 'text-zinc-300'
                            }`}>
                                {responseText}
                            </pre>
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
                                  <td className="py-2 pr-4 border-b border-border/50 font-mono text-primary text-xs break-all align-top">{key}</td>
                                  <td className="py-2 border-b border-border/50 font-mono text-zinc-300 text-xs break-all">{value}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsePanel;