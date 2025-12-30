import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, FileText, Folder, Zap, Palette, Layout, Trash2, Plus, LogOut, ChevronRight } from 'lucide-react';
import { ApiRequest, SavedRequest } from '../types';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    savedRequests: SavedRequest[];
    onSelectRequest: (req: SavedRequest) => void;
    onSelectAction: (actionId: string, params?: any) => void;
}

interface Action {
    id: string;
    label: string;
    icon: React.ElementType;
    category: 'General' | 'Theme' | 'Layout';
    params?: any;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, savedRequests, onSelectRequest, onSelectAction }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const actions: Action[] = [
        { id: 'new_request', label: 'New Request', icon: Plus, category: 'General' },
        { id: 'clear_history', label: 'Clear History', icon: Trash2, category: 'General' },
        { id: 'logout', label: 'Log Out', icon: LogOut, category: 'General' },

        { id: 'theme_dark', label: 'Theme: Classic Dark', icon: Palette, category: 'Theme', params: 'dark' },
        { id: 'theme_light', label: 'Theme: Default Light', icon: Palette, category: 'Theme', params: 'light' },
        { id: 'theme_midnight', label: 'Theme: Midnight Blue', icon: Palette, category: 'Theme', params: 'midnight' },
        { id: 'theme_aubergine', label: 'Theme: Aubergine', icon: Palette, category: 'Theme', params: 'aubergine' },
        { id: 'theme_nord', label: 'Theme: Nord Ice', icon: Palette, category: 'Theme', params: 'nord' },
        { id: 'theme_forest', label: 'Theme: Emerald Forest', icon: Palette, category: 'Theme', params: 'forest' },
        { id: 'theme_hacker', label: 'Theme: Hacker/Matrix', icon: Palette, category: 'Theme', params: 'hacker' },

        { id: 'layout_horizontal', label: 'Layout: Horizontal', icon: Layout, category: 'Layout', params: 'horizontal' },
        { id: 'layout_vertical', label: 'Layout: Vertical', icon: Layout, category: 'Layout', params: 'vertical' },
    ];

    const filteredRequests = savedRequests.filter(r =>
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.url.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    const filteredActions = actions.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase())
    );

    const results = [
        ...filteredRequests.map(r => ({ type: 'request' as const, item: r })),
        ...filteredActions.map(a => ({ type: 'action' as const, item: a }))
    ];

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % Math.max(results.length, 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(results.length, 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = results[selectedIndex];
                if (selected) {
                    if (selected.type === 'request') onSelectRequest(selected.item as SavedRequest);
                    else onSelectAction((selected.item as Action).id, (selected.item as Action).params);
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="relative border-b border-white/5 bg-surfaceHighlight/30">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-textSecondary" size={18} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search commands or saved requests..."
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        className="w-full pl-14 pr-6 py-5 bg-transparent text-foreground text-base outline-none placeholder-textSecondary/50 font-medium"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex gap-1">
                        <kbd className="px-2 py-1 bg-surfaceLight border border-white/5 rounded text-[10px] text-textSecondary font-bold">ESC</kbd>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {results.length === 0 ? (
                        <div className="p-12 text-center">
                            <Zap className="mx-auto text-textSecondary/20 mb-4" size={48} />
                            <p className="text-sm text-textSecondary italic">No results found for "{query}"</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {results.map((result, idx) => {
                                const isSelected = idx === selectedIndex;
                                const { type, item } = result;

                                return (
                                    <button
                                        key={type === 'request' ? (item as SavedRequest).id : (item as Action).id}
                                        onClick={() => {
                                            if (type === 'request') onSelectRequest(item as SavedRequest);
                                            else onSelectAction((item as Action).id, (item as Action).params);
                                            onClose();
                                        }}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.01]' : 'text-textSecondary hover:bg-surfaceLight/50'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-surfaceLight'}`}>
                                                {type === 'request' ? (
                                                    <span className={`text-[10px] font-bold w-9 text-center rounded px-1 py-0.5 ${(item as SavedRequest).method === 'GET' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                        {(item as SavedRequest).method}
                                                    </span>
                                                ) : (
                                                    <item.icon size={16} />
                                                )}
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-foreground'}`}>
                                                    {type === 'request' ? (item as SavedRequest).name : (item as Action).label}
                                                </span>
                                                {type === 'request' && (
                                                    <span className={`text-[10px] truncate max-w-[300px] ${isSelected ? 'text-white/70' : 'text-textSecondary'}`}>
                                                        {(item as SavedRequest).url}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isSelected && <ChevronRight size={16} className="text-white/50" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-3 bg-surfaceHighlight/20 border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <kbd className="px-1.5 py-0.5 bg-surfaceLight border border-white/5 rounded text-[10px] text-textSecondary">↑↓</kbd>
                            <span className="text-[10px] text-textSecondary uppercase font-medium">Navigate</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="px-1.5 py-0.5 bg-surfaceLight border border-white/5 rounded text-[10px] text-textSecondary">Enter</kbd>
                            <span className="text-[10px] text-textSecondary uppercase font-medium">Select</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-50">
                        <Command size={12} className="text-textSecondary" />
                        <span className="text-[10px] text-textSecondary uppercase font-bold tracking-widest">CommunicateX</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
