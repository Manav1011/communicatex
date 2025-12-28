import React, { useState, useRef } from 'react';
import { KeyValueItem } from '../types';
import { Eye, EyeOff } from 'lucide-react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  variables: KeyValueItem[];
  placeholder?: string;
  className?: string;
  type?: 'text' | 'textarea' | 'password';
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  variables,
  placeholder,
  className,
  type = 'text',
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filter, setFilter] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isPasswordType = type === 'password';
  // Determine the actual input type to render. If it's a password field, rely on visibility toggle.
  // Autocomplete only works when type is 'text' or 'textarea' because selectionStart is not available on 'password'.
  const renderType = type === 'textarea' ? 'textarea' : (isPasswordType && !isPasswordVisible ? 'password' : 'text');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    // If input is currently masked as password, we cannot get cursor position to do autocomplete
    if (renderType === 'password') {
        setShowSuggestions(false);
        return;
    }

    const idx = e.target.selectionStart || 0;
    setCursorIndex(idx);

    // Look backwards from cursor for '<<' pattern
    const textBeforeCursor = val.slice(0, idx);
    const match = textBeforeCursor.match(/<<([a-zA-Z0-9_]*)$/);

    if (match) {
      setShowSuggestions(true);
      setFilter(match[1]);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (variableKey: string) => {
    const textBeforeCursor = value.slice(0, cursorIndex);
    const textAfterCursor = value.slice(cursorIndex);
    
    // Find the last occurrence of '<<' before cursor
    const lastOpenIndex = textBeforeCursor.lastIndexOf('<<');
    if (lastOpenIndex === -1) return;

    const newValue = 
      value.slice(0, lastOpenIndex) + 
      `<<${variableKey}>>` + 
      textAfterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    // Restore focus
    setTimeout(() => {
        inputRef.current?.focus();
    }, 0);
  };

  const filteredVars = variables.filter(v => 
    v.enabled && v.key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="relative w-full h-full group">
      {renderType === 'textarea' ? (
        <textarea
          ref={inputRef as any}
          value={value}
          onChange={handleInputChange}
          className={className}
          placeholder={placeholder}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
      ) : (
        <input
          ref={inputRef as any}
          type={renderType}
          value={value}
          onChange={handleInputChange}
          className={`${className} ${isPasswordType ? 'pr-10' : ''}`}
          placeholder={placeholder}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
      )}

      {isPasswordType && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsPasswordVisible(!isPasswordVisible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-white transition-colors z-10"
        >
          {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}

      {showSuggestions && filteredVars.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-64 max-h-48 overflow-y-auto bg-surfaceHighlight border border-border rounded-lg shadow-2xl z-50 animate-in fade-in zoom-in-95">
          <div className="text-[10px] uppercase font-bold text-textSecondary px-2 py-1 bg-surface sticky top-0 border-b border-border">
              Environment Variables
          </div>
          {filteredVars.map(v => (
            <button
              key={v.id}
              className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-primary/20 hover:text-white transition-colors flex justify-between group border-b border-border/50 last:border-0"
              onClick={() => handleSelect(v.key)}
              onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
            >
              <span className="font-mono font-bold text-primary">{v.key}</span>
              <span className="text-xs text-textSecondary truncate max-w-[100px] group-hover:text-zinc-300 font-mono opacity-70">
                  {v.value}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;