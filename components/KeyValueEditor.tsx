import React from 'react';
import { KeyValueItem } from '../types';
import { Trash2, Plus, CheckSquare, Square } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';

interface KeyValueEditorProps {
  items: KeyValueItem[];
  onChange: (items: KeyValueItem[]) => void;
  title: string;
  variables?: KeyValueItem[];
}

const KeyValueEditor: React.FC<KeyValueEditorProps> = ({ items, onChange, title, variables = [] }) => {
  const handleChange = (id: string, field: keyof KeyValueItem, value: any) => {
    const newItems = items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    onChange(newItems);
  };

  const addItem = () => {
    const newItem: KeyValueItem = {
      id: crypto.randomUUID(),
      key: '',
      value: '',
      enabled: true
    };
    onChange([...items, newItem]);
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-3 px-1">
        <h3 className="text-xs font-bold text-textSecondary uppercase tracking-wider">{title}</h3>
        <button 
          onClick={addItem}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primaryHover transition-colors px-2 py-1 rounded hover:bg-primary/10"
        >
          <Plus size={12} /> Add New
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden flex-1 overflow-y-auto bg-surfaceLight/30">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-textSecondary opacity-60">
            <span className="text-sm italic">No {title.toLowerCase()} configured.</span>
            <button onClick={addItem} className="mt-2 text-xs text-primary hover:underline">Add one now</button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex border-b border-border last:border-b-0 group transition-colors hover:bg-surfaceLight/50">
              <button 
                onClick={() => handleChange(item.id, 'enabled', !item.enabled)}
                className="w-10 flex items-center justify-center text-textSecondary hover:text-primary transition-colors border-r border-border"
              >
                {item.enabled ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
              </button>
              
              <div className="flex-1 border-r border-border min-w-0">
                  <AutocompleteInput 
                    value={item.key}
                    onChange={(val) => handleChange(item.id, 'key', val)}
                    variables={variables}
                    placeholder="Key"
                    className={`w-full bg-transparent p-2.5 text-sm outline-none text-zinc-200 placeholder-zinc-600 font-mono ${!item.enabled && 'opacity-50 line-through text-textSecondary'}`}
                  />
              </div>
              
              <div className="flex-1 min-w-0">
                  <AutocompleteInput 
                    value={item.value}
                    onChange={(val) => handleChange(item.id, 'value', val)}
                    variables={variables}
                    placeholder="Value"
                    className={`w-full bg-transparent p-2.5 text-sm outline-none text-zinc-200 placeholder-zinc-600 font-mono ${!item.enabled && 'opacity-50 text-textSecondary'}`}
                  />
              </div>

              <button 
                onClick={() => removeItem(item.id)}
                className="w-10 flex items-center justify-center text-textSecondary hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KeyValueEditor;