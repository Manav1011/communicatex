import React from 'react';
import { ApiRequest, KeyValueItem } from '../../types';
import { Terminal, Info, Code, Play } from 'lucide-react';

interface RequestScriptsProps {
    request: ApiRequest;
    onRequestChange: (req: ApiRequest) => void;
    environmentVariables: KeyValueItem[];
}

const RequestScripts: React.FC<RequestScriptsProps> = ({ request, onRequestChange }) => {
    const script = request.postRequestScript || '';

    const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onRequestChange({
            ...request,
            postRequestScript: e.target.value
        });
    };

    const snippets = [
        { name: 'Set Variable from JSON', code: 'ctx.env.set("key", ctx.response.data.id);' },
        { name: 'Log Response Data', code: 'ctx.console.log("Data Received:", ctx.response.data);' },
        { name: 'Log Response Time', code: 'ctx.console.log("Request took: " + ctx.response.time + "ms");' },
        { name: 'Error if not 200', code: 'if (ctx.response.statusCode !== 200) {\n  ctx.console.error("API Error: " + ctx.response.statusCode);\n  ctx.toast("Request Failed", "error");\n}' },
        { name: 'Check Missing Field', code: 'if (!ctx.response.data.auth_token) {\n  ctx.console.error("Security Warning: auth_token is missing!");\n}' },
        { name: 'Log Header Value', code: 'ctx.console.log("Content-Type:", ctx.response.headers["content-type"]);' },
    ];

    const insertSnippet = (code: string) => {
        onRequestChange({
            ...request,
            postRequestScript: script + (script ? '\n' : '') + code
        });
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Terminal size={16} className="text-primary" />
                        Post-response Script
                    </h3>
                    <p className="text-[11px] text-textSecondary mt-1">
                        JavaScript code that runs automatically after the response is received.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 flex-1 min-h-[400px]">
                {/* Editor Area */}
                <div className="col-span-8 flex flex-col gap-2 h-full">
                    <div className="flex-1 relative group">
                        <textarea
                            value={script}
                            onChange={handleScriptChange}
                            placeholder="// Write your Javascript here..."
                            className="w-full h-full bg-background border border-border rounded-xl p-4 font-mono text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none scrollbar-hide"
                            spellCheck={false}
                        />
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Code size={14} className="text-textSecondary" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <Info size={14} className="text-primary shrink-0" />
                        <p className="text-[10px] text-textSecondary leading-relaxed">
                            Use the <code className="text-primary">ctx</code> object to access the response and manage your workspace.
                            Example: <code className="bg-black/20 px-1 rounded">ctx.env.set("token", ctx.response.data.token)</code>
                        </p>
                    </div>
                </div>

                {/* Snippets Area */}
                <div className="col-span-4 flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest px-1">Quick Snippets</span>
                    <div className="flex flex-col gap-2">
                        {snippets.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => insertSnippet(s.code)}
                                className="flex flex-col items-start text-left p-3 rounded-xl bg-surfaceLight/50 border border-border hover:border-primary/30 hover:bg-surfaceLight transition-all group"
                            >
                                <span className="text-[11px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{s.name}</span>
                                <code className="text-[9px] text-textSecondary/60 font-mono truncate w-full">{s.code}</code>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequestScripts;
