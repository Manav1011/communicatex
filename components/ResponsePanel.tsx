import React from 'react';
import { ApiResponse } from '../types';
import { Clock, Database, AlertCircle, CheckCircle, Terminal } from 'lucide-react';

interface ResponsePanelProps {
  response: ApiResponse | null;
  loading: boolean;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({ response, loading }) => {
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

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Response Meta Bar */}
      <div className="flex items-center gap-6 p-4 border-b border-border bg-surface/50 backdrop-blur-sm">
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

      {/* Response Body */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-auto p-4 custom-scrollbar">
          {response.error ? (
            <div className="bg-red-950/30 border border-red-900/50 p-6 rounded-lg text-red-200 text-sm">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <AlertCircle size={16} /> Request Failed
              </h4>
              <p className="font-mono opacity-80">{response.error}</p>
            </div>
          ) : (
            <div className="w-full h-full text-sm font-mono text-zinc-300">
               {/* Simple pretty print with a darker background for code */}
              <pre className="whitespace-pre-wrap break-all p-1">
                {typeof response.data === 'object' 
                  ? JSON.stringify(response.data, null, 2) 
                  : response.data}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsePanel;