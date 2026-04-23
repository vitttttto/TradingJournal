import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Clock, CalendarIcon } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, addMonths, subMonths, isSameDay, isSameMonth, setHours, setMinutes, parseISO } from 'date-fns';
import { getContrastColor } from '../lib/colors';

const hexToRgba = (hex: string, alpha: number) => {
  const cleaned = hex.replace("#", "").trim();
  const normalized = cleaned.length === 3 ? cleaned.split("").map((x) => `${x}${x}`).join("") : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(79, 124, 255, ${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const CustomSelect = ({ 
  value, 
  onChange, 
  options, 
  className, 
  buttonClassName = "rounded-xl px-3 py-2",
  style, 
  panelTint = "#0f172a", 
  accentColor = "#4f7cff",
  placeholder = "Select...",
  placement = "bottom"
}: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o: any) => o.value == value);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ ...style, zIndex: isOpen ? 99999 : 1 }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-center cursor-pointer text-sm text-white transition-colors ${buttonClassName}`}
        style={{ background: hexToRgba(panelTint, 0.4), borderColor: "rgba(255,255,255,0.1)", borderStyle: 'solid', borderWidth: '1px' }}
      >
        <span className="truncate flex-1 text-center pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform text-slate-400 absolute right-3 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div 
          className={`absolute left-0 right-0 max-h-60 overflow-y-auto rounded-xl border border-white/10 p-1 shadow-xl backdrop-blur-xl ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          style={{ background: hexToRgba(panelTint, 0.95), zIndex: 999999, minWidth: '100%' }}
        >
          {options.map((option: any) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm text-center transition-colors ${option.value == value ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CustomCombobox = ({ 
  value, 
  onChange, 
  options, 
  className, 
  style, 
  panelTint = "#0f172a", 
  accentColor = "#4f7cff",
  placeholder = "",
  placement = "bottom"
}: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o: any) => 
    String(o.value).toLowerCase().includes(String(value).toLowerCase()) || 
    String(o.label).toLowerCase().includes(String(value).toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative ${className}`} style={style}>
      <div className="relative flex w-full items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none transition-all"
          style={{ background: hexToRgba(panelTint, 0.4), borderColor: "rgba(255,255,255,0.1)", borderStyle: 'solid', borderWidth: '1px' }}
        />
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 text-slate-400 hover:text-white"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div 
          className={`absolute left-0 right-0 z-[9999] max-h-48 overflow-y-auto rounded-xl border border-white/10 p-1 shadow-xl backdrop-blur-xl ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          style={{ background: hexToRgba(panelTint, 0.95) }}
        >
          {filteredOptions.map((option: any) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(String(option.value));
                setIsOpen(false);
              }}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export const CustomDateTimePicker = ({
  value,
  onChange,
  className,
  style,
  panelTint = "#0f172a",
  accentColor = "#4f7cff",
  placement = "bottom"
}: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse incoming value or fallback to now
  const initialDate = useMemo(() => {
    if (!value) return new Date();
    // try standard parsing
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return new Date();
  }, [value]);

  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [viewDate, setViewDate] = useState<Date>(initialDate);

  // Sync state if external value changes (e.g., reset form)
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setCurrentDate(d);
        setViewDate(d);
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDaySelect = (day: Date) => {
    const newDate = new Date(day);
    newDate.setHours(currentDate.getHours());
    newDate.setMinutes(currentDate.getMinutes());
    newDate.setSeconds(0);
    setCurrentDate(newDate);
    // onChange(format(newDate, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleTimeChange = (type: 'hours' | 'minutes', val: string) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 0;
    
    let newDate = new Date(currentDate);
    if (type === 'hours') {
      if (num < 0) num = 0;
      if (num > 23) num = 23;
      newDate.setHours(num);
    } else {
      if (num < 0) num = 0;
      if (num > 59) num = 59;
      newDate.setMinutes(num);
    }
    setCurrentDate(newDate);
    // onChange(format(newDate, "yyyy-MM-dd'T'HH:mm"));
  };

  const applyChanges = () => {
    onChange(format(currentDate, "yyyy-MM-dd'T'HH:mm"));
    setIsOpen(false);
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate)),
    end: endOfWeek(endOfMonth(viewDate))
  });

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ ...style, zIndex: isOpen ? 99999 : 1 }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between cursor-pointer rounded-xl px-3 py-2 text-sm text-white transition-all shadow-sm"
        style={{ background: hexToRgba(panelTint, 0.4), borderColor: "rgba(255,255,255,0.1)", borderStyle: 'solid', borderWidth: '1px' }}
      >
        <span className="flex flex-1 items-center justify-center gap-2 pr-4 text-center">
          <CalendarIcon className="h-4 w-4 text-slate-400 absolute left-3" />
          {format(currentDate, "MMM d, yyyy h:mm a")}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform text-slate-400 absolute right-3 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div 
          className={`absolute left-0 w-72 rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-3xl animate-in fade-in slide-in-from-top-2 ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          style={{ background: hexToRgba(panelTint, 0.98), zIndex: 999999 }}
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewDate(subMonths(viewDate, 1)); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-white">
              {format(viewDate, "MMMM yyyy")}
            </div>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewDate(addMonths(viewDate, 1)); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
            {weekDays.map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const isSelected = isSameDay(day, currentDate);
              const isCurrentMonth = isSameMonth(day, viewDate);
              
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all
                    ${isSelected ? 'font-bold shadow-md' : 'hover:bg-white/10'}
                    ${!isCurrentMonth && !isSelected ? 'text-slate-600' : isCurrentMonth && !isSelected ? 'text-slate-200' : ''}
                  `}
                  style={isSelected ? { background: accentColor, color: getContrastColor(accentColor) } : {}}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Time and Actions */}
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" />
              <div className="flex items-center bg-black/40 rounded-lg border border-white/5 px-1.5 py-1">
                <input 
                  type="number"
                  min="0" max="23"
                  value={String(currentDate.getHours()).padStart(2, '0')}
                  onChange={(e) => handleTimeChange('hours', e.target.value)}
                  className="w-7 bg-transparent text-center text-sm text-white outline-none hide-arrows"
                />
                <span className="text-slate-400 font-bold mb-0.5">:</span>
                <input 
                  type="number"
                  min="0" max="59"
                  value={String(currentDate.getMinutes()).padStart(2, '0')}
                  onChange={(e) => handleTimeChange('minutes', e.target.value)}
                  className="w-7 bg-transparent text-center text-sm text-white outline-none hide-arrows"
                />
              </div>
            </div>
            <button 
              type="button"
              onClick={applyChanges}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold shadow-md transition-all hover:brightness-110 active:scale-95"
              style={{ background: accentColor, color: getContrastColor(accentColor) }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
