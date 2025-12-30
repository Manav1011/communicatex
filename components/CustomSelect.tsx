import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  className?: string; // For text colors etc
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  dropdownClassName?: string;
  placeholder?: string;
  renderValue?: (value: string) => React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = "",
  dropdownClassName = "w-full",
  placeholder,
  renderValue
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative h-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between cursor-pointer focus:outline-none ${className}`}
      >
        <span className="truncate">
          {renderValue ? renderValue(value) : (selectedOption?.label || placeholder || value)}
        </span>
        <ChevronDown
          size={14}
          className={`text-textSecondary transition-transform duration-200 ml-2 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-1 z-50 bg-surfaceHighlight rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 ${dropdownClassName}`}>
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between mb-0.5 transition-colors ${option.value === value
                  ? 'bg-surfaceLight text-foreground font-bold'
                  : 'text-textSecondary hover:text-foreground hover:bg-surfaceLight/50'
                  }`}
              >
                <span className={`truncate ${option.className || ''}`}>{option.label}</span>
                {option.value === value && <Check size={14} className="text-primary shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;