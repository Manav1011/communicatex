import React from 'react';
import { MultipartField, MultipartValueType, KeyValueItem } from '../types';
import { Trash2, Plus, CheckSquare, Square, Paperclip, FileText } from 'lucide-react';

interface MultipartEditorProps {
  items: MultipartField[];
  onChange: (items: MultipartField[]) => void;
  title: string;
  variables?: KeyValueItem[];
}

const MultipartEditor: React.FC<MultipartEditorProps> = ({ items, onChange, title }) => {
  const handleChange = (id: string, patch: Partial<MultipartField>) => {
    const next = items.map(item => item.id === id ? { ...item, ...patch } : item);
    onChange(next);
  };

  const handleValueTypeChange = (id: string, valueType: MultipartValueType) => {
    // When switching to text, clear file reference
    const patch: Partial<MultipartField> =
      valueType === 'text'
        ? { valueType, file: null }
        : { valueType };
    handleChange(id, patch);
  };

  const addItem = () => {
    const newItem: MultipartField = {
      id: crypto.randomUUID(),
      key: '',
      value: '',
      enabled: true,
      valueType: 'text',
      file: null,
    };
    onChange([...items, newItem]);
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const handleFileChange = (id: string, fileList: FileList | null) => {
    const file = fileList && fileList[0] ? fileList[0] : null;
    handleChange(id, {
      valueType: 'file',
      file,
      value: file ? file.name : '',
    });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-3 px-1">
        <h3 className="text-xs font-bold text-textSecondary uppercase tracking-wider">
          {title}
        </h3>
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
            <button onClick={addItem} className="mt-2 text-xs text-primary hover:underline">
              Add one now
            </button>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="flex border-b border-border last:border-b-0 group transition-colors hover:bg-surfaceLight/50"
            >
              {/* Enabled toggle */}
              <button
                onClick={() => handleChange(item.id, { enabled: !item.enabled })}
                className="w-10 flex items-center justify-center text-textSecondary hover:text-primary transition-colors border-right border-border"
              >
                {item.enabled ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
              </button>

              {/* Key */}
              <div className="flex-1 border-r border-border min-w-0">
                <input
                  value={item.key}
                  onChange={e => handleChange(item.id, { key: e.target.value })}
                  placeholder="Key"
                  className={`w-full bg-transparent px-2.5 py-2.5 text-sm outline-none text-zinc-200 placeholder-zinc-600 font-mono ${
                    !item.enabled && 'opacity-50 line-through text-textSecondary'
                  }`}
                />
              </div>

              {/* Type selector */}
              <div className="w-28 border-r border-border flex items-center justify-center">
                <select
                  value={item.valueType}
                  onChange={e => handleValueTypeChange(item.id, e.target.value as MultipartValueType)}
                  className="bg-transparent text-xs text-textSecondary px-2 py-1 rounded outline-none cursor-pointer"
                >
                  <option value="text">Text</option>
                  <option value="file">File</option>
                </select>
              </div>

              {/* Value / File picker */}
              <div className="flex-1 min-w-0 flex items-center px-2.5">
                {item.valueType === 'file' ? (
                  <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surfaceHighlight text-xs text-textSecondary border border-border">
                      <Paperclip size={12} />
                      Choose file
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={e => handleFileChange(item.id, e.target.files)}
                    />
                    {item.file ? (
                      <span className="truncate text-xs text-textSecondary flex items-center gap-1">
                        <FileText size={12} /> {item.file.name}
                      </span>
                    ) : (
                      <span className="text-xs text-textSecondary italic">No file selected</span>
                    )}
                  </label>
                ) : (
                  <input
                    value={item.value}
                    onChange={e => handleChange(item.id, { value: e.target.value })}
                    placeholder="Value"
                    className={`w-full bg-transparent text-sm outline-none text-zinc-200 placeholder-zinc-600 font-mono ${
                      !item.enabled && 'opacity-50 text-textSecondary'
                    }`}
                  />
                )}
              </div>

              {/* Remove */}
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

export default MultipartEditor;


