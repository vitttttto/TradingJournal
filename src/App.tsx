import React, { type ChangeEvent, type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Papa, { type ParseResult } from "papaparse";
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import {
  Calendar,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  ImagePlus,
  List,
  LogOut,
  Plus,
  RefreshCcw,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
  TrendingUp,
  Shield,
  Clock,
  Notebook,
  LayoutDashboard,
  FlaskConical,
  Info,
  Loader2,
  Activity,
  Edit
} from "lucide-react";
import { INITIAL_TRADES, type TradeRecord } from "./mockData";
import { Reorder } from "motion/react";
import { TradeJournal } from "./components/TradeJournal";
import { Reports } from "./components/Reports";
import { TheLab } from "./components/TheLab";
import { AccountsLab } from "./components/AccountsLab";
import { Friends } from "./components/Friends";
import { Communities } from "./components/Communities";
import { Terminal } from "./components/Terminal";
import { AdminPanel } from "./components/AdminPanel";
import { supabase } from "./lib/supabase";
import { getContrastColor } from "./lib/colors";
import { CustomSelect, CustomDateTimePicker } from "./components/CustomInputs";

type Tab = "dashboard" | "calendar" | "tradeJournal" | "reports" | "lab" | "trades" | "terminal" | "settings" | "friends" | "admin" | "accounts" | "communities";
type SortBy = "soldTimestamp" | "pnl" | "symbol";
type SortOrder = "asc" | "desc";
type Direction = "long" | "short";
type TagKind = "confluence" | "mistake" | "entry";
type TradeStatus = "win" | "loss" | "breakeven";

type ThemePreset = {
  id: string;
  name: string;
  accent: string;
  start: string;
  mid: string;
  end: string;
  panelTint: string;
};

type SavedPreset = ThemePreset & { savedAt: number };

type CalendarCell = {
  date: Date;
  key: string;
  pnl: number;
  trades: TradeRecord[];
  isOutOfMonth?: boolean;
};

type ManualTradeForm = {
  symbol: string;
  _priceFormat: string;
  _priceFormatType: string;
  _tickSize: string;
  qty: string;
  buyPrice: string;
  sellPrice: string;
  pnl: string;
  boughtTimestamp: string;
  soldTimestamp: string;
  duration: string;
  direction: Direction;
  maxPointsProfit: string;
  commission: string;
  confluenceTags: string[];
  mistakeTags: string[];
  entryTags: string[];
  accountId: string;
  images?: string[];
  notes?: string;
};

type TradeEditForm = {
  symbol: string;
  _priceFormat: string;
  _priceFormatType: string;
  _tickSize: string;
  qty: string;
  buyPrice: string;
  sellPrice: string;
  pnl: string;
  boughtTimestamp: string;
  soldTimestamp: string;
  duration: string;
  direction: Direction;
  maxPointsProfit: string;
  commission: string;
  accountId: string;
  confluenceTags: string[];
  mistakeTags: string[];
  entryTags: string[];
  images: string[];
  notes: string;
  _sourceTradeKey?: string;
};

const REQUIRED_HEADERS = [
  "symbol",
  "_priceFormat",
  "_priceFormatType",
  "_tickSize",
  "buyFillId",
  "sellFillId",
  "qty",
  "buyPrice",
  "sellPrice",
  "pnl",
  "boughtTimestamp",
  "soldTimestamp",
  "duration",
];

const THEME_PRESETS: ThemePreset[] = [
  { id: "deep-navy", name: "Deep Navy", accent: "#4f7cff", start: "#020617", mid: "#0b1c48", end: "#020617", panelTint: "#0f172a" },
  { id: "teal", name: "Ocean Teal", accent: "#14b8a6", start: "#02111b", mid: "#083344", end: "#03222e", panelTint: "#0d2b35" },
  { id: "violet", name: "Royal Violet", accent: "#a855f7", start: "#0b1020", mid: "#581c87", end: "#1e1b4b", panelTint: "#241744" },
  { id: "ember", name: "Ember Night", accent: "#f97316", start: "#0f172a", mid: "#431407", end: "#1c1917", panelTint: "#2b180f" },
  { id: "monochrome", name: "Black & White", accent: "#ffffff", start: "#000000", mid: "#111111", end: "#000000", panelTint: "#0a0a0a" },
  { id: "white-on-black", name: "White on Black", accent: "#000000", start: "#ffffff", mid: "#f1f5f9", end: "#f8fafc", panelTint: "#e2e8f0" },
  { id: "crimson-gold", name: "Crimson Gold", accent: "#fbbf24", start: "#450a0a", mid: "#7f1d1d", end: "#2e0804", panelTint: "#450a0a" },
  { id: "neon-cyber", name: "Neon Cyber", accent: "#e81cff", start: "#170229", mid: "#090114", end: "#170229", panelTint: "#2d0b4e" },
  { id: "wine-glow", name: "Wine Glow", accent: "#a855f7", start: "#d19dd2", mid: "#581c87", end: "#780712", panelTint: "#583c49" },
];

const DEFAULT_CONFLUENCE_TAGS = ["Trend Continuation", "Opening Range Break", "VWAP Reclaim", "Liquidity Sweep"];
const DEFAULT_MISTAKE_TAGS = ["Late Entry", "Early Exit", "Ignored Stop", "Revenge Trade"];
const DEFAULT_ENTRY_TAGS = ["Pullback", "Breakout", "Reversal", "Momentum"];

const DEFAULT_COMMISSIONS: Record<string, number> = {
  // Equities
  'YM': 5.76, 'ES': 5.76, 'NQ': 5.76, 'RTY': 5.76, 'EMD': 5.66,
  // EUREX (EUR)
  'FDAX': 5.94, 'FDXM': 3.72, 'FESX': 4.12, 'FDXS': 1.42, 'FSXE': 1.34,
  'FGBS': 7.70, 'FGBM': 5.70, 'FGBL': 3.70,
  // Currencies
  '6A': 6.20, '6B': 6.20, '6J': 6.20, '6C': 6.20, '6S': 10.20, '6E': 6.20,
  // Agriculture
  'HE': 9.20, 'LE': 11.20, 'GF': 7.20, 'ZS': 15.20, 'ZL': 7.20, 'ZC': 7.20, 'ZW': 17.20, 'ZM': 9.20,
  // Energy
  'RB': 5.40, 'CL': 6.00, 'NG': 6.20, 'QM': 5.40, 'QG': 4.00, 'HO': 6.00,
  // Metals
  'GC': 6.20, 'HG': 6.20, 'SI': 6.20, 'QI': 5.00, 'QO': 5.00,
  // Micros
  'MYM': 1.82, 'MES': 1.82, 'MNQ': 1.82, 'M2K': 1.82, 'MGC': 2.12, 'MCL': 2.12, 'M6A': 1.60, 'M6E': 1.60
};

const STORAGE = {
  trades: "journal-trades-v4",
  journalName: "journal-name",
  themeId: "journal-theme-id",
  accent: "journal-accent",
  gradientStart: "journal-gradient-start",
  gradientMid: "journal-gradient-mid",
  gradientEnd: "journal-gradient-end",
  panelTint: "journal-panel-tint",
  textColor: "journal-text-color",
  glassOpacity: "journal-glass-opacity",
  singleColor: "journal-single-color",
  breakevenLow: "journal-breakeven-low",
  breakevenHigh: "journal-breakeven-high",
  confluence: "journal-confluence",
  mistake: "journal-mistake",
  entry: "journal-entry",
  savedPresets: "journal-saved-presets",
  labState: "journal-lab-state",
  friendsPrivate: "journal-friends-private",
  friendsShareDetails: "journal-friends-share-details",
  manualTradeSymbol: "journal-manual-trade-symbol",
};

const TICK_VALUE_BY_ROOT: Record<string, number> = {
  NQ: 5,
  MNQ: 0.5,
  ES: 12.5,
  MES: 1.25,
  GC: 10,
  MGC: 1,
  CL: 10,
  MCL: 1,
  YM: 5,
  MYM: 0.5,
  RTY: 5,
  M2K: 0.5,
};

const TICK_SIZE_BY_ROOT: Record<string, number> = {
  NQ: 0.25,
  MNQ: 0.25,
  ES: 0.25,
  MES: 0.25,
  GC: 0.1,
  MGC: 0.1,
  CL: 0.01,
  MCL: 0.01,
  YM: 1,
  MYM: 1,
  RTY: 0.1,
  M2K: 0.1,
};

const formatInputTime = (timestamp: number, tz: string) => {
  if (tz === "Local") return new Date(timestamp - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  try {
    return formatInTimeZone(timestamp, tz, "yyyy-MM-dd'T'HH:mm");
  } catch(e) {
    return new Date(timestamp - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
};

const parseInputTime = (val: string, tz: string) => {
  if (tz === "Local") return new Date(val).getTime();
  try {
    return fromZonedTime(val, tz).getTime();
  } catch(e) {
    return new Date(val).getTime();
  }
};

const navItems: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "tradeJournal", label: "Trade Journal", icon: Notebook },
  { id: "trades", label: "Trades Log", icon: List },
  { id: "lab", label: "Lab", icon: FlaskConical },
  { id: "terminal", label: "Terminal", icon: LayoutDashboard },
  { id: "friends", label: "Friends", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

const getNavItems = (isAdmin: boolean) => {
  const items = [...navItems];
  if (isAdmin) {
    items.splice(items.length - 1, 0, { id: "admin", label: "Admin", icon: Shield });
  }
  return items;
};

const readStored = (key: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
};

const readStoredJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const readStoredNumber = (key: string, fallback: number) => {
  const value = Number.parseFloat(readStored(key, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
};

const sanitizeTagList = (items: unknown[]) => {
  const seen = new Set<string>();
  return items
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getPresetById = (id: string) => THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];

const normalizeSymbolRoot = (symbol: string) => {
  const cleaned = symbol.toUpperCase().trim();
  const letters = (cleaned.match(/^[A-Z]+/)?.[0] ?? cleaned).replace(/USD|USDT|PERP|FUTURES/g, "");
  if (letters.startsWith("MNQ")) return "MNQ";
  if (letters.startsWith("NQ")) return "NQ";
  if (letters.startsWith("MGC")) return "MGC";
  if (letters.startsWith("GC")) return "GC";
  if (letters.startsWith("MES")) return "MES";
  if (letters.startsWith("ES")) return "ES";
  if (letters.startsWith("MCL")) return "MCL";
  if (letters.startsWith("CL")) return "CL";
  if (letters.startsWith("MYM")) return "MYM";
  if (letters.startsWith("YM")) return "YM";
  if (letters.startsWith("M2K")) return "M2K";
  if (letters.startsWith("RTY")) return "RTY";
  return letters || cleaned;
};

const calculateTradePnl = (trade: {
  symbol: string;
  direction: Direction;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  tickSize: number;
}) => {
  const qty = Number.isFinite(trade.qty) ? trade.qty : 0;
  const root = normalizeSymbolRoot(trade.symbol);
  const tickSize = Number.isFinite(trade.tickSize) && trade.tickSize > 0 ? trade.tickSize : (TICK_SIZE_BY_ROOT[root] ?? 1);
  const tickValue = TICK_VALUE_BY_ROOT[root] ?? 1;
  // CSV schema stores explicit buy and sell prices, so tick P&L is based on sell-buy for both long and short executions.
  const priceDiff = trade.sellPrice - trade.buyPrice;
  const ticks = priceDiff / tickSize;
  return ticks * tickValue * qty;
};

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

const normalizeHex = (value: string, fallback: string) => {
  const cleaned = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned) || /^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return fallback;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatSignedCurrency = (value: number) => {
  if (value > 0) return `+${formatCurrency(value)}`;
  if (value < 0) return `-${formatCurrency(Math.abs(value))}`;
  return formatCurrency(0);
};

const formatDuration = (seconds: number) => {
  if (!seconds) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(" ");
};

const parseNumeric = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim().replace(/^"(.*)"$/, "$1");
  if (!raw) return 0;
  const isNegative = raw.includes("(") && raw.includes(")");
  const cleaned = raw.replace(/[$,%(),\s]/g, "").replace(/,/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
};

const parseTimestamp = (value: unknown) => {
  if (value === null || value === undefined) return Date.now();
  const raw = String(value).trim().replace(/^"(.*)"$/, "$1");
  if (!raw) return Date.now();
  if (/^\d+$/.test(raw)) {
    const timestamp = Number.parseInt(raw, 10);
    return raw.length === 10 ? timestamp * 1000 : timestamp;
  }
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, month, day, year, hours = "0", minutes = "0", seconds = "0"] = match;
    return new Date(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
      Number.parseInt(hours, 10),
      Number.parseInt(minutes, 10),
      Number.parseInt(seconds, 10)
    ).getTime();
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const parseDuration = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const raw = String(value).toLowerCase().trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  let total = 0;
  const hourMatch = raw.match(/(\d+)\s*h(?:r|our)?/);
  const minuteMatch = raw.match(/(\d+)\s*m(?:in)?/);
  const secondMatch = raw.match(/(\d+)\s*s(?:ec)?/);
  if (hourMatch) total += Number.parseInt(hourMatch[1], 10) * 3600;
  if (minuteMatch) total += Number.parseInt(minuteMatch[1], 10) * 60;
  if (secondMatch) total += Number.parseInt(secondMatch[1], 10);
  return total;
};

export const toDayKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const sortTradesDesc = (items: TradeRecord[]) =>
  [...items].sort((a, b) => b.soldTimestamp - a.soldTimestamp || b.boughtTimestamp - a.boughtTimestamp);

const toLocalDateTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const tradeKey = (trade: TradeRecord) =>
  `${trade.symbol}-${trade.buyFillId || 'id-0-b'}-${trade.sellFillId || 'id-0-s'}-${trade.boughtTimestamp}-${trade.soldTimestamp}`;

const formatCsvDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const getNetPnl = (trade: TradeRecord): number => {
  return trade.pnl - (trade.commission || 0);
};

const DualRangeSlider = ({
  min, max, low, high, setLow, setHigh, accentColor, panelTint
}: {
  min: number, max: number, low: number, high: number,
  setLow: (v: number) => void,
  setHigh: (v: number) => void,
  accentColor: string,
  panelTint: string
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingThumb = useRef<"low" | "high" | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const handleMove = (clientX: number) => {
      let pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const val = Math.round(min + pct * (max - min));
      
      if (draggingThumb.current === "low") {
        setLow(Math.min(val, high - 1));
      } else {
        setHigh(Math.max(val, low + 1));
      }
    };

    let pct = (e.clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    const val = Math.round(min + pct * (max - min));
    const center = (low + high) / 2;
    
    // "if you're clicking at the right side of the center of the current range, it will select the higher range"
    if (val > center) draggingThumb.current = "high";
    else draggingThumb.current = "low";

    handleMove(e.clientX);

    const onPointerMove = (ev: PointerEvent) => handleMove(ev.clientX);
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      draggingThumb.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const getPct = (val: number) => Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

  return (
    <div className="relative h-6 w-full flex items-center cursor-pointer select-none" onPointerDown={handlePointerDown} ref={trackRef}>
      <div className="absolute inset-0 top-1/2 -mt-1 h-2 rounded-full w-full" style={{ background: hexToRgba(panelTint, 0.5) }} />
      <div 
        className="absolute inset-0 top-1/2 -mt-1 h-2 rounded-full" 
        style={{
          background: accentColor,
          left: `${getPct(low)}%`,
          right: `${100 - getPct(high)}%`
        }}
      />
      <div 
        className="absolute top-1/2 -mt-2 h-4 w-4 rounded-full shadow-lg border-[3px] bg-white transition-transform hover:scale-110" 
        style={{ left: `calc(${getPct(low)}% - 8px)`, borderColor: accentColor }}
      />
      <div 
        className="absolute top-1/2 -mt-2 h-4 w-4 rounded-full shadow-lg border-[3px] bg-white transition-transform hover:scale-110" 
        style={{ left: `calc(${getPct(high)}% - 8px)`, borderColor: accentColor }}
      />
    </div>
  );
};

export const getTradeStatus = (pnl: number, low: number, high: number): TradeStatus => {
  const floor = Math.min(low, high);
  const ceiling = Math.max(low, high);
  if (pnl < floor) return "loss";
  if (pnl > ceiling) return "win";
  return "breakeven";
};

const getStatusTone = (status: TradeStatus) => {
  if (status === "win") return { text: "text-emerald-300", pill: "border-emerald-500/30 bg-emerald-500/12 text-emerald-200" };
  if (status === "loss") return { text: "text-rose-300", pill: "border-rose-500/30 bg-rose-500/12 text-rose-200" };
  return { text: "text-amber-300", pill: "border-amber-500/30 bg-amber-500/12 text-amber-200" };
};

const createManualTradeForm = (symbol: string = "", tz: string = "Local"): ManualTradeForm => {
  const now = Date.now();
  return {
    symbol,
    _priceFormat: "-2",
    _priceFormatType: "0",
    _tickSize: "0.25",
    qty: "1",
    buyPrice: "",
    sellPrice: "",
    pnl: "",
    boughtTimestamp: formatInputTime(now, tz),
    soldTimestamp: formatInputTime(now + 5 * 60 * 1000, tz),
    duration: "",
    direction: "long",
    maxPointsProfit: "",
    commission: "",
    accountId: "",
    confluenceTags: [],
    mistakeTags: [],
    entryTags: [],
    images: [],
    notes: "",
  };
};

const createTradeEditForm = (trade: TradeRecord, tz: string = "Local"): TradeEditForm => ({
  symbol: trade.symbol,
  _priceFormat: trade._priceFormat,
  _priceFormatType: trade._priceFormatType,
  _tickSize: String(trade._tickSize),
  qty: String(trade.qty),
  buyPrice: String(trade.buyPrice),
  sellPrice: String(trade.sellPrice),
  pnl: String(trade.pnl),
  boughtTimestamp: formatInputTime(trade.boughtTimestamp, tz),
  soldTimestamp: formatInputTime(trade.soldTimestamp, tz),
  duration: String(trade.duration),
  direction: trade.direction === "short" ? "short" : "long",
  maxPointsProfit: trade.maxPointsProfit != null ? String(trade.maxPointsProfit) : "",
  commission: trade.commission != null ? String(trade.commission) : "",
  accountId: trade.accountId || "",
  confluenceTags: trade.confluenceTags && Array.isArray(trade.confluenceTags) ? [...trade.confluenceTags] : [],
  mistakeTags: trade.mistakeTags && Array.isArray(trade.mistakeTags) ? [...trade.mistakeTags] : [],
  entryTags: trade.entryTags && Array.isArray(trade.entryTags) ? [...trade.entryTags] : [],
  images: trade.images && Array.isArray(trade.images) ? [...trade.images] : [],
  notes: trade.notes || "",
  _sourceTradeKey: tradeKey(trade),
});

export const getTradingSession = (timestamp: number | undefined | null): string | null => {
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return null;
  const date = new Date(timestamp);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour')?.value;
  const minutePart = parts.find(p => p.type === 'minute')?.value;
  
  if (!hourPart || !minutePart) return null;
  
  let hour = parseInt(hourPart, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(minutePart, 10);
  
  const totalMinutes = hour * 60 + minute;
  
  if (totalMinutes === 0 || totalMinutes >= 1200) return "Asia"; // 20:00 - 00:00
  if (totalMinutes >= 1 && totalMinutes < 120) return "Pre London"; // 00:01 - 01:59
  if (totalMinutes >= 120 && totalMinutes <= 300) return "London"; // 02:00 - 05:00
  if (totalMinutes >= 301 && totalMinutes <= 569) return "Premarket"; // 05:01 - 09:29
  if (totalMinutes >= 570 && totalMinutes <= 660) return "NY AM"; // 09:30 - 11:00
  if (totalMinutes >= 661 && totalMinutes <= 809) return "Lunch"; // 11:01 - 13:29
  if (totalMinutes >= 810 && totalMinutes <= 960) return "NY PM"; // 13:30 - 16:00
  
  return "After Hours"; // 16:01 - 19:59
};

export const getSessionTagStyle = (tag: string) => {
  const lower = tag.toLowerCase();
  if (lower.includes('asia')) return 'text-red-300 bg-red-500/20 border-red-500/30';
  if (lower.includes('london')) return 'text-blue-300 bg-blue-500/20 border-blue-500/30';
  if (lower.includes('premarket')) return 'text-purple-300 bg-purple-500/20 border-purple-500/30';
  if (lower.includes('ny am') || lower.includes('nyam')) return 'text-green-300 bg-green-500/20 border-green-500/30';
  if (lower.includes('lunch')) return 'text-teal-300 bg-teal-500/20 border-teal-500/30';
  if (lower.includes('ny pm') || lower.includes('nypm')) return 'text-green-200 bg-green-400/20 border-green-400/30';
  return 'text-slate-200 border-white/10 bg-white/5';
};

export const normalizeSymbol = (sym: string) => {
  if (!sym) return sym;
  const s = (sym.trim().toUpperCase().split(':').pop() || sym.trim().toUpperCase());
  // CME futures contracts: Base symbol + Month code (FGHJKMNQUVXZ) + Year code (1-2 digits)
  const match = s.match(/^(NQ|MNQ|ES|MES|GC|MGC|CL|MCL|YM|MYM|RTY|M2K)[FGHJKMNQUVXZ]\d{1,2}$/);
  return match ? match[1] : s;
};

const normalizeTrade = (trade: Partial<TradeRecord>): TradeRecord => {
  const buyPrice = Number(trade.buyPrice ?? 0);
  const sellPrice = Number(trade.sellPrice ?? 0);
  const boughtTimestamp = Number(trade.boughtTimestamp ?? Date.now());
  const soldTimestamp = Number(trade.soldTimestamp ?? Date.now());
  const direction =
    trade.direction === "long" || trade.direction === "short"
      ? trade.direction
      : soldTimestamp < boughtTimestamp
      ? "short"
      : "long";
      
  const symbol = normalizeSymbol(String(trade.symbol ?? "UNKNOWN").trim());
  const root = normalizeSymbolRoot(symbol);
  let defaultCommission = undefined;
  if (DEFAULT_COMMISSIONS[root]) {
     defaultCommission = DEFAULT_COMMISSIONS[root] * Number(trade.qty ?? 0);
  }
      
  return {
    id: trade.id,
    symbol,
    _priceFormat: String(trade._priceFormat ?? "-2").trim(),
    _priceFormatType: String(trade._priceFormatType ?? "0").trim(),
    _tickSize: Number(trade._tickSize ?? 0),
    buyFillId: String(trade.buyFillId ?? "").trim(),
    sellFillId: String(trade.sellFillId ?? "").trim(),
    qty: Number(trade.qty ?? 0),
    buyPrice,
    sellPrice,
    pnl: Number(trade.pnl ?? 0),
    boughtTimestamp,
    soldTimestamp,
    duration: Number(trade.duration ?? 0),
    direction,
    maxPointsProfit: trade.maxPointsProfit != null ? Number(trade.maxPointsProfit) : null as any,
    commission: trade.commission != null ? Number(trade.commission) : defaultCommission as any,
    accountId: trade.accountId || null as any,
    confluenceTags: sanitizeTagList(Array.isArray(trade.confluenceTags) ? trade.confluenceTags : []),
    mistakeTags: sanitizeTagList(Array.isArray(trade.mistakeTags) ? trade.mistakeTags : []),
    entryTags: sanitizeTagList(Array.isArray(trade.entryTags) ? trade.entryTags : []),
    images: Array.isArray(trade.images) ? trade.images.filter(Boolean).slice(0, 8) : [],
    notes: typeof trade.notes === "string" ? trade.notes : undefined,
    source: trade.source,
  };
};

const aggregateTrades = (trades: TradeRecord[]) => {
  const grouped = new Map<string, TradeRecord[]>();
  
  trades.forEach(trade => {
    const minuteTimestamp = Math.floor(trade.boughtTimestamp / 60000) * 60000;
    const key = `${trade.symbol}-${minuteTimestamp}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(trade);
  });

  const mergedTrades: TradeRecord[] = [];
  const tradesToDelete: string[] = [];
  const tradesToUpdate: TradeRecord[] = [];

  grouped.forEach((group) => {
    if (group.length === 1) {
      mergedTrades.push(group[0]);
    } else {
      let maxDuration = -1;
      let earliestBought = Infinity;
      let latestSold = -Infinity;
      
      let totalQty = 0;
      let sumPnl = 0;
      let sumCommission = 0;
      let sumMaxPoints = 0;
      
      let sumBuyPriceQty = 0;
      let sumSellPriceQty = 0;

      let allConfluence: string[] = [];
      let allMistake: string[] = [];
      let allEntry: string[] = [];
      let allImages: string[] = [];
      let allNotes: string[] = [];
      
      // Keep track of the first trade that has an id, so we can update it
      const firstWithId = group.find(t => t.id) || group[0];
      
      group.forEach(t => {
        if (t.id && t.id !== firstWithId.id) {
          tradesToDelete.push(t.id);
        }
        
        if (t.duration > maxDuration) { maxDuration = t.duration; }
        if (t.boughtTimestamp < earliestBought) { earliestBought = t.boughtTimestamp; }
        if (t.soldTimestamp > latestSold) { latestSold = t.soldTimestamp; }
        
        totalQty += t.qty;
        sumPnl += (t.pnl || 0);
        sumCommission += (t.commission || 0);
        if (t.maxPointsProfit !== undefined) {
          sumMaxPoints = Math.max(sumMaxPoints, t.maxPointsProfit);
        }
        
        sumBuyPriceQty += (t.buyPrice * t.qty);
        sumSellPriceQty += (t.sellPrice * t.qty);
        
        if (t.confluenceTags) allConfluence.push(...t.confluenceTags);
        if (t.mistakeTags) allMistake.push(...t.mistakeTags);
        if (t.entryTags) allEntry.push(...t.entryTags);
        if (t.images) allImages.push(...t.images);
        if (t.notes) allNotes.push(t.notes);
      });

      const resultDuration = maxDuration >= 0 ? maxDuration : latestSold - earliestBought;
      
      const merged: TradeRecord = {
        ...firstWithId, 
        qty: totalQty,
        buyPrice: totalQty ? sumBuyPriceQty / totalQty : firstWithId.buyPrice,
        sellPrice: totalQty ? sumSellPriceQty / totalQty : firstWithId.sellPrice,
        pnl: sumPnl,
        commission: sumCommission,
        maxPointsProfit: sumMaxPoints || undefined,
        duration: resultDuration,
        boughtTimestamp: earliestBought,
        soldTimestamp: earliestBought + resultDuration, 
        confluenceTags: Array.from(new Set(allConfluence)),
        mistakeTags: Array.from(new Set(allMistake)),
        entryTags: Array.from(new Set(allEntry)),
        images: Array.from(new Set(allImages)),
        notes: Array.from(new Set(allNotes.filter(Boolean))).join("\n\n"),
        buyFillId: Array.from(new Set(group.map(t => t.buyFillId).filter(Boolean))).join(", "),
        sellFillId: Array.from(new Set(group.map(t => t.sellFillId).filter(Boolean))).join(", "),
      };

      if (firstWithId.id) {
        tradesToUpdate.push(merged);
      }

      mergedTrades.push(merged);
    }
  });

  return { mergedTrades, tradesToDelete, tradesToUpdate };
};

const mergeUniqueTrades = (incoming: TradeRecord[], existing: TradeRecord[]) => {
  const map = new Map<string, TradeRecord>();
  [...incoming, ...existing].forEach((trade) => map.set(tradeKey(trade), normalizeTrade(trade)));
  return sortTradesDesc(Array.from(map.values()));
};

export default function App() {
  const initialPreset = getPresetById(readStored(STORAGE.themeId, "deep-navy"));

  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTabRaw] = useState<Tab>("dashboard");
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [isTradeEditMode, setIsTradeEditMode] = useState(false);

  const openTradeModal = (key: string | null, editMode?: boolean) => {
    setActiveTradeKey(key);
    if (key !== null) {
      setActiveTradeImageIndex(0);
      setPendingRemoveTradeKey(null);
      if (editMode !== undefined) setIsTradeEditMode(editMode);
    }
  };

  const setActiveTab = (tab: Tab) => {
    setActiveTabRaw(tab);
    window.history.pushState({ tab }, "", `#${tab}`);
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTabRaw(event.state.tab as Tab);
      } else {
        const hashTab = window.location.hash.replace("#", "") as Tab;
        if (hashTab) {
          setActiveTabRaw(hashTab);
        } else {
          setActiveTabRaw("dashboard");
        }
      }
    };
    
    // Set initial state based on hash or default
    const hashTab = window.location.hash.replace("#", "") as Tab;
    if (hashTab) {
      setActiveTabRaw(hashTab);
    }
    window.history.replaceState({ tab: hashTab || "dashboard" }, "", hashTab ? `#${hashTab}` : "");
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>(() => {
    const stored = readStoredJson<TradeRecord[]>(STORAGE.trades, []);
    const source = stored.length ? stored : INITIAL_TRADES;
    const normalized = sortTradesDesc(source.map(normalizeTrade));
    
    // Deduplicate trades by tradeKey
    const seen = new Set<string>();
    const uniqueTrades: TradeRecord[] = [];
    for (const trade of normalized) {
      const key = tradeKey(trade);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTrades.push(trade);
      }
    }
    return uniqueTrades;
  });

  useEffect(() => {
    if (isDemoMode) {
      setTrades(sortTradesDesc(INITIAL_TRADES.map(normalizeTrade)));
    }
  }, [isDemoMode]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [highlightedDayKey, setHighlightedDayKey] = useState<string | null>(null);
  const [activeTradeKey, setActiveTradeKey] = useState<string | null>(null);
  const [activeTradeImageIndex, setActiveTradeImageIndex] = useState(0);
  const [lightboxImageSrc, setLightboxImageSrc] = useState<string | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [tradeEditForm, setTradeEditForm] = useState<TradeEditForm | null>(null);
  
  const [pendingUserCount, setPendingUserCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      try {
        const { count, error } = await supabase
          .from('user_settings')
          .select('*', { count: 'exact', head: true })
          .eq('access_status', 'pending');
        if (!error && count !== null) {
          setPendingUserCount(count);
        }
      } catch (err) {}
    };
    fetchPending();
  }, [isAdmin]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("soldTimestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingRemoveTradeKey, setPendingRemoveTradeKey] = useState<string | null>(null);
  const tradeModalRef = useRef<HTMLDivElement | null>(null);
  const dayModalRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const dateRangeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateRangeContainerRef.current && !dateRangeContainerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [csvText, setCsvText] = useState("");
  const [importStatus, setImportStatus] = useState<{ type: "" | "success" | "error"; message: string }>({ type: "", message: "" });
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [importAccountId, setImportAccountId] = useState("");

  const [username, setUsername] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  
  const [isSavingTrade, setIsSavingTrade] = useState(false);
  const [tradeSaved, setTradeSaved] = useState(false);
  const [isUpdatingTrade, setIsUpdatingTrade] = useState(false);
  const [tradeUpdated, setTradeUpdated] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      if (!user) return;
      
      const file = event.target.files[0];
      setAvatarUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      await supabase.from('user_settings').update({ avatar_url: publicUrl }).eq('user_id', user.id);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);
    } catch(err) {
       console.error("error uploading avatar", err);
       alert("Error uploading avatar");
    } finally {
       setAvatarUploading(false);
    }
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [themeId, setThemeId] = useState(initialPreset.id);
  const [accentColor, setAccentColor] = useState(() => readStored(STORAGE.accent, initialPreset.accent));
  const [gradientStart, setGradientStart] = useState(() => readStored(STORAGE.gradientStart, initialPreset.start));
  const [gradientMid, setGradientMid] = useState(() => readStored(STORAGE.gradientMid, initialPreset.mid));
  const [gradientEnd, setGradientEnd] = useState(() => readStored(STORAGE.gradientEnd, initialPreset.end));
  const [panelTint, setPanelTint] = useState(() => readStored(STORAGE.panelTint, initialPreset.panelTint));
  const [textColor, setTextColor] = useState(() => readStored(STORAGE.textColor, "#e2e8f0"));
  const [glassOpacity, setGlassOpacity] = useState(() => readStoredNumber(STORAGE.glassOpacity, 0.58));
  const [accentInput, setAccentInput] = useState(() => readStored(STORAGE.accent, initialPreset.accent));
  const [panelTintInput, setPanelTintInput] = useState(() => readStored(STORAGE.panelTint, initialPreset.panelTint));
  const [textColorInput, setTextColorInput] = useState(() => readStored(STORAGE.textColor, "#e2e8f0"));
  const [singleColor, setSingleColor] = useState(() => readStored(STORAGE.singleColor, "false") === "true");
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => readStoredJson<SavedPreset[]>(STORAGE.savedPresets, []));
  const [presetName, setPresetName] = useState("");

  const [breakevenLow, setBreakevenLow] = useState(() => readStoredNumber(STORAGE.breakevenLow, -30));
  const [breakevenHigh, setBreakevenHigh] = useState(() => readStoredNumber(STORAGE.breakevenHigh, 30));

  const [confluenceLibrary, setConfluenceLibrary] = useState<string[]>(() =>
    sanitizeTagList(readStoredJson<string[]>(STORAGE.confluence, DEFAULT_CONFLUENCE_TAGS))
  );
  const [mistakeLibrary, setMistakeLibrary] = useState<string[]>(() => sanitizeTagList(readStoredJson<string[]>(STORAGE.mistake, DEFAULT_MISTAKE_TAGS)));
  const [entryLibrary, setEntryLibrary] = useState<string[]>(() => sanitizeTagList(readStoredJson<string[]>(STORAGE.entry, DEFAULT_ENTRY_TAGS)));
  const [labState, setLabState] = useState<any[]>(() => readStoredJson<any[]>(STORAGE.labState, []));
  const [profilePrivate, setProfilePrivate] = useState<boolean>(() => readStored("journal-profile-private", "false") === "true");
  const [friendsPrivate, setFriendsPrivate] = useState<boolean>(() => readStored(STORAGE.friendsPrivate, "false") === "true");
  const [friendsShareDetails, setFriendsShareDetails] = useState<boolean>(() => readStored(STORAGE.friendsShareDetails, "false") === "true");
  const [manualTradeSymbol, setManualTradeSymbol] = useState<string>(() => readStored(STORAGE.manualTradeSymbol, ""));
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [newConfluenceTag, setNewConfluenceTag] = useState("");
  const [newMistakeTag, setNewMistakeTag] = useState("");
  const [newEntryTag, setNewEntryTag] = useState("");
  const [autoFillPnl, setAutoFillPnl] = useState<boolean>(() => readStored("journal-auto-fill-pnl", "false") === "true");
  const [tradeTimezone, setTradeTimezone] = useState<string>(() => readStored("journal-trade-timezone", "Local"));
  const [accountsLibrary, setAccountsLibrary] = useState<any[]>(() => readStoredJson("journal-accounts-lib", []));
  const [newAccountSize, setNewAccountSize] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const [manualTrade, setManualTrade] = useState<ManualTradeForm>(() => createManualTradeForm(readStored(STORAGE.manualTradeSymbol, ""), readStored("journal-trade-timezone", "Local")));
  const [tradesLogLimit, setTradesLogLimit] = useState<number>(() => {
    return Number(readStored("journal-trades-log-limit", "25"));
  });

  const activePreset = useMemo(() => getPresetById(themeId), [themeId]);
  const breakevenFloor = Math.min(breakevenLow, breakevenHigh);
  const breakevenCeiling = Math.max(breakevenLow, breakevenHigh);

  useEffect(() => {
    // If we are in a popup window (OAuth callback), notify parent and close
    if (window.opener) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
          setTimeout(() => window.close(), 500);
        }
      });
      return () => subscription.unsubscribe();
    }

    // Normal app behavior
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setUser(session?.user ?? null);
        });
      }
    };
    window.addEventListener('message', handleMessage);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsLoading(false);
        if (event === 'SIGNED_OUT') {
          window.location.reload();
        }
      }
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      alert("⚠️ Missing Supabase configuration!\n\nPlease add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel Environment Variables, then redeploy.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
    if (error) {
      console.error('Login error:', error);
      alert(`Login failed: ${error.message}`);
    } else if (data?.url) {
      window.open(data.url, 'oauth_popup', 'width=600,height=700');
    }
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      return;
    }
    await supabase.auth.signOut();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.title = "Trading Journal";
  }, []);

  useEffect(() => {
    if (!user && !isDemoMode) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      if (isDemoMode) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const { data: tradesData, error: tradesError } = await supabase
          .from('trades_v2')
          .select('*')
          .eq('user_id', user.id);

        if (tradesError) {
          console.error("Error fetching trades:", tradesError);
        }

        if (tradesData) {
          const loadedTrades = tradesData.map(t => normalizeTrade({
            id: t.id,
            symbol: t.symbol,
            _priceFormat: t._price_format,
            _priceFormatType: t._price_format_type,
            _tickSize: Number(t._tick_size),
            buyFillId: t.buy_fill_id,
            sellFillId: t.sell_fill_id,
            qty: Number(t.qty),
            buyPrice: Number(t.buy_price),
            sellPrice: Number(t.sell_price),
            pnl: Number(t.pnl),
            boughtTimestamp: Number(t.bought_timestamp),
            soldTimestamp: Number(t.sold_timestamp),
            duration: Number(t.duration),
            direction: t.direction,
            maxPointsProfit: t.max_points_profit != null ? Number(t.max_points_profit) : undefined,
            commission: t.commission != null ? Number(t.commission) : undefined,
            accountId: t.account_id || "", 
            confluenceTags: t.confluence_tags,
            mistakeTags: t.mistake_tags,
            entryTags: t.entry_tags,
            images: t.images,
            notes: t.notes,
            source: t.source,
          }));

          setTrades(sortTradesDesc(loadedTrades));
        } else {
          setTrades([]);
        }

        try {
          const { data: settingsData, error: settingsError } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (settingsError) {
            console.error("Error loading settings (table might not exist):", settingsError);
          }

          let firstName = user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name?.split(' ')[0] || 'Trader';
          let avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

          let finalUsername = settingsData?.username;
          
          let role = settingsData?.role || 'user';
          let accessStatus = settingsData?.access_status || 'pending';

          const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
          if (adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase()) {
            role = 'admin';
            accessStatus = 'approved';
          }

          setIsAdmin(role === 'admin');
          setIsApproved(accessStatus === 'approved');

          if (!finalUsername) {
            // Generate unique username
            let baseName = firstName;
            let counter = 1;
            let isUnique = false;
            let candidate = baseName;
            
            while (!isUnique) {
              const { data: existing } = await supabase
                .from('user_settings')
                .select('username')
                .eq('username', candidate)
                .neq('user_id', user.id)
                .maybeSingle();
                
              if (existing) {
                candidate = `${baseName}${counter}`;
                counter++;
              } else {
                isUnique = true;
              }
            }
            finalUsername = candidate;
            setUsername(finalUsername);
            
            // Save the new username immediately
            await supabase.from('user_settings').upsert({
              user_id: user.id,
              username: finalUsername,
              avatar_url: avatarUrl,
              role,
              access_status: accessStatus,
              updated_at: new Date().toISOString()
            });
          } else {
            setUsername(finalUsername);
            // Update avatar, role, or access_status if missing or different
            if (
              (avatarUrl && settingsData?.avatar_url !== avatarUrl) ||
              settingsData?.role !== role ||
              settingsData?.access_status !== accessStatus
            ) {
              await supabase.from('user_settings').upsert({
                user_id: user.id,
                username: finalUsername,
                avatar_url: avatarUrl || settingsData?.avatar_url,
                role,
                access_status: accessStatus,
                updated_at: new Date().toISOString()
              });
            }
          }

          if (settingsData) {
            if (settingsData.theme_id) setThemeId(settingsData.theme_id);
            if (settingsData.accent_color) setAccentColor(settingsData.accent_color);
            if (settingsData.gradient_start) setGradientStart(settingsData.gradient_start);
            if (settingsData.gradient_mid) setGradientMid(settingsData.gradient_mid);
            if (settingsData.gradient_end) setGradientEnd(settingsData.gradient_end);
            if (settingsData.panel_tint) setPanelTint(settingsData.panel_tint);
            if (settingsData.text_color) setTextColor(settingsData.text_color);
            if (settingsData.glass_opacity !== null) setGlassOpacity(Number(settingsData.glass_opacity));
            if (settingsData.single_color !== null) setSingleColor(settingsData.single_color);
            if (settingsData.breakeven_low !== null) setBreakevenLow(Number(settingsData.breakeven_low));
            if (settingsData.breakeven_high !== null) setBreakevenHigh(Number(settingsData.breakeven_high));
            if (settingsData.friends_private !== null) setFriendsPrivate(Boolean(settingsData.friends_private));
            if (settingsData.friends_share_details !== null) setFriendsShareDetails(Boolean(settingsData.friends_share_details));
            if (settingsData.auto_fill_pnl !== null) setAutoFillPnl(Boolean(settingsData.auto_fill_pnl));
            if (settingsData.accounts_library !== null) setAccountsLibrary(settingsData.accounts_library);
            if (settingsData.manual_trade_symbol !== null && settingsData.manual_trade_symbol !== undefined) setManualTradeSymbol(settingsData.manual_trade_symbol);
            
            setConfluenceLibrary(settingsData.confluence_library || DEFAULT_CONFLUENCE_TAGS);
            setMistakeLibrary(settingsData.mistake_library || DEFAULT_MISTAKE_TAGS);
            setEntryLibrary(settingsData.entry_library || DEFAULT_ENTRY_TAGS);
            
            if (settingsData.saved_presets) setSavedPresets(settingsData.saved_presets);
            if (settingsData.lab_state) setLabState(settingsData.lab_state);
          } else {
            // If no settings exist for this user yet, ensure we don't bleed localStorage from other users
            setConfluenceLibrary(DEFAULT_CONFLUENCE_TAGS);
            setMistakeLibrary(DEFAULT_MISTAKE_TAGS);
            setEntryLibrary(DEFAULT_ENTRY_TAGS);
            setLabState([]);
          }
        } catch (settingsErr) {
          console.error("Error processing settings:", settingsErr);
        }

        try {
          const { count, error: friendsError } = await supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('friend_id', user.id).eq('status', 'pending');
          if (friendsError) console.error("Error loading friends:", friendsError);
          setPendingRequestsCount(count || 0);
        } catch (friendsErr) {
          console.error("Error loading friends catch:", friendsErr);
        }

      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    const channel = supabase.channel('friendrequests-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `friend_id=eq.${user.id}` }, async (payload) => {
        const { count } = await supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('friend_id', user.id).eq('status', 'pending');
        setPendingRequestsCount(count || 0);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || (user && !isDemoMode)) return;
    window.localStorage.setItem(STORAGE.trades, JSON.stringify(trades));
  }, [trades, user, isDemoMode]);

  useEffect(() => {
    if (typeof window === "undefined" || (user && !isDemoMode)) return;
    window.localStorage.setItem(STORAGE.themeId, themeId);
    window.localStorage.setItem(STORAGE.accent, accentColor);
    window.localStorage.setItem(STORAGE.gradientStart, gradientStart);
    window.localStorage.setItem(STORAGE.gradientMid, gradientMid);
    window.localStorage.setItem(STORAGE.gradientEnd, gradientEnd);
    window.localStorage.setItem(STORAGE.panelTint, panelTint);
    window.localStorage.setItem(STORAGE.textColor, textColor);
    window.localStorage.setItem(STORAGE.glassOpacity, String(glassOpacity));
    window.localStorage.setItem(STORAGE.singleColor, String(singleColor));
    window.localStorage.setItem(STORAGE.breakevenLow, String(breakevenLow));
    window.localStorage.setItem(STORAGE.breakevenHigh, String(breakevenHigh));
  }, [themeId, accentColor, gradientStart, gradientMid, gradientEnd, panelTint, textColor, glassOpacity, singleColor, breakevenLow, breakevenHigh, user, isDemoMode]);

  useEffect(() => {
    if (typeof window === "undefined" || (user && !isDemoMode)) return;
    window.localStorage.setItem(STORAGE.confluence, JSON.stringify(confluenceLibrary));
    window.localStorage.setItem(STORAGE.mistake, JSON.stringify(mistakeLibrary));
    window.localStorage.setItem(STORAGE.entry, JSON.stringify(entryLibrary));
    window.localStorage.setItem(STORAGE.savedPresets, JSON.stringify(savedPresets));
    window.localStorage.setItem(STORAGE.labState, JSON.stringify(labState));
    window.localStorage.setItem("journal-accounts-lib", JSON.stringify(accountsLibrary));
    window.localStorage.setItem("journal-auto-fill-pnl", String(autoFillPnl));
    window.localStorage.setItem("journal-trade-timezone", tradeTimezone);
    window.localStorage.setItem("journal-profile-private", String(profilePrivate));
    window.localStorage.setItem(STORAGE.friendsPrivate, String(friendsPrivate));
    window.localStorage.setItem(STORAGE.friendsShareDetails, String(friendsShareDetails));
    window.localStorage.setItem(STORAGE.manualTradeSymbol, manualTradeSymbol);
  }, [confluenceLibrary, mistakeLibrary, entryLibrary, savedPresets, labState, profilePrivate, friendsPrivate, friendsShareDetails, manualTradeSymbol, autoFillPnl, tradeTimezone, accountsLibrary, user, isDemoMode]);

  useEffect(() => {
    if (!user || isDemoMode) return;
    
    const fetchLeaderboard = async () => {
      try {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('*')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted');
          
        const userIds = new Set([user.id]);
        if (friendships) {
          friendships.forEach(f => {
            userIds.add(f.user_id);
            userIds.add(f.friend_id);
          });
        }
        
        const idArray = Array.from(userIds);
        
        const { data: settings } = await supabase
          .from('user_settings')
          .select('user_id, username, avatar_url')
          .in('user_id', idArray);
          
        const userMap: Record<string, any> = {};
        if (settings) {
          settings.forEach(s => userMap[s.user_id] = s);
        }
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        
        const { data: dbTrades } = await supabase
          .from('trades_v2')
          .select('user_id, pnl')
          .in('user_id', idArray)
          .gte('sold_timestamp', startOfMonth)
          .lte('sold_timestamp', endOfMonth);
          
        const pnlMap: Record<string, number> = {};
        idArray.forEach(id => pnlMap[id] = 0);
        
        if (dbTrades) {
          dbTrades.forEach(t => {
            pnlMap[t.user_id] += Number(t.pnl);
          });
        }
        
        const board = idArray.map(id => {
          const s = userMap[id];
          const name = id === user.id ? (s?.username || user.user_metadata?.full_name || 'Me') : (s?.username || 'Unknown');
          const avatar_url = id === user.id ? (s?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture) : s?.avatar_url;
          return { id, name, avatar_url, pnl: pnlMap[id] };
        }).sort((a, b) => b.pnl - a.pnl);
        
        setLeaderboard(board);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      }
    };
    
    fetchLeaderboard();
  }, [user, trades, isDemoMode]);

  useEffect(() => {
    if (!user || isLoading || isDemoMode) return;

    const saveSettings = async () => {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          username: username || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          theme_id: themeId,
          accent_color: accentColor,
          gradient_start: gradientStart,
          gradient_mid: gradientMid,
          gradient_end: gradientEnd,
          panel_tint: panelTint,
          text_color: textColor,
          glass_opacity: glassOpacity,
          single_color: singleColor,
          breakeven_low: breakevenLow,
          breakeven_high: breakevenHigh,
          profile_private: profilePrivate,
          friends_private: friendsPrivate,
          friends_share_details: friendsShareDetails,
          auto_fill_pnl: autoFillPnl,
          accounts_library: accountsLibrary,
          confluence_library: confluenceLibrary,
          mistake_library: mistakeLibrary,
          entry_library: entryLibrary,
          saved_presets: savedPresets,
          lab_state: labState,
          manual_trade_symbol: manualTradeSymbol,
          updated_at: new Date().toISOString(),
        });
      if (error) {
        console.error("Error saving settings. Did you run the SQL to create the user_settings table?", error);
      }
    };

    const timeoutId = setTimeout(saveSettings, 1000);
    return () => clearTimeout(timeoutId);
  }, [user, isLoading, username, themeId, accentColor, gradientStart, gradientMid, gradientEnd, panelTint, textColor, glassOpacity, singleColor, breakevenLow, breakevenHigh, profilePrivate, friendsPrivate, friendsShareDetails, manualTradeSymbol, confluenceLibrary, mistakeLibrary, entryLibrary, savedPresets, labState, autoFillPnl, accountsLibrary, isDemoMode]);

  const [activeFriendTheme, setActiveFriendTheme] = useState<any>(null);

  const isViewingFriendProfile = (activeTab === "friends" || activeTab === "terminal") && viewUserId !== null;

  const displayAccentColor = isViewingFriendProfile && activeFriendTheme?.accent_color ? activeFriendTheme.accent_color : accentColor;
  const displayGradientStart = isViewingFriendProfile && activeFriendTheme?.gradient_start ? activeFriendTheme.gradient_start : gradientStart;
  const displayGradientMid = isViewingFriendProfile && activeFriendTheme?.gradient_mid ? activeFriendTheme.gradient_mid : gradientMid;
  const displayGradientEnd = isViewingFriendProfile && activeFriendTheme?.gradient_end ? activeFriendTheme.gradient_end : gradientEnd;
  const displayPanelTint = isViewingFriendProfile && activeFriendTheme?.panel_tint ? activeFriendTheme.panel_tint : panelTint;
  const displayTextColor = isViewingFriendProfile && activeFriendTheme?.text_color ? activeFriendTheme.text_color : textColor;
  const displayGlassOpacity = isViewingFriendProfile && activeFriendTheme?.glass_opacity !== undefined ? activeFriendTheme.glass_opacity : glassOpacity;
  const displaySingleColor = isViewingFriendProfile && activeFriendTheme?.single_color !== undefined ? activeFriendTheme.single_color : singleColor;

  const rootBackground = useMemo<CSSProperties>(() => {
    if (displaySingleColor) {
      return {
        backgroundColor: displayGradientStart,
      };
    }
    return {
      backgroundImage: `radial-gradient(circle at 12% 15%, ${hexToRgba(displayAccentColor, 0.16)} 0%, transparent 35%), radial-gradient(circle at 86% 0%, ${hexToRgba(displayGradientMid, 0.22)} 0%, transparent 28%), linear-gradient(145deg, ${displayGradientStart} 0%, ${displayGradientMid} 50%, ${displayGradientEnd} 100%)`,
    };
  }, [displayAccentColor, displayGradientStart, displayGradientMid, displayGradientEnd, displaySingleColor]);

  const panelStyle = useMemo<CSSProperties>(
    () => ({
      background: `linear-gradient(180deg, ${hexToRgba(displayPanelTint, displayGlassOpacity)} 0%, ${hexToRgba(displayPanelTint, Math.max(displayGlassOpacity - 0.13, 0.16))} 100%)`,
      borderColor: hexToRgba(displayAccentColor, 0.2),
      boxShadow: `0 16px 48px ${hexToRgba("#020617", 0.32)}`,
    }),
    [displayPanelTint, displayGlassOpacity, displayAccentColor]
  );

  const softPanelStyle = useMemo<CSSProperties>(
    () => ({
      background: hexToRgba(displayPanelTint, Math.max(displayGlassOpacity - 0.22, 0.14)),
      borderColor: hexToRgba(displayAccentColor, 0.16),
    }),
    [displayPanelTint, displayGlassOpacity, displayAccentColor]
  );

  const accentButtonStyle = useMemo<CSSProperties>(
    () => ({
      background: `linear-gradient(135deg, ${displayAccentColor} 0%, ${hexToRgba(displayAccentColor, 0.7)} 100%)`,
      boxShadow: `0 14px 32px ${hexToRgba(displayAccentColor, 0.25)}`,
      color: getContrastColor(displayAccentColor),
    }),
    [displayAccentColor]
  );

  const realizedByDay = useMemo(() => {
    const grouped: Record<string, TradeRecord[]> = {};
    trades.forEach((trade) => {
      const key = toDayKey(trade.soldTimestamp);
      grouped[key] = grouped[key] ? [...grouped[key], trade] : [trade];
    });
    return grouped;
  }, [trades]);

  const monthCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const blanks: CalendarCell[] = Array.from({ length: firstDay.getDay() }, (_, index) => {
      const date = new Date(year, month, -firstDay.getDay() + index + 1);
      const key = toDayKey(date.getTime());
      const dayTrades = realizedByDay[key] ?? [];
      return { date, key, trades: dayTrades, pnl: dayTrades.reduce((sum, t) => sum + getNetPnl(t), 0), isOutOfMonth: true };
    });
    
    const days: CalendarCell[] = Array.from({ length: lastDay.getDate() }, (_, index) => {
      const date = new Date(year, month, index + 1);
      const key = toDayKey(date.getTime());
      const dayTrades = realizedByDay[key] ?? [];
      return { date, key, trades: dayTrades, pnl: dayTrades.reduce((sum, t) => sum + getNetPnl(t), 0), isOutOfMonth: false };
    });
    return { blanks, days };
  }, [currentDate, realizedByDay]);

  const calendarWeeks = useMemo(() => {
    const cells: CalendarCell[] = [...monthCells.blanks, ...monthCells.days];
    
    // Fill the rest of the week with next month's days
    let nextMonthDayCounter = 1;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    while (cells.length % 7 !== 0) {
      const date = new Date(year, month + 1, nextMonthDayCounter++);
      const key = toDayKey(date.getTime());
      const dayTrades = realizedByDay[key] ?? [];
      cells.push({ date, key, trades: dayTrades, pnl: dayTrades.reduce((sum, t) => sum + getNetPnl(t), 0), isOutOfMonth: true });
    }
    
    const chunks: { days: CalendarCell[]; total: number }[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const weekDays = cells.slice(i, i + 7);
      const total = weekDays.reduce((sum, day) => sum + day.pnl, 0);
      chunks.push({ days: weekDays, total });
    }
    return chunks;
  }, [monthCells, currentDate, realizedByDay]);

  const calendarDayHeight = useMemo(() => {
    const rows = Math.max(calendarWeeks.length, 4);
    return Math.max(92, Math.floor(640 / rows) - 8);
  }, [calendarWeeks.length]);

  const monthTotal = useMemo(() => monthCells.days.reduce((sum, day) => sum + day.pnl, 0), [monthCells.days]);

  const yearTotal = useMemo(() => {
    const year = currentDate.getFullYear();
    return trades.filter((trade) => new Date(trade.soldTimestamp).getFullYear() === year).reduce((sum, trade) => sum + getNetPnl(trade), 0);
  }, [trades, currentDate]);

  const maxCalendarAbsPnl = useMemo(() => {
    const values = monthCells.days.map((day) => Math.abs(day.pnl)).filter(Boolean);
    return values.length ? Math.max(...values) : 1;
  }, [monthCells.days]);

  const monthBestDay = useMemo(() => {
    const active = monthCells.days.filter((day) => day.trades.length > 0);
    if (!active.length) return null;
    return [...active].sort((a, b) => b.pnl - a.pnl)[0];
  }, [monthCells.days]);

  const monthWorstDay = useMemo(() => {
    const active = monthCells.days.filter((day) => day.trades.length > 0);
    if (!active.length) return null;
    return [...active].sort((a, b) => a.pnl - b.pnl)[0];
  }, [monthCells.days]);

  const tradeStats = useMemo(() => {
    const statusCounts = { win: 0, loss: 0, breakeven: 0 };
    let breakevenTotal = 0;
    trades.forEach((trade) => {
      const status = getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling);
      statusCounts[status] += 1;
      if (status === "breakeven") breakevenTotal += getNetPnl(trade);
    });
    const decisiveWins = trades.filter((t) => getTradeStatus(getNetPnl(t), breakevenFloor, breakevenCeiling) === "win");
    const decisiveLosses = trades.filter((t) => getTradeStatus(getNetPnl(t), breakevenFloor, breakevenCeiling) === "loss");
    const grossProfit = decisiveWins.reduce((sum, t) => sum + getNetPnl(t), 0);
    const grossLoss = Math.abs(decisiveLosses.reduce((sum, t) => sum + getNetPnl(t), 0));
    const decisiveCount = statusCounts.win + statusCounts.loss;
    return {
      totalPnL: trades.reduce((sum, t) => sum + getNetPnl(t), 0),
      totalTrades: trades.length,
      wins: statusCounts.win,
      losses: statusCounts.loss,
      breakevens: statusCounts.breakeven,
      breakevenTotal,
      winRate: decisiveCount ? (statusCounts.win / decisiveCount) * 100 : 0,
      profitFactor: grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss,
    };
  }, [trades, breakevenFloor, breakevenCeiling]);

  const symbolTradeShare = useMemo(() => {
    const totalTrades = Math.max(trades.length, 1);
    const map = new Map<string, { trades: number; pnl: number }>();
    trades.forEach((trade) => {
      const groupedSymbol = normalizeSymbolRoot(trade.symbol);
      const current = map.get(groupedSymbol) ?? { trades: 0, pnl: 0 };
      map.set(groupedSymbol, { trades: current.trades + 1, pnl: current.pnl + getNetPnl(trade) });
    });
    return [...map.entries()]
      .map(([symbol, values]) => ({
        symbol,
        tradeCount: values.trades,
        pnl: values.pnl,
        tradePct: (values.trades / totalTrades) * 100,
      }))
      .sort((a, b) => b.tradePct - a.tradePct);
  }, [trades]);

  const avgWinLoss = useMemo(() => {
    const wins = trades.filter((trade) => getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "win");
    const losses = trades.filter((trade) => getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "loss");
    const avgWin = wins.length ? wins.reduce((sum, trade) => sum + getNetPnl(trade), 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((sum, trade) => sum + getNetPnl(trade), 0) / losses.length : 0;
    const totalAbs = Math.max(Math.abs(avgWin) + Math.abs(avgLoss), 1);
    return {
      avgWin,
      avgLoss,
      winPct: (Math.abs(avgWin) / totalAbs) * 100,
      lossPct: (Math.abs(avgLoss) / totalAbs) * 100,
    };
  }, [trades, breakevenFloor, breakevenCeiling]);


  const recentTrades = useMemo(() => sortTradesDesc(trades).slice(0, 10), [trades]);

  const manualAutoPnl = useMemo(() => {
    return calculateTradePnl({
      symbol: manualTrade.symbol,
      direction: manualTrade.direction,
      qty: parseNumeric(manualTrade.qty),
      buyPrice: parseNumeric(manualTrade.buyPrice),
      sellPrice: parseNumeric(manualTrade.sellPrice),
      tickSize: parseNumeric(manualTrade._tickSize),
    });
  }, [manualTrade]);

  const tradeEditAutoPnl = useMemo(() => {
    if (!tradeEditForm) return 0;
    return calculateTradePnl({
      symbol: tradeEditForm.symbol,
      direction: tradeEditForm.direction,
      qty: parseNumeric(tradeEditForm.qty),
      buyPrice: parseNumeric(tradeEditForm.buyPrice),
      sellPrice: parseNumeric(tradeEditForm.sellPrice),
      tickSize: parseNumeric(tradeEditForm._tickSize),
    });
  }, [tradeEditForm]);

  useEffect(() => {
    if (autoFillPnl) {
      setManualTrade(prev => ({ ...prev, pnl: String(manualAutoPnl) }));
    }
  }, [manualAutoPnl, autoFillPnl]);

  useEffect(() => {
    if (autoFillPnl && tradeEditForm) {
      setTradeEditForm(prev => prev ? { ...prev, pnl: String(tradeEditAutoPnl) } : prev);
    }
  }, [tradeEditAutoPnl, autoFillPnl]);

  const filteredTrades = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const startBoundary = dateRangeStart ? new Date(`${dateRangeStart}T00:00:00`).getTime() : null;
    const endBoundary = dateRangeEnd ? new Date(`${dateRangeEnd}T23:59:59`).getTime() : null;
    return [...trades]
      .filter((trade) => {
        const inDateRange = (startBoundary === null || trade.soldTimestamp >= startBoundary) && (endBoundary === null || trade.soldTimestamp <= endBoundary);
        if (!inDateRange) return false;
        if (!query) return true;
        const status = getTradeStatus(trade.pnl, breakevenFloor, breakevenCeiling);
        const tags = [...(trade.confluenceTags ?? []), ...(trade.mistakeTags ?? []), ...(trade.entryTags ?? [])].join(" ").toLowerCase();
        return (
          (trade.symbol || "").toLowerCase().includes(query) ||
          (trade.buyFillId || "").toLowerCase().includes(query) ||
          (trade.sellFillId || "").toLowerCase().includes(query) ||
          (trade.direction || "").toLowerCase().includes(query) ||
          status.toLowerCase().includes(query) ||
          tags.includes(query)
        );
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === "soldTimestamp") comparison = a.soldTimestamp - b.soldTimestamp;
        if (sortBy === "pnl") comparison = a.pnl - b.pnl;
        if (sortBy === "symbol") comparison = String(a.symbol ?? "").localeCompare(String(b.symbol ?? ""));
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [trades, searchTerm, sortBy, sortOrder, breakevenFloor, breakevenCeiling, dateRangeStart, dateRangeEnd]);

  const selectedDayTrades = useMemo(() => {
    if (!selectedDayKey) return null;
    const [year, month, day] = selectedDayKey.split("-").map(Number);
    const date = new Date(year, (month ?? 1) - 1, day ?? 1);
    
    let title = selectedDayKey;
    if (!isNaN(date.getTime())) {
      title = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    return {
      title,
      trades: realizedByDay[selectedDayKey] ?? [],
    };
  }, [selectedDayKey, realizedByDay]);

  const selectedTrade = useMemo(() => trades.find((trade) => tradeKey(trade) === activeTradeKey) ?? null, [trades, activeTradeKey]);

  useEffect(() => {
    if (!activeTradeKey) {
      setTradeEditForm(null);
      return;
    }
    setTradeEditForm((prev) => {
      // If we are already editing the active trade, don't reset the form
      // because that would wipe out unsaved edits (like account selection) when tags are toggled
      if (prev && prev._sourceTradeKey === activeTradeKey) {
        return prev;
      }
      return selectedTrade ? createTradeEditForm(selectedTrade, tradeTimezone) : null;
    });
  }, [activeTradeKey, selectedTrade, tradeTimezone]);

  useEffect(() => setAccentInput(accentColor), [accentColor]);
  useEffect(() => setPanelTintInput(panelTint), [panelTint]);
  useEffect(() => setTextColorInput(textColor), [textColor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImageSrc(null);
        setLightboxZoomed(false);
        openTradeModal(null);
        setSelectedDayKey(null);
        setPendingRemoveTradeKey(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ensureLibraryTag = (kind: TagKind, rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return "";
    const current = kind === "confluence" ? confluenceLibrary : kind === "mistake" ? mistakeLibrary : entryLibrary;
    const existing = current.find((tag) => tag.toLowerCase() === trimmed.toLowerCase());
    const canonical = existing ?? trimmed;
    if (!existing) {
      if (kind === "confluence") setConfluenceLibrary((prev) => [...prev, canonical]);
      else if (kind === "mistake") setMistakeLibrary((prev) => [...prev, canonical]);
      else setEntryLibrary((prev) => [...prev, canonical]);
    }
    return canonical;
  };

  const updateTrade = async (targetKey: string, updater: (trade: TradeRecord) => TradeRecord) => {
    // 1) Find current trade
    const currentTrade = trades.find((t) => tradeKey(t) === targetKey);
    if (!currentTrade) return;

    // 2) Compute updated trade synchronously
    const updatedTrade = normalizeTrade(updater(currentTrade));

    // 3) Push to React state
    setTrades((previous) => {
      const newTrades = previous.map((trade) => {
        if (tradeKey(trade) === targetKey) {
          const newKey = tradeKey(updatedTrade);
          if (newKey !== targetKey) {
            setActiveTradeKey((prev) => (prev === targetKey ? newKey : prev));
          }
          return updatedTrade;
        }
        return trade;
      });
      const seen = new Set<string>();
      return newTrades.filter((trade) => {
        const key = tradeKey(trade);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

    // 4) Execute async Supabase update
    if (user && !isDemoMode && updatedTrade.id) {
      const t = updatedTrade;
      console.log("Sending trace to Supabase:", t);
      const updatePayload = {
        symbol: t.symbol,
        _price_format: t._priceFormat,
        _price_format_type: t._priceFormatType,
        _tick_size: t._tickSize,
        buy_fill_id: t.buyFillId,
        sell_fill_id: t.sellFillId,
        qty: t.qty,
        buy_price: t.buyPrice,
        sell_price: t.sellPrice,
        pnl: t.pnl,
        bought_timestamp: t.boughtTimestamp,
        sold_timestamp: t.soldTimestamp,
        duration: t.duration,
        direction: t.direction,
        max_points_profit: t.maxPointsProfit,
        commission: t.commission,
        account_id: t.accountId || null,
        confluence_tags: t.confluenceTags,
        mistake_tags: t.mistakeTags,
        entry_tags: t.entryTags,
        images: t.images,
        notes: t.notes,
        source: t.source,
      };
      console.log("Sending payload to Supabase trades_v2 update:", updatePayload);
      const { data, error, count } = await supabase.from('trades_v2').update(updatePayload).eq('id', t.id).select();
      if (error) {
         console.error("SQL UPDATE ERROR:", error);
         alert("Failed to save trade: " + error.message);
      } else if (!data || data.length === 0) {
         console.error("SQL UPDATE RETURNED 0 ROWS modified. ID:", t.id);
         alert("Save failed: Mismatched ID, or permission denied by RLS! See console.");
      } else {
         console.log("Update success!", data);
      }
    }
  };

  const toggleTradeTag = (targetKey: string, kind: TagKind, tag: string) => {
    updateTrade(targetKey, (trade) => {
      const list = kind === "confluence" ? trade.confluenceTags ?? [] : kind === "mistake" ? trade.mistakeTags ?? [] : trade.entryTags ?? [];
      const next = list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag];
      return {
        ...trade,
        confluenceTags: kind === "confluence" ? next : trade.confluenceTags,
        mistakeTags: kind === "mistake" ? next : trade.mistakeTags,
        entryTags: kind === "entry" ? next : trade.entryTags,
      };
    });
  };

  const addImagesToTrade = (targetKey: string, files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!fileArray.length) return;

    Promise.all(
      fileArray.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Unable to read image file"));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((images) => {
        if (targetKey === activeTradeKey && isTradeEditMode) {
           setTradeEditForm(prev => prev ? { ...prev, images: [...prev.images, ...images].slice(0, 8) } : prev);
        } else {
           updateTrade(targetKey, (trade) => ({ ...trade, images: [...(trade.images ?? []), ...images].slice(0, 8) }));
        }
      })
      .catch(() => {
        setImportStatus({ type: "error", message: "One or more images could not be loaded." });
      });
  };

  const handleTradePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!selectedTrade) return;
    if (!isTradeEditMode) return;
    const images: File[] = [];
    Array.from(event.clipboardData.items).forEach((item: DataTransferItem) => {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) images.push(file);
      }
    });
    if (images.length) {
      event.preventDefault();
      addImagesToTrade(tradeKey(selectedTrade), images);
    }
  };

  const removeTradeImage = (targetKey: string, index: number) => {
    if (targetKey === activeTradeKey && isTradeEditMode) {
      setTradeEditForm(prev => prev ? { ...prev, images: prev.images.filter((_, i) => i !== index) } : prev);
    } else {
      updateTrade(targetKey, (trade) => ({ ...trade, images: (trade.images ?? []).filter((_, i) => i !== index) }));
    }
    setActiveTradeImageIndex(0);
  };

  const removeTrade = async (targetKey: string) => {
    const tradeToRemove = trades.find((trade) => tradeKey(trade) === targetKey);
    setTrades((previous) => previous.filter((trade) => tradeKey(trade) !== targetKey));
    setActiveTradeKey((current) => (current === targetKey ? null : current));
    setSelectedDayKey((current) => {
      if (!current) return current;
      const remainingInDay = trades.some((trade) => toDayKey(trade.soldTimestamp) === current && tradeKey(trade) !== targetKey);
      return remainingInDay ? current : null;
    });

    if (user && !isDemoMode && tradeToRemove) {
      let query = supabase.from('trades_v2').delete();
      if (tradeToRemove.id) {
        query = query.eq('id', tradeToRemove.id);
      } else {
        query = query
          .eq('user_id', user.id)
          .eq('symbol', tradeToRemove.symbol)
          .eq('bought_timestamp', tradeToRemove.boughtTimestamp)
          .eq('sold_timestamp', tradeToRemove.soldTimestamp);
      }
      
      const { error } = await query;
      if (error) {
        console.error("Error deleting trade:", error);
      }
    }
  };

  const saveTradeEdits = () => {
    if (!activeTradeKey || !tradeEditForm) return;
    setIsUpdatingTrade(true);
    const boughtTimestamp = parseInputTime(tradeEditForm.boughtTimestamp, tradeTimezone);
    const soldTimestamp = parseInputTime(tradeEditForm.soldTimestamp, tradeTimezone);
    const fallbackDuration = Math.max(Math.round((soldTimestamp - boughtTimestamp) / 1000), 0);
    updateTrade(activeTradeKey, (trade) => {
      const symbol = tradeEditForm.symbol.trim() || trade.symbol;
      const qty = parseNumeric(tradeEditForm.qty);
      const buyPrice = parseNumeric(tradeEditForm.buyPrice);
      const sellPrice = parseNumeric(tradeEditForm.sellPrice);
      const tickSize = parseNumeric(tradeEditForm._tickSize);
      const autoPnl = calculateTradePnl({ symbol, direction: tradeEditForm.direction, qty, buyPrice, sellPrice, tickSize });
      return {
        ...trade,
        symbol,
        _priceFormat: tradeEditForm._priceFormat,
        _priceFormatType: tradeEditForm._priceFormatType,
        _tickSize: tickSize,
        buyFillId: trade.buyFillId || `id-${Date.now()}-b`,
        sellFillId: trade.sellFillId || `id-${Date.now()}-s`,
        qty,
        buyPrice,
        sellPrice,
        pnl: tradeEditForm.pnl.trim() ? parseNumeric(tradeEditForm.pnl) : autoPnl,
        boughtTimestamp,
        soldTimestamp,
        duration: tradeEditForm.duration.trim() ? parseDuration(tradeEditForm.duration) : fallbackDuration,
        direction: tradeEditForm.direction,
        maxPointsProfit: tradeEditForm.maxPointsProfit.trim() ? parseNumeric(tradeEditForm.maxPointsProfit) : null,
        commission: tradeEditForm.commission.trim() ? parseNumeric(tradeEditForm.commission) : trade.commission,
        accountId: tradeEditForm.accountId || null,
        confluenceTags: tradeEditForm.confluenceTags,
        mistakeTags: tradeEditForm.mistakeTags,
        entryTags: tradeEditForm.entryTags,
        images: tradeEditForm.images,
        notes: tradeEditForm.notes,
      };
    });
    setImportStatus({ type: "success", message: "Trade updated." });
    setIsUpdatingTrade(false);
    setTradeUpdated(true);
    setTimeout(() => setTradeUpdated(false), 2000);
  };

  const applyPreset = (preset: ThemePreset) => {
    setThemeId(preset.id);
    setAccentColor(preset.accent);
    setGradientStart(preset.start);
    setGradientMid(preset.mid);
    setGradientEnd(preset.end);
    setPanelTint(preset.panelTint);
  };

  const resetVisuals = () => {
    applyPreset(activePreset);
    setGlassOpacity(0.58);
    setSingleColor(false);
  };

  const saveCurrentPreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const item: SavedPreset = {
      id: `saved-${Date.now()}`,
      name,
      accent: accentColor,
      start: gradientStart,
      mid: gradientMid,
      end: gradientEnd,
      panelTint,
      savedAt: Date.now(),
    };
    setSavedPresets((prev) => [item, ...prev].slice(0, 12));
    setPresetName("");
  };

  const handleCSVImport = (text: string) => {
    if (!text.trim()) {
      setImportStatus({ type: "error", message: "CSV content cannot be empty." });
      return;
    }

    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: async (results: ParseResult<Record<string, string>>) => {
        if (results.errors.length > 0) {
          setImportStatus({ type: "error", message: `Parsing error: ${results.errors[0].message}` });
          return;
        }
        const actualHeaders = (results.meta.fields || []).map((header) => header.trim());
        const exactOrderMatches = actualHeaders.includes("symbol") && actualHeaders.includes("buyPrice") && actualHeaders.includes("sellPrice");
        
        const isNinjaTraderLike = 
          actualHeaders.includes("Time") && 
          actualHeaders.includes("Symbol") && 
          actualHeaders.includes("Side") && 
          actualHeaders.includes("Status") &&
          actualHeaders.includes("Qty");

        const isTopstepX = 
          actualHeaders.includes("ContractName") && 
          actualHeaders.includes("EnteredAt") && 
          actualHeaders.includes("ExitedAt") && 
          actualHeaders.includes("PnL");

        if (!exactOrderMatches && !isNinjaTraderLike && !isTopstepX) {
          setImportStatus({ type: "error", message: `CSV columns must contain symbol, buyPrice, and sellPrice, or be in NinjaTrader or TopstepX format.` });
          return;
        }

        let mappedTrades: TradeRecord[] = [];

        if (exactOrderMatches) {
          mappedTrades = results.data
            .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""))
            .map((row) => {
              const buyPrice = parseNumeric(row.buyPrice);
              const sellPrice = parseNumeric(row.sellPrice);
              const boughtTimestamp = parseTimestamp(row.boughtTimestamp);
              const soldTimestamp = parseTimestamp(row.soldTimestamp);
              const direction: Direction = soldTimestamp < boughtTimestamp ? "short" : "long";
              const qty = parseNumeric(row.qty);
              const tickSize = parseNumeric(row._tickSize || "0.25");
              
              let rawSymbol = String(row.symbol || "UNKNOWN").trim();
              if (rawSymbol.toUpperCase().includes("CME")) {
                rawSymbol = rawSymbol.toUpperCase().replace(/CME[\s_:-]*/g, "");
              }

              return normalizeTrade({
                symbol: rawSymbol,
                _priceFormat: String(row._priceFormat || "").trim(),
                _priceFormatType: String(row._priceFormatType || "").trim(),
                _tickSize: tickSize,
                buyFillId: String(row.buyFillId || "").trim(),
                sellFillId: String(row.sellFillId || "").trim(),
                qty,
                buyPrice,
                sellPrice,
                pnl: String(row.pnl ?? "").trim() ? parseNumeric(row.pnl) : calculateTradePnl({ symbol: rawSymbol, direction, qty, buyPrice, sellPrice, tickSize }),
                boughtTimestamp,
                soldTimestamp,
                duration: parseDuration(row.duration),
                direction,
                confluenceTags: [],
                mistakeTags: [],
                entryTags: [],
                images: [],
                source: "csv",
              });
            })
            .filter((trade) => trade.symbol && trade.symbol !== "UNKNOWN");
        } else if (isNinjaTraderLike) {
          const filledOrders = results.data.filter((row: any) => row.Status === "Filled");
          // NT format Time e.g.: "4/17/2026, 4:20:21 PM GMT+2"
          filledOrders.sort((a, b) => new Date(a.Time).getTime() - new Date(b.Time).getTime());
          
          type PosInfo = { qty: number; avgPrice: number; time: number; side: "Buy" | "Sell"; };
          const positions: Record<string, PosInfo> = {};
          
          for (const row of filledOrders) {
            const sym = String(row.Symbol).trim();
            if (!sym) continue;
            
            const side = String(row.Side).trim(); // "Buy" or "Sell"
            const qty = Math.abs(Number(row.Qty || 0));
            const _price = Number(row["Avg Price"] || row["Limit Price"] || row["Stop Price"] || 0);
            let time = Date.now();
            try { time = new Date(row.Time).getTime(); } catch {}

            if (!positions[sym] || positions[sym].qty === 0) {
              positions[sym] = { qty, avgPrice: _price, time, side: side as "Buy" | "Sell" };
            } else {
              const pos = positions[sym];
              if (pos.side === side) {
                // Scaling in
                const totalQty = pos.qty + qty;
                pos.avgPrice = (pos.avgPrice * pos.qty + _price * qty) / totalQty;
                pos.qty = totalQty;
              } else {
                // Closing out (partial or full)
                const closeQty = Math.min(pos.qty, qty);
                const isLong = pos.side === "Buy";
                
                const buyPrice = isLong ? pos.avgPrice : _price;
                const sellPrice = isLong ? _price : pos.avgPrice;
                const boughtTimestamp = isLong ? pos.time : time;
                const soldTimestamp = isLong ? time : pos.time;

                const root = normalizeSymbolRoot(sym);
                const tickSize = TICK_SIZE_BY_ROOT[root] || 1;
                const direction: Direction = isLong ? "long" : "short";

                const pnl = calculateTradePnl({
                  symbol: sym,
                  direction,
                  qty: closeQty,
                  buyPrice,
                  sellPrice,
                  tickSize,
                });

                mappedTrades.push(normalizeTrade({
                  symbol: sym,
                  _priceFormat: "-2",
                  _priceFormatType: "0",
                  _tickSize: tickSize,
                  buyFillId: `auto-${Date.now()}-${mappedTrades.length}-b`,
                  sellFillId: `auto-${Date.now()}-${mappedTrades.length}-s`,
                  qty: closeQty,
                  buyPrice,
                  sellPrice,
                  pnl,
                  boughtTimestamp,
                  soldTimestamp,
                  duration: Math.abs(soldTimestamp - boughtTimestamp),
                  direction,
                  source: "csv",
                }));

                pos.qty -= closeQty;
              }
            }
          }
        } else if (isTopstepX) {
          mappedTrades = results.data.filter((row: any) => row.ContractName && row.EnteredAt).map((row: any) => {
            const direction = String(row.Type || "").toLowerCase() === "short" ? "short" : "long";
            const boughtTs = parseTimestamp(row.EnteredAt);
            const soldTs = parseTimestamp(row.ExitedAt);
            const qty = parseNumeric(row.Size);
            const buyPrice = direction === "long" ? parseNumeric(row.EntryPrice) : parseNumeric(row.ExitPrice);
            const sellPrice = direction === "long" ? parseNumeric(row.ExitPrice) : parseNumeric(row.EntryPrice);
            
            const root = normalizeSymbolRoot(String(row.ContractName || "UNKNOWN").trim());
            const tickSize = TICK_SIZE_BY_ROOT[root] || 0.25;

            return normalizeTrade({
                symbol: String(row.ContractName || "UNKNOWN").trim(),
                _priceFormat: "",
                _priceFormatType: "",
                _tickSize: tickSize,
                buyFillId: String(row.Id || ""),
                sellFillId: String(row.Id || ""),
                qty,
                buyPrice,
                sellPrice,
                pnl: parseNumeric(row.PnL),
                commission: parseNumeric(row.Commissions || row.Fees || "0"),
                boughtTimestamp: boughtTs || 0,
                soldTimestamp: soldTs || boughtTs || 0,
                duration: Math.abs((soldTs || 0) - (boughtTs || 0)),
                direction,
                confluenceTags: [],
                mistakeTags: [],
                entryTags: [],
                images: [],
                source: "csv",
                accountId: importAccountId || undefined,
            });
          });
        }

        if (!mappedTrades.length) {
          setImportStatus({ type: "error", message: "No valid trade rows were found in the CSV." });
          return;
        }
        
        // Filter duplicates comparing to current trades based strictly on unique keys
        const newUniqueTrades = mappedTrades.filter(mapped => {
            return !trades.some(existing => 
                existing.symbol === mapped.symbol &&
                existing.boughtTimestamp === mapped.boughtTimestamp &&
                existing.soldTimestamp === mapped.soldTimestamp
            );
        });

        if (newUniqueTrades.length === 0) {
            setImportStatus({ type: "success", message: "0 valid CSV rows parsed. They were all duplicates." });
            return;
        }

        if (user && !isDemoMode) {
          const tradesToInsert = newUniqueTrades.map(t => ({
            user_id: user.id,
            symbol: t.symbol,
            _price_format: t._priceFormat,
            _price_format_type: t._priceFormatType,
            _tick_size: t._tickSize,
            buy_fill_id: t.buyFillId,
            sell_fill_id: t.sellFillId,
            qty: t.qty,
            buy_price: t.buyPrice,
            sell_price: t.sellPrice,
            pnl: t.pnl,
            commission: t.commission,
            bought_timestamp: t.boughtTimestamp,
            sold_timestamp: t.soldTimestamp,
            duration: t.duration,
            direction: t.direction,
            max_points_profit: t.maxPointsProfit,
            confluence_tags: t.confluenceTags,
            mistake_tags: t.mistakeTags,
            entry_tags: t.entryTags,
            images: t.images,
            source: t.source,
            account_id: t.accountId || null,
          }));

          const insertedTrades = [];
          for (let i = 0; i < tradesToInsert.length; i += 100) {
            const { data } = await supabase.from('trades_v2').insert(tradesToInsert.slice(i, i + 100)).select();
            if (data) insertedTrades.push(...data);
          }

          newUniqueTrades.forEach((t, i) => {
            if (insertedTrades[i]) {
              t.id = insertedTrades[i].id;
            }
          });
        }

        // Only add trades to current list, do not overwrite/merge in a way that risks losing data unexpectedly
        setTrades((prev) => mergeUniqueTrades(newUniqueTrades, prev));
        setImportStatus({ type: "success", message: `Imported ${newUniqueTrades.length} trade${newUniqueTrades.length === 1 ? "" : "s"}.` });
      },
    });
  };

  const exportAllTrades = () => {
    const rows = sortTradesDesc(trades).map((trade) => ({
      symbol: trade.symbol,
      _priceFormat: trade._priceFormat,
      _priceFormatType: trade._priceFormatType,
      _tickSize: trade._tickSize,
      buyFillId: trade.buyFillId,
      sellFillId: trade.sellFillId,
      qty: trade.qty,
      buyPrice: trade.buyPrice,
      sellPrice: trade.sellPrice,
      pnl: trade.pnl,
      boughtTimestamp: formatCsvDate(trade.boughtTimestamp),
      soldTimestamp: formatCsvDate(trade.soldTimestamp),
      duration: `${trade.duration}sec`,
    }));

    const csv = Papa.unparse(rows, { columns: REQUIRED_HEADERS });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trading_journal_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (!files.length) return;
    
    let combinedContent = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (loadEvent) => resolve(String(loadEvent.target?.result || ""));
        reader.readAsText(file);
      });
      
      // If it's not the first file, we might want to strip the header row to avoid duplicates
      // But papaparse handles duplicate headers if we just concatenate, or we can just parse them individually
      // Actually, let's just concatenate them with a newline. PapaParse might get confused if headers repeat in the middle,
      // so it's better to parse them individually and combine the results.
      // Wait, the user can also paste CSV text. Let's just append the text.
      if (i > 0) {
        // Simple heuristic: remove the first line (header) from subsequent files
        const lines = content.split('\n');
        if (lines.length > 0) lines.shift();
        combinedContent += "\n" + lines.join('\n');
      } else {
        combinedContent += content;
      }
    }
    
    setCsvText(combinedContent);
    // Reset the input so the same files can be selected again if needed
    event.target.value = '';
  };

  const handleManualTradeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const symbol = manualTrade.symbol.trim();
    if (!symbol) {
      setImportStatus({ type: "error", message: "Manual trade requires a symbol." });
      setActiveTab("trades");
      return;
    }
    const boughtTimestamp = parseInputTime(manualTrade.boughtTimestamp, tradeTimezone);
    const soldTimestamp = parseInputTime(manualTrade.soldTimestamp, tradeTimezone);
    const computedDuration = Math.max(Math.round((soldTimestamp - boughtTimestamp) / 1000), 0);
    
    // We don't need to swap here because the input binding already stores Start Price in sellPrice if short, and End Price in buyPrice if short.
    const buyPriceRaw = parseNumeric(manualTrade.buyPrice);
    const sellPriceRaw = parseNumeric(manualTrade.sellPrice);

    const trade = normalizeTrade({
      symbol,
      _priceFormat: manualTrade._priceFormat,
      _priceFormatType: manualTrade._priceFormatType,
      _tickSize: parseNumeric(manualTrade._tickSize),
      buyFillId: `id-${Date.now()}-b`,
      sellFillId: `id-${Date.now()}-s`,
      qty: parseNumeric(manualTrade.qty),
      buyPrice: buyPriceRaw,
      sellPrice: sellPriceRaw,
      pnl: 0,
      boughtTimestamp,
      soldTimestamp,
      duration: manualTrade.duration.trim() ? parseDuration(manualTrade.duration) : computedDuration,
      direction: manualTrade.direction,
      commission: manualTrade.commission.trim() ? parseNumeric(manualTrade.commission) : undefined,
      accountId: manualTrade.accountId,
      confluenceTags: manualTrade.confluenceTags,
      mistakeTags: manualTrade.mistakeTags,
      entryTags: manualTrade.entryTags,
      images: [],
      source: "manual",
    });
    const autoPnl = calculateTradePnl({
      symbol,
      direction: manualTrade.direction,
      qty: trade.qty,
      buyPrice: trade.buyPrice,
      sellPrice: trade.sellPrice,
      tickSize: trade._tickSize,
    });
    trade.pnl = manualTrade.pnl.trim() ? parseNumeric(manualTrade.pnl) : autoPnl;

    if (user && !isDemoMode) {
      setIsSavingTrade(true);
      const { data, error } = await supabase.from('trades_v2').insert({
        user_id: user.id,
        symbol: trade.symbol,
        _price_format: trade._priceFormat,
        _price_format_type: trade._priceFormatType,
        _tick_size: trade._tickSize,
        buy_fill_id: trade.buyFillId,
        sell_fill_id: trade.sellFillId,
        qty: trade.qty,
        buy_price: trade.buyPrice,
        sell_price: trade.sellPrice,
        pnl: trade.pnl,
        bought_timestamp: trade.boughtTimestamp,
        sold_timestamp: trade.soldTimestamp,
        duration: trade.duration,
        direction: trade.direction,
        max_points_profit: trade.maxPointsProfit,
        commission: trade.commission,
        account_id: trade.accountId || null,
        confluence_tags: trade.confluenceTags,
        mistake_tags: trade.mistakeTags,
        entry_tags: trade.entryTags,
        images: trade.images,
        notes: trade.notes,
        source: trade.source,
      }).select().maybeSingle();
      
      setIsSavingTrade(false);
      setTradeSaved(true);
      setTimeout(() => setTradeSaved(false), 2000);

      if (data) {
        trade.id = data.id;
      }
    } else {
      setTradeSaved(true);
      setTimeout(() => setTradeSaved(false), 2000);
    }

    setTrades((previous) => mergeUniqueTrades([trade], previous));
    setManualTradeSymbol(symbol);
    setManualTrade(createManualTradeForm(symbol, tradeTimezone));
    setCurrentDate(new Date(trade.soldTimestamp));
    setImportStatus({ type: "success", message: `${trade.symbol} trade added.` });
  };

  const biggestWin = trades.length ? [...trades].sort((a, b) => b.pnl - a.pnl)[0] : null;
  const biggestLoss = trades.length ? [...trades].sort((a, b) => a.pnl - b.pnl)[0] : null;

  const metrics = [
    { label: "Net P&L", value: formatSignedCurrency(tradeStats.totalPnL), tone: tradeStats.totalPnL >= 0 ? "text-emerald-300" : "text-rose-300" },
    { label: "Win Rate", value: `${tradeStats.winRate.toFixed(1)}%`, tone: "text-slate-200" },
    {
      label: "Breakeven Trades",
      value: `${tradeStats.breakevens} • ${(tradeStats.totalTrades ? (tradeStats.breakevens / tradeStats.totalTrades) * 100 : 0).toFixed(1)}% • ${formatSignedCurrency(tradeStats.breakevenTotal)}`,
      tone: "text-amber-200",
    },
    { label: "Profit Factor", value: tradeStats.profitFactor === 999 ? "∞" : tradeStats.profitFactor.toFixed(2), tone: "text-violet-200" },
  ];

  const [showPricingMsg, setShowPricingMsg] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('global_settings').select('value').eq('id', 'maintenance_mode').maybeSingle();
      if (data) setMaintenanceMode(data.value);
    };
    fetchSettings();

    const channel = supabase.channel('global-settings-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings', filter: 'id=eq.maintenance_mode' }, (payload) => {
        setMaintenanceMode((payload.new as any)?.value || null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (maintenanceMode?.enabled && !isAdmin && !isDemoMode && user) {
      supabase.auth.signOut();
    }
  }, [maintenanceMode, isAdmin, isDemoMode, user, isLoading]);

  if (maintenanceMode?.enabled && !isAdmin && !isDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-100 p-4 transition-all duration-500 relative" style={rootBackground}>
        <div className="bg-noise" />
        <div className="max-w-md w-full rounded-3xl border p-8 text-center backdrop-blur-2xl shadow-2xl relative z-10" style={panelStyle}>
          <div className="mx-auto mb-6 flex justify-center">
            <img 
              src="/vitto-head.png" 
              alt="Logo" 
              className="h-20 w-auto object-contain drop-shadow-lg"
              onClick={(e) => {
                if (e.shiftKey) {
                  handleLogin();
                }
              }}
              style={{ cursor: 'default' }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Maintenance Mode</h1>
          <p className="text-slate-400 mb-8 whitespace-pre-wrap">{maintenanceMode.message || "brb"}</p>
        </div>
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-100 p-4 transition-all duration-500 relative" style={rootBackground}>
        <div className="max-w-md w-full rounded-3xl border p-8 text-center backdrop-blur-2xl shadow-2xl relative z-10" style={panelStyle}>
          <div className="mx-auto mb-6 flex justify-center">
            <img src="/vitto-head.png" alt="Logo" className="h-20 w-auto object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Trading Journal</h1>
          <p className="text-slate-400 mb-8">Sign in to access your dashboard, track your trades, and analyze your performance.</p>
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-semibold text-white transition-transform hover:-translate-y-0.5"
              style={accentButtonStyle}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <button
               type="button"
               onClick={() => setIsDemoMode(true)}
               className="w-full flex items-center justify-center gap-3 rounded-2xl border px-6 py-4 text-base font-semibold text-slate-300 transition-colors hover:bg-white/5"
               style={softPanelStyle}
            >
               Demo Mode
            </button>
            <div className="pt-4">
              <button
                onClick={() => setShowPricingMsg(true)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Pricing
              </button>
              {showPricingMsg && <p className="mt-2 text-sm text-emerald-400">Free for now!</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user && !isDemoMode && !isApproved && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-100 p-4 transition-all duration-500 relative" style={rootBackground}>
        <div className="bg-noise" />
        <div className="max-w-md w-full rounded-3xl border p-8 text-center backdrop-blur-2xl shadow-2xl relative z-10" style={panelStyle}>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Access Pending</h1>
          <p className="text-slate-400 mb-8">Your account is waiting for administrator approval. Please check back later.</p>
          <div className="space-y-3">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-semibold text-white transition-transform hover:-translate-y-0.5"
              style={accentButtonStyle}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen text-sm transition-all duration-500 sm:text-[15px] md:text-base ${themeId === 'white-on-black' ? 'theme-white-on-black' : ''}`} style={{ ...rootBackground, color: textColor }}>
      {!singleColor && (
        <div className="pointer-events-none fixed inset-0 opacity-65">
          <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full blur-3xl" style={{ background: hexToRgba(accentColor, 0.18) }} />
          <div className="absolute bottom-[-10rem] right-[-6rem] h-96 w-96 rounded-full blur-3xl" style={{ background: hexToRgba(gradientMid, 0.2) }} />
        </div>
      )}

      <header className={`sticky top-0 z-50 border-b px-4 py-4 sm:px-6 transition-all duration-300 ${hasScrolled ? "bg-white/5 backdrop-blur-2xl border-white/10" : "bg-white/5 backdrop-blur-sm border-transparent text-shadow-sm"}`}>
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-4 md:gap-6">
          <div className="flex flex-1 md:flex-none items-center gap-3 sm:gap-4 shrink-0 min-w-0">
            <img src="/vitto-head.png" alt="Logo" className="h-10 sm:h-12 md:h-16 w-auto object-contain drop-shadow-lg" />
            <div className="hidden sm:flex flex-col items-start min-w-0 mr-auto">
              <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold tracking-tight text-white truncate w-full">vittovittovitto</h1>
              <div className="text-[10px] sm:text-xs md:text-sm font-medium text-white/60 truncate w-full">
                {username ? `${username}'s journal` : 'My journal'}
              </div>
            </div>
          </div>

          <div className="relative shrink-0 flex items-center justify-end md:order-3" ref={profileMenuRef}>
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="focus:outline-none block">
              <img src={user?.user_metadata?.avatar_url || "/vitto-head.png"} alt="Profile" className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover border-2 border-white/10 hover:border-white/30 transition-colors" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#0f172a] shadow-xl overflow-hidden z-50">
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-400 hover:bg-white/5 transition-colors">
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </div>
            )}
          </div>

          <nav 
            className={`flex w-full md:w-auto md:order-2 md:flex-1 justify-start md:justify-center items-center gap-1 sm:gap-1.5 rounded-2xl md:rounded-3xl border border-white/10 p-1 sm:p-1.5 transition-all min-w-0 ${hasScrolled ? "backdrop-blur-xl" : ""}`} 
            style={hasScrolled ? { background: hexToRgba(panelTint, 0.45) } : { background: hexToRgba(panelTint, 0.25) }}
          >
            <div className="flex w-full justify-evenly items-center gap-1 md:gap-2 px-0.5 sm:px-1 py-0.5">
              {getNavItems(isAdmin).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id || (item.id === "lab" && (activeTab === "reports" || activeTab === "accounts")) || (item.id === "terminal" && activeTab === "communities");
                const showBadge = (item.id === "admin" && pendingUserCount > 0) || (item.id === "friends" && pendingRequestsCount > 0);
                
                if (item.id === "lab" || item.id === "terminal") {
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => {
                          setActiveTab(item.id);
                          setViewUserId(null);
                        }}
                        className={`relative inline-flex items-center justify-center shrink-0 gap-0 lg:gap-2 rounded-xl md:rounded-2xl px-2.5 sm:px-3 lg:px-4 py-2 text-[10px] sm:text-xs md:text-sm font-medium transition-all whitespace-nowrap min-w-0 flex-1 md:flex-none ${
                          active ? "text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                        style={active ? accentButtonStyle : undefined}
                        title={item.label}
                      >
                        <div className="relative">
                          <Icon className="h-4 w-4 sm:h-4 sm:w-4" />
                          {showBadge && (
                            <div className="absolute -top-2 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow-sm ring-2 ring-[#0f172a]">
                              {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                            </div>
                          )}
                        </div>
                        <span className="hidden lg:inline">{item.label}</span>
                      </button>
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-32 rounded-xl border border-white/10 p-1.5 shadow-xl backdrop-blur-3xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999]"
                        style={{ background: hexToRgba(panelTint, 0.98) }}
                      >
                        {item.id === "lab" ? (
                          <>
                            <button
                              onClick={() => setActiveTab("lab")}
                              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === "lab" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                            >
                              Lab
                            </button>
                            <button
                              onClick={() => setActiveTab("reports")}
                              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === "reports" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                            >
                              Reports
                            </button>
                            <button
                              onClick={() => setActiveTab("accounts")}
                              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === "accounts" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                            >
                              Accounts
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setActiveTab("terminal")}
                              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === "terminal" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                            >
                              Terminal
                            </button>
                            <button
                              onClick={() => setActiveTab("communities")}
                              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === "communities" ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                            >
                              Communities
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setViewUserId(null);
                    }}
                    className={`relative inline-flex items-center justify-center shrink-0 gap-0 lg:gap-2 rounded-xl md:rounded-2xl px-2.5 sm:px-3 lg:px-4 py-2 text-[10px] sm:text-xs md:text-sm font-medium transition-all whitespace-nowrap min-w-0 flex-1 md:flex-none ${
                      active ? "text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                    style={active ? accentButtonStyle : undefined}
                    title={item.label}
                  >
                    <div className="relative">
                      <Icon className="h-4 w-4 sm:h-4 sm:w-4" />
                      {showBadge && (
                        <div className="absolute -top-2 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow-sm ring-2 ring-[#0f172a]">
                          {item.id === "admin" ? (pendingUserCount > 9 ? '9+' : pendingUserCount) : (pendingRequestsCount > 9 ? '9+' : pendingRequestsCount)}
                        </div>
                      )}
                    </div>
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[92rem] px-4 py-6 sm:px-6 sm:py-8">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-4 xl:grid-cols-3">
              <div className="rounded-3xl border p-4 sm:p-6 backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-0.5 lg:col-span-3 xl:col-span-2 min-w-0" style={panelStyle}>
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white sm:text-2xl">
                      <span>{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })} Calendar P&L</span>
                    </h2>
                    <div className={`mt-1 text-lg font-bold sm:text-2xl ${monthTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedCurrency(monthTotal)}</div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 sm:p-2 text-slate-300 hover:text-white transition-colors"><ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" /></button>
                    <div className="text-center sm:text-right min-w-[4rem] sm:min-w-[6rem]">
                      <div className="text-lg font-bold text-white sm:text-2xl">{currentDate.toLocaleDateString("en-US", { month: "long" })}</div>
                      <div className="text-sm font-semibold text-slate-300 sm:text-lg">{currentDate.getFullYear()}</div>
                    </div>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 sm:p-2 text-slate-300 hover:text-white transition-colors"><ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" /></button>
                  </div>
                </div>

                <div className="mt-4 sm:mt-6 rounded-[20px] sm:rounded-[26px] border p-1.5 sm:p-2.5" style={softPanelStyle}>
                  <div className="grid grid-cols-7 gap-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                        <div key={`${day}-${index}`} className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
                        {day}
                      </div>
                    ))}
                    {monthCells.blanks.map((day, index) => {
                        const intensity = Math.min(Math.abs(day.pnl) / maxCalendarAbsPnl, 1);
                        const bg = day.pnl > 0 ? hexToRgba("#10b981", 0.08 + intensity * 0.15) : day.pnl < 0 ? hexToRgba("#f43f5e", 0.08 + intensity * 0.15) : "rgba(255,255,255,0.01)";
                        return (
                          <button
                            key={day.key}
                            onClick={() => setSelectedDayKey(day.key)}
                            className="group relative aspect-square rounded-xl border text-left flex flex-col items-end justify-between p-1.5 sm:p-2 transition duration-200 hover:-translate-y-0.5 opacity-60"
                            style={{ background: bg, borderColor: day.trades.length ? hexToRgba(accentColor, 0.1) : "transparent" }}
                          >
                            <div className="w-full flex justify-between items-start">
                              <span className="text-[9px] sm:text-xs font-semibold text-slate-400 group-hover:text-slate-200 leading-none">{day.date.getDate()}</span>
                            </div>
                            {day.trades.length > 0 && (
                              <div className="w-full flex flex-col items-end justify-end mt-auto">
                                <div className={`text-[10px] min-[380px]:text-xs sm:text-[14px] leading-tight font-bold tracking-tight truncate w-full text-right ${day.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  <span className="sm:hidden">{Math.abs(Math.round(day.pnl))}</span>
                                  <span className="hidden sm:inline">{day.pnl > 0 ? `+${Math.round(day.pnl)}` : Math.round(day.pnl)}</span>
                                </div>
                                <div className="text-[8px] sm:text-[10px] font-medium text-slate-400 mt-px">
                                  {day.trades.length} <span className="hidden sm:inline">{day.trades.length === 1 ? 'trade' : 'trades'}</span>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {monthCells.days.map((day) => {
                        const intensity = Math.min(Math.abs(day.pnl) / maxCalendarAbsPnl, 1);
                        const bg = day.pnl > 0 ? hexToRgba("#10b981", 0.12 + intensity * 0.22) : day.pnl < 0 ? hexToRgba("#f43f5e", 0.12 + intensity * 0.22) : "rgba(255,255,255,0.03)";
                        return (
                          <button
                            key={day.key}
                            onClick={() => setSelectedDayKey(day.key)}
                            className="group relative aspect-square rounded-xl border flex flex-col items-end justify-between p-1.5 sm:p-2 text-left transition duration-200 hover:-translate-y-0.5"
                            style={{ background: bg, borderColor: day.trades.length ? hexToRgba(accentColor, 0.18) : "transparent" }}
                          >
                            <div className="w-full flex justify-between items-start">
                              <span className="text-[9px] sm:text-xs font-semibold text-slate-100 group-hover:text-white leading-none">{day.date.getDate()}</span>
                            </div>
                            {day.trades.length > 0 && (() => {
                              const beTradesCount = day.trades.filter(t => getTradeStatus(getNetPnl(t), breakevenFloor, breakevenCeiling) === "breakeven").length;
                              return (
                                <div className="w-full flex items-end justify-between mt-auto">
                                  <div className="flex-1">
                                    {beTradesCount > 0 && <span className="text-[9px] sm:text-[10px] font-bold text-amber-500/90 leading-none">{beTradesCount}</span>}
                                  </div>
                                  <div className="flex flex-col items-end justify-end">
                                    <div className={`text-[10px] min-[380px]:text-xs sm:text-[14px] leading-tight font-bold tracking-tight truncate w-full text-right ${day.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                      <span className="sm:hidden">{Math.abs(Math.round(day.pnl))}</span>
                                      <span className="hidden sm:inline">{day.pnl > 0 ? `+${Math.round(day.pnl)}` : Math.round(day.pnl)}</span>
                                    </div>
                                    <div className="text-[8px] sm:text-[10px] font-medium text-slate-300 mt-px">
                                      {day.trades.length} <span className="hidden sm:inline">{day.trades.length === 1 ? 'trade' : 'trades'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-2 lg:grid-cols-1 lg:col-span-1 xl:col-span-1 gap-2 sm:gap-3 min-w-0">
                <div className="col-span-1 rounded-2xl border p-3 sm:p-4 backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-0.5" style={panelStyle}>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-slate-400">Best day</div>
                  <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-emerald-300">{monthBestDay ? formatSignedCurrency(monthBestDay.pnl) : formatCurrency(0)}</div>
                </div>
                <div className="col-span-1 rounded-2xl border p-3 sm:p-4 backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-0.5" style={panelStyle}>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-slate-400">Worst day</div>
                  <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-rose-300">{monthWorstDay ? formatSignedCurrency(monthWorstDay.pnl) : formatCurrency(0)}</div>
                </div>
                {metrics.map((card) => (
                  <div key={card.label} className="col-span-1 border p-3 sm:p-4 backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-0.5 rounded-2xl" style={panelStyle}>
                    <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-slate-400 truncate w-full">{card.label}</div>
                    <div className={`mt-1 sm:mt-2 text-sm sm:text-lg font-semibold truncate w-full ${card.tone}`}>{card.value}</div>
                  </div>
                ))}
                <div className="col-span-2 lg:col-span-1 rounded-2xl border p-3 sm:p-4 backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl" style={panelStyle}>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-slate-400">Average Win / Loss</div>
                  <div className="mt-1 sm:mt-2 flex items-center justify-between text-[11px] sm:text-xs text-slate-300">
                    <span className="text-emerald-300">Win {formatSignedCurrency(avgWinLoss.avgWin)}</span>
                    <span className="text-rose-300">Loss {formatSignedCurrency(avgWinLoss.avgLoss)}</span>
                  </div>
                  <div className="mt-2 sm:mt-3 flex h-2 sm:h-3 overflow-hidden rounded-full bg-white/10 relative">
                    <div className="h-full bg-emerald-400/85 transition-all duration-500" style={{ width: `${Math.max(avgWinLoss.winPct, 4)}%`, clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 100%, 0 100%)' }} />
                    <div className="h-full bg-rose-400/85 transition-all duration-500" style={{ width: `${Math.max(avgWinLoss.lossPct, 4)}%`, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 6px 100%)' }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Recent Trades</h3>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Past 10</span>
                </div>
                <div className="mt-5 space-y-3">
                  {recentTrades.map((trade) => {
                    const status = getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling);
                    const tone = getStatusTone(status);
                    const directionLabel = trade.direction === "short" ? "SHORT" : "LONG";
                    return (
                      <button
                        key={tradeKey(trade)}
                        onClick={() => {
                          openTradeModal(tradeKey(trade), false);
                        }}
                        className="w-full rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-white/25"
                        style={softPanelStyle}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{trade.symbol}</span>
                              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">{directionLabel}</span>
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.pill}`}>{status}</span>
                              {getTradingSession(trade.boughtTimestamp) && (
                                <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getSessionTagStyle(getTradingSession(trade.boughtTimestamp)!)}`}>
                                  {getTradingSession(trade.boughtTimestamp)}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">Qty {trade.qty}</div>
                            <div className={`mt-3 text-lg font-semibold ${tone.text}`}>{formatSignedCurrency(getNetPnl(trade))}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-slate-300">
                              {new Date(trade.soldTimestamp).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {new Date(trade.soldTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="rounded-3xl border p-6 backdrop-blur-2xl flex-1 flex flex-col" style={panelStyle}>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xl font-semibold text-white">P&L by Symbol</h3>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Trade %</div>
                  </div>
                  <div className="mt-5 space-y-3 overflow-y-auto max-h-[220px] pr-2">
                    {symbolTradeShare.map((item) => (
                      <div key={item.symbol} className="rounded-2xl border p-3 transition duration-200 hover:-translate-y-0.5" style={softPanelStyle}>
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${item.pnl >= 0 ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]"}`} />
                            <span className="font-semibold text-white">{item.symbol}</span>
                            <span className={`font-bold ${item.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{item.pnl >= 0 ? "+" : ""}{formatSignedCurrency(item.pnl)}</span>
                          </div>
                          <span className="text-slate-300">{item.tradeCount} trades • {item.tradePct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(item.tradePct, 4)}%`,
                              background: item.pnl >= 0 ? `linear-gradient(90deg, ${hexToRgba("#10b981", 0.85)}, ${hexToRgba(accentColor, 0.9)})` : `linear-gradient(90deg, ${hexToRgba("#fb7185", 0.85)}, ${hexToRgba("#f43f5e", 0.9)})`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                  <h3 className="text-xl font-semibold text-white mb-4">PNL by Symbol (Chart)</h3>
                  <div className="h-40 w-full mb-2">
                    {(() => {
                      const symbolMap = new Map<string, number>();
                      trades.forEach(trade => {
                        symbolMap.set(trade.symbol, (symbolMap.get(trade.symbol) || 0) + getNetPnl(trade));
                      });
                      const data = Array.from(symbolMap.entries())
                        .map(([symbol, pnl]) => ({ symbol, pnl }))
                        .sort((a, b) => b.pnl - a.pnl);

                      if (!data.length) return <div className="text-sm text-slate-400">No trades available.</div>;

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="symbol" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={40} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                            <RechartsTooltip
                              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const val = payload[0].value as number;
                                  return (
                                    <div className="rounded-xl border border-white/10 p-3 shadow-xl backdrop-blur-xl" style={{ background: hexToRgba(panelTint, 0.95) }}>
                                      <div className="text-xs font-semibold text-slate-400">{payload[0].payload.symbol}</div>
                                      <div className={`text-sm font-bold ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {formatSignedCurrency(val)}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
                              {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-400" />
                      Monthly Leaderboard
                    </h3>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {leaderboard.slice(0, 5).map((entry, idx) => (
                      <div 
                        key={entry.id} 
                        onClick={() => {
                          setActiveTab("friends");
                          setViewUserId(entry.id);
                        }}
                        className="flex items-center justify-between p-3 rounded-2xl border cursor-pointer hover:bg-white/5 transition-all duration-300 hover:scale-[1.02]" 
                        style={softPanelStyle}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${idx === 0 ? 'bg-amber-500/20 text-amber-400' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : idx === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-white/5 text-white/50'}`}>
                            {idx + 1}
                          </div>
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white uppercase">
                              {entry.name[0]}
                            </div>
                          )}
                          <span className="font-medium text-white">{entry.name}</span>
                        </div>
                        <span className={`font-bold ${entry.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatSignedCurrency(entry.pnl)}
                        </span>
                      </div>
                    ))}
                    {leaderboard.length === 0 && <div className="text-slate-400 text-sm text-center py-4">No data for this month.</div>}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-6">
                <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">Calendar P&L</h2>
                      <div className={`mt-1 text-xl font-semibold ${monthTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>Month Total: {formatSignedCurrency(monthTotal)}</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border p-2" style={softPanelStyle}>
                      <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="group rounded-xl p-2 transition-all duration-300 hover:bg-white/10">
                        <ChevronLeft className="h-6 w-6 transition-all duration-300 group-hover:-translate-x-1 group-hover:scale-125 group-hover:text-slate-300" />
                      </button>
                      <div className="min-w-44 text-center text-lg font-semibold text-white">
                        {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </div>
                      <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="group rounded-xl p-2 transition-all duration-300 hover:bg-white/10">
                        <ChevronRight className="h-6 w-6 transition-all duration-300 group-hover:translate-x-1 group-hover:scale-125 group-hover:text-slate-300" />
                      </button>
                    </div>
                  </div>
                </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
              <div className="rounded-3xl border p-2 sm:p-3 backdrop-blur-2xl" style={panelStyle}>
                <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                    <div key={label} className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <span className="hidden sm:inline">{label}</span>
                      <span className="sm:hidden">{label.slice(0, 1)}</span>
                    </div>
                  ))}

                  {calendarWeeks.flatMap((week, weekIndex) =>
                    week.days.map((day, dayIndex) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${weekIndex}-${dayIndex}`}
                            className="rounded-2xl bg-transparent aspect-square h-auto w-full"
                          />
                        );
                      }
                      
                      if (day.isOutOfMonth) {
                        return (
                          <div
                            key={day.key}
                            className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-transparent p-1 sm:p-2 backdrop-blur-sm aspect-square h-auto w-full"
                          >
                            <span className="text-[10px] sm:text-xs font-medium text-slate-500">{day.date.getDate()}</span>
                            {day.trades.length > 0 && (
                              <div className="mt-1 flex flex-col items-center">
                                <span className={`text-[10px] sm:text-xs font-semibold ${day.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  <span className="sm:hidden">{Math.abs(Math.round(day.pnl))}</span>
                                  <span className="hidden sm:inline">{formatSignedCurrency(day.pnl)}</span>
                                </span>
                                <span className="hidden sm:block text-[10px] text-slate-500">{day.trades.length} {day.trades.length === 1 ? 'trade' : 'trades'}</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      const intensity = Math.min(Math.abs(day.pnl) / maxCalendarAbsPnl, 1);
                      const dayBackground =
                        day.pnl > 0
                          ? hexToRgba("#10b981", 0.12 + intensity * 0.24)
                          : day.pnl < 0
                          ? hexToRgba("#f43f5e", 0.12 + intensity * 0.24)
                          : hexToRgba(panelTint, 0.26);

                      const beTradesCount = day.trades.filter(t => getTradeStatus(getNetPnl(t), breakevenFloor, breakevenCeiling) === "breakeven").length;
                      const isHighlighted = highlightedDayKey === day.key;

                      return (
                        <button
                          key={day.key}
                          onClick={() => setSelectedDayKey(day.key)}
                          className={`group relative flex flex-col justify-between rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 text-left transition duration-200 aspect-square overflow-hidden ${isHighlighted ? "ring-2 ring-white scale-[1.03] z-10" : "hover:-translate-y-0.5"}`}
                          style={{
                            height: `auto`,
                            width: `100%`,
                            background: dayBackground,
                            borderColor: isHighlighted ? '#ffffff' : (day.trades.length ? hexToRgba(accentColor, 0.18) : hexToRgba("#ffffff", 0.08)),
                          }}
                        >
                          <div className="w-full flex justify-between items-start">
                            <div className="text-[10px] sm:text-xs md:text-sm font-semibold text-white leading-none">{day.date.getDate()}</div>
                          </div>
                          <div className="w-full flex flex-col mt-auto justify-end pt-1">
                            {day.trades.length > 0 ? (
                              <>
                                <div className={`text-[10px] min-[380px]:text-xs sm:text-base md:text-lg font-bold tracking-tight truncate w-full text-left ${day.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                  <span className="sm:hidden">{Math.abs(Math.round(day.pnl))}</span>
                                  <span className="hidden sm:inline">{day.pnl > 0 ? `+${formatCurrency(day.pnl)}` : formatSignedCurrency(day.pnl)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] md:text-xs text-slate-300 truncate w-full mt-0.5">
                                  <span>{day.trades.length} <span className="hidden sm:inline">{day.trades.length === 1 ? 'trade' : 'trades'}</span></span>
                                  {beTradesCount > 0 && <span className="text-amber-500/90 font-medium">{beTradesCount}</span>}
                                </div>
                              </>
                            ) : (
                              <div className="text-[10px] min-[380px]:text-xs sm:text-base md:text-lg font-bold text-slate-500">-</div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2.5">
                <div className="h-0 sm:h-6 hidden sm:block" />
                {calendarWeeks.map((week, weekIndex) => (
                  <div key={`week-total-${weekIndex}`} className="rounded-xl sm:rounded-2xl border p-2 sm:p-3 flex items-center justify-between sm:block" style={{ ...panelStyle, height: `auto`, minHeight: 'unset' }}>
                    <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Week {weekIndex + 1}</div>
                    <div className={`sm:mt-2 text-xs sm:text-base font-semibold ${week.total >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedCurrency(week.total)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-6">
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1 cursor-pointer" style={panelStyle}
                onMouseEnter={() => biggestWin ? setHighlightedDayKey(toDayKey(biggestWin.boughtTimestamp)) : null}
                onMouseLeave={() => setHighlightedDayKey(null)}
                onClick={() => {
                  if (biggestWin) {
                    openTradeModal(tradeKey(biggestWin), false);
                  }
                }}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Biggest Win</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-emerald-300">{biggestWin ? formatSignedCurrency(biggestWin.pnl) : formatCurrency(0)}</div>
              </div>
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1 cursor-pointer" style={panelStyle}
                onMouseEnter={() => biggestLoss ? setHighlightedDayKey(toDayKey(biggestLoss.boughtTimestamp)) : null}
                onMouseLeave={() => setHighlightedDayKey(null)}
                onClick={() => {
                  if (biggestLoss) {
                    openTradeModal(tradeKey(biggestLoss), false);
                  }
                }}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Biggest Loss</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-rose-300">{biggestLoss ? formatSignedCurrency(biggestLoss.pnl) : formatCurrency(0)}</div>
              </div>
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1 cursor-pointer" style={panelStyle}
                onMouseEnter={() => monthBestDay ? setHighlightedDayKey(monthBestDay.key) : null}
                onMouseLeave={() => setHighlightedDayKey(null)}
                onClick={() => {
                  if (monthBestDay) {
                    setSelectedDayKey(monthBestDay.key);
                  }
                }}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Biggest Day</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-emerald-300">{monthBestDay ? formatSignedCurrency(monthBestDay.pnl) : formatCurrency(0)}</div>
              </div>
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1 cursor-pointer" style={panelStyle}
                onMouseEnter={() => monthWorstDay ? setHighlightedDayKey(monthWorstDay.key) : null}
                onMouseLeave={() => setHighlightedDayKey(null)}
                onClick={() => {
                  if (monthWorstDay) {
                    setSelectedDayKey(monthWorstDay.key);
                  }
                }}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Biggest Loss Day</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-rose-300">{monthWorstDay ? formatSignedCurrency(monthWorstDay.pnl) : formatCurrency(0)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mt-2 sm:mt-4">
                <div className="rounded-2xl border p-3 sm:p-4" style={panelStyle}>
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Month Total</div>
                  <div className={`mt-1 sm:mt-2 text-sm sm:text-base font-semibold ${monthTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedCurrency(monthTotal)}</div>
                </div>
                <div className="rounded-2xl border p-3 sm:p-4" style={panelStyle}>
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Year Total</div>
                  <div className={`mt-1 sm:mt-2 text-sm sm:text-base font-semibold ${yearTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedCurrency(yearTotal)}</div>
                </div>
                  <div className="rounded-2xl border p-3 sm:p-4 col-span-2 lg:col-span-1" style={panelStyle}>
                    <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Weekly Average</div>
                    <div className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-slate-200">
                      {formatSignedCurrency(calendarWeeks.length ? calendarWeeks.reduce((sum, week) => sum + week.total, 0) / calendarWeeks.length : 0)}
                    </div>
                  </div>
              </div>
          </div>
        )}

        {activeTab === "tradeJournal" && (
          <TradeJournal
            trades={trades}
            breakevenFloor={breakevenFloor}
            breakevenCeiling={breakevenCeiling}
            panelStyle={panelStyle}
            softPanelStyle={softPanelStyle}
            panelTint={panelTint}
            getTradingSession={getTradingSession}
            getSessionTagStyle={getSessionTagStyle}
            onDayClick={(dayKey) => setSelectedDayKey(dayKey)}
            onEditTrade={(key, isEdit) => openTradeModal(key, isEdit)}
          />
        )}

        {activeTab === "reports" && (
          <Reports
            trades={trades}
            breakevenFloor={breakevenFloor}
            breakevenCeiling={breakevenCeiling}
            panelStyle={panelStyle}
            softPanelStyle={softPanelStyle}
            panelTint={panelTint}
          />
        )}

        {activeTab === "lab" && (
          <TheLab
            trades={trades}
            breakevenFloor={breakevenFloor}
            breakevenCeiling={breakevenCeiling}
            panelStyle={panelStyle}
            softPanelStyle={softPanelStyle}
            panelTint={panelTint}
            labState={labState}
            setLabState={setLabState}
          />
        )}

        {activeTab === "accounts" && (
          <AccountsLab 
            trades={trades}
            accountsLibrary={accountsLibrary}
            setAccountsLibrary={setAccountsLibrary}
            panelStyle={panelStyle}
            softPanelStyle={softPanelStyle}
            panelTint={panelTint}
            accentColor={accentColor}
            onEditTrade={(id) => openTradeModal(id, false)}
          />
        )}

        {activeTab === "trades" && (
          <div className="space-y-6">
            <form onSubmit={handleManualTradeSubmit} className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <h2 className="text-xl font-semibold text-white">Manual Trade Entry</h2>
                  <button type="button" onClick={() => setShowCsvImport(!showCsvImport)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors underline underline-offset-2">Import CSV</button>
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl border px-4 py-2 text-xs text-slate-300 relative group" style={softPanelStyle}>
                  Breakeven range: {formatSignedCurrency(breakevenFloor)} to {formatSignedCurrency(breakevenCeiling)}
                  <Info className="h-3 w-3 text-slate-500 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 hidden w-48 rounded-xl border border-white/10 p-2 text-xs text-slate-300 shadow-2xl group-hover:block z-50 backdrop-blur-xl" style={{ backgroundColor: hexToRgba(panelTint, 0.95) }}>
                    Editable in Settings
                  </div>
                </div>
              </div>

              {showCsvImport && (
                <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                  <h3 className="text-lg font-semibold text-white">CSV Import</h3>
                  <textarea
                    value={csvText}
                    onChange={(event) => setCsvText(event.target.value)}
                    rows={6}
                    placeholder="Paste CSV content"
                    className="w-full rounded-2xl border p-4 font-mono text-sm outline-none"
                    style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }}
                  />
                  <div>
                    <label className="text-sm text-slate-300 block mb-2 font-medium">Tag Imported Trades To Account (Optional)</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      {accountsLibrary.map(acc => (
                         <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                               const selectedIds = importAccountId.split(',').filter(Boolean);
                               const isSelected = selectedIds.includes(acc.id);
                               const newIds = isSelected 
                                 ? selectedIds.filter(id => id !== acc.id) 
                                 : [...selectedIds, acc.id];
                               setImportAccountId(newIds.join(','));
                            }}
                            className={`rounded-xl border px-3 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                               importAccountId.split(',').filter(Boolean).includes(acc.id)
                               ? 'border-white/40 bg-white/10 text-white' 
                               : 'border-transparent bg-transparent text-slate-400 hover:text-white'
                            }`}
                            title={acc.name}
                         >
                           {acc.firmName} - {acc.name}
                         </button>
                      ))}
                      {accountsLibrary.length === 0 && (
                         <span className="text-xs text-slate-500 italic">No accounts created.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <input id="csv-upload" type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} />
                    <label htmlFor="csv-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      <Upload className="h-4 w-4" /> Select CSV(s)
                    </label>
                    <button type="button" onClick={() => handleCSVImport(csvText)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0" style={accentButtonStyle}>
                      <CheckCircle2 className="h-4 w-4" /> Validate & Import
                    </button>
                    <button type="button" disabled={!isAdmin} onClick={exportAllTrades} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-opacity ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'}`} style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      <Download className="h-4 w-4" /> Export All
                    </button>
                  </div>

                  {importStatus.message && (
                    <div className={`rounded-xl border p-3 text-sm ${importStatus.type === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-rose-500/25 bg-rose-500/10 text-rose-200"}`}>
                      {importStatus.message}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 sm:mt-5 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Symbol", key: "symbol", placeholder: "NQM6" },
                  { label: "Qty", key: "qty", placeholder: "1" },
                  { label: "Start Price", key: manualTrade.direction === "short" ? "sellPrice" : "buyPrice", placeholder: "25014.25" },
                  { label: "End Price", key: manualTrade.direction === "short" ? "buyPrice" : "sellPrice", placeholder: "25001.25" },
                  { label: "P&L", key: "pnl", placeholder: "-260" },
                  { label: "Commission", key: "commission", placeholder: "optional, e.g. 4.04" },
                  { label: "Max Points Profit (MFE)", key: "maxPointsProfit", placeholder: "optional, e.g. 15.5", tooltip: "Maximum Favorable Excursion calculates the average maximum points of profit recorded per trade" },
                  { label: "Tick Size", key: "_tickSize", placeholder: "0.25" },
                ].map((field) => (
                  <label key={field.key} className="relative">
                    <div className="text-sm text-slate-300 flex items-center gap-1.5">
                      {field.label}
                      {field.tooltip && (
                        <div className="group relative flex items-center">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute top-6 left-0 hidden w-64 rounded-xl border border-white/10 p-2 text-[10px] text-slate-300 shadow-2xl group-hover:block z-[9999] normal-case backdrop-blur-xl pointer-events-none" style={{ backgroundColor: hexToRgba(panelTint, 0.95) }}>
                            {field.tooltip}
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={manualTrade[field.key as keyof ManualTradeForm] as string}
                      onChange={(event) => setManualTrade((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none"
                      style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }}
                    />
                  </label>
                ))}

                <div className="flex flex-col justify-start">
                  <span className="text-sm text-slate-300">Direction</span>
                  <div 
                    className="mt-2 relative flex min-h-[46px] w-full cursor-pointer items-center rounded-2xl border p-1"
                    style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }}
                    onClick={() => setManualTrade(prev => ({ ...prev, direction: prev.direction === 'long' ? 'short' : 'long', buyPrice: prev.sellPrice, sellPrice: prev.buyPrice }))}
                  >
                    <div 
                      className="absolute inset-y-1 rounded-xl transition-all duration-300 ease-out"
                      style={{
                        background: manualTrade.direction === 'long' ? '#10b981' : '#ef4444',
                        width: 'calc(50% - 4px)',
                        left: manualTrade.direction === 'long' ? '4px' : 'calc(50%)'
                      }}
                    />
                    <div className="relative z-10 flex w-1/2 items-center justify-center text-sm font-medium text-white transition-colors">
                      Long
                    </div>
                    <div className="relative z-10 flex w-1/2 items-center justify-center text-sm font-medium text-white transition-colors">
                      Short
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <span className="text-sm font-semibold text-white">Accounts</span>
                  <div className="mt-3 flex flex-col gap-3">
                    {(() => {
                      const selectedIds = (manualTrade.accountId || "").split(',').filter(Boolean);
                      return (accountsLibrary || []).map((group: any, idx: number) => {
                        const groupAccs = group.accounts || [];
                        if (groupAccs.length === 0) return null;
                        const groupIds = groupAccs.map((a: any) => a.id);
                        const allSelectedInGroup = groupIds.length > 0 && groupIds.every((id: string) => selectedIds.includes(id));
                        return (
                          <div key={group.id || `group-manual-${idx}`} className="flex flex-col gap-1 items-start">
                            <span 
                              className="text-xs font-semibold text-slate-400 capitalize cursor-pointer hover:text-white transition-colors select-none"
                              title="Shift-click to select all accounts in this broker"
                              onClick={(e) => {
                                if (e.shiftKey) {
                                  let newIds = [...selectedIds];
                                  if (allSelectedInGroup) {
                                    newIds = newIds.filter(id => !groupIds.includes(id));
                                  } else {
                                    const toAdd = groupIds.filter((id: string) => !newIds.includes(id));
                                    newIds.push(...toAdd);
                                  }
                                  setManualTrade(prev => ({ ...prev, accountId: newIds.join(',') }));
                                }
                              }}
                            >
                              {group.firmName || group.size || "Unknown Firm"}
                            </span>
                            <div className="flex flex-wrap gap-2 mt-0.5">
                              {groupAccs.map((acc: any) => {
                                const selected = selectedIds.includes(acc.id);
                                return (
                                  <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => {
                                      const newSelection = selected 
                                        ? selectedIds.filter(id => id !== acc.id)
                                        : [...selectedIds, acc.id];
                                      setManualTrade(prev => ({ ...prev, accountId: newSelection.join(',') }));
                                    }}
                                    className={`rounded-xl border px-3 py-1.5 text-xs transition-all duration-300 hover:scale-[1.05] ${selected ? "font-medium" : "text-slate-400 hover:text-white"}`}
                                    style={selected ? { background: accentColor, color: getContrastColor(accentColor), borderColor: "transparent" } : { background: hexToRgba(panelTint, 0.35), borderColor: "rgba(255,255,255,0.1)" }}
                                  >
                                    {acc.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    })()}
                  </div>
                </div>

                <label>
                  <span className="text-sm text-slate-300">Duration</span>
                  <input
                    type="text"
                    value={manualTrade.duration}
                    onChange={(event) => setManualTrade((prev) => ({ ...prev, duration: event.target.value }))}
                    placeholder="8min 24sec"
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none"
                    style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }}
                  />
                </label>

                <label className="xl:col-span-2 relative">
                  <span className="text-sm text-slate-300">Bought Timestamp</span>
                  <CustomDateTimePicker
                    value={manualTrade.boughtTimestamp}
                    onChange={(val: string) => setManualTrade((prev) => ({ ...prev, boughtTimestamp: val }))}
                    panelTint={panelTint}
                    accentColor={accentColor}
                    className="mt-2 w-full"
                    placement="top"
                  />
                </label>

                <label className="xl:col-span-2 relative">
                  <span className="text-sm text-slate-300">Sold Timestamp</span>
                  <CustomDateTimePicker
                    value={manualTrade.soldTimestamp}
                    onChange={(val: string) => setManualTrade((prev) => ({ ...prev, soldTimestamp: val }))}
                    panelTint={panelTint}
                    accentColor={accentColor}
                    className="mt-2 w-full"
                    placement="top"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-slate-300">Auto P&L: <span className={manualAutoPnl >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatSignedCurrency(manualAutoPnl)}</span></span>
                <button
                  type="button"
                  onClick={() => setManualTrade((prev) => ({ ...prev, pnl: manualAutoPnl.toFixed(2) }))}
                  className="rounded-xl border px-3 py-1.5 transition-colors hover:bg-white/10"
                  style={softPanelStyle}
                >
                  Fill Auto P&L
                </button>
                <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                  <div
                    className={`relative w-8 h-4 rounded-full cursor-pointer transition-colors ${autoFillPnl ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    onClick={() => setAutoFillPnl(!autoFillPnl)}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${autoFillPnl ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-slate-300 cursor-pointer" onClick={() => setAutoFillPnl(!autoFillPnl)}>Auto-fill</span>
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {[{ kind: "entry" as TagKind, title: "Entry Tags", library: entryLibrary }, { kind: "confluence" as TagKind, title: "Confluence Tags", library: confluenceLibrary }, { kind: "mistake" as TagKind, title: "Mistake Tags", library: mistakeLibrary }].map((group) => (
                  <div key={group.kind} className="rounded-2xl border p-4" style={softPanelStyle}>
                    <div className="font-semibold text-white">{group.title}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.library.map((tag) => {
                        const selected = group.kind === "entry" ? manualTrade.entryTags.includes(tag) : group.kind === "confluence" ? manualTrade.confluenceTags.includes(tag) : manualTrade.mistakeTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setManualTrade((prev) => ({
                                ...prev,
                                entryTags:
                                  group.kind === "entry"
                                    ? selected
                                      ? prev.entryTags.filter((item) => item !== tag)
                                      : [...prev.entryTags, tag]
                                    : prev.entryTags,
                                confluenceTags:
                                  group.kind === "confluence"
                                    ? selected
                                      ? prev.confluenceTags.filter((item) => item !== tag)
                                      : [...prev.confluenceTags, tag]
                                    : prev.confluenceTags,
                                mistakeTags:
                                  group.kind === "mistake"
                                    ? selected
                                      ? prev.mistakeTags.filter((item) => item !== tag)
                                      : [...prev.mistakeTags, tag]
                                    : prev.mistakeTags,
                              }))
                            }
                            className={`tag-chip rounded-full border px-3 py-1.5 text-xs transition ${selected ? "border-white/35 font-medium" : "border-white/10 bg-white/5 text-slate-300"}`}
                            style={selected ? { background: hexToRgba(accentColor, 0.2), color: getContrastColor(accentColor), borderColor: hexToRgba(accentColor, 0.5) } : undefined}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button 
                  type="submit" 
                  disabled={isSavingTrade}
                  className="relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white overflow-hidden min-w-[140px]" 
                  style={accentButtonStyle}
                >
                  <div className={`flex items-center gap-2 transition-transform duration-300 ${tradeSaved ? '-translate-y-10' : 'translate-y-0'}`}>
                    <Plus className="h-4 w-4" /> Save Trade
                  </div>
                  <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${tradeSaved ? 'translate-y-0' : 'translate-y-10'}`}>
                    <Check className="h-5 w-5" />
                  </div>
                </button>
                <button type="button" onClick={() => setManualTrade(createManualTradeForm(manualTrade.symbol, tradeTimezone))} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm min-w-[140px]" style={softPanelStyle}>
                  <RefreshCcw className="h-4 w-4" /> Reset Form
                </button>
              </div>
            </form>

            <div className="rounded-3xl border p-3 sm:p-4 backdrop-blur-2xl flex flex-col relative z-50" style={panelStyle}>
              <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
                <div className="flex min-w-[200px] sm:min-w-[260px] flex-1 items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border px-3 sm:px-4 py-2.5 sm:py-3" style={softPanelStyle}>
                  <Filter className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Filter symbol, id..."
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <div className="relative w-full sm:w-auto" ref={dateRangeContainerRef}>
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 rounded-xl sm:rounded-2xl border px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white transition-colors hover:bg-white/5"
                      style={softPanelStyle}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="truncate max-w-[150px] sm:max-w-none">
                          {dateRangeStart && dateRangeEnd
                            ? `${dateRangeStart} to ${dateRangeEnd}`
                            : dateRangeStart
                            ? `From ${dateRangeStart}`
                            : dateRangeEnd
                            ? `Until ${dateRangeEnd}`
                            : "Filter by Date"}
                        </span>
                      </div>
                    </button>
                    {showDatePicker && (
                        <div className="absolute left-0 sm:right-0 top-full z-50 mt-2 w-[calc(100vw-48px)] sm:w-72 max-w-sm rounded-2xl border border-white/10 p-4 shadow-xl backdrop-blur-xl" style={{ background: hexToRgba(panelTint, 0.95) }}>
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white">Date Range</h4>
                            <button onClick={() => { setDateRangeStart(""); setDateRangeEnd(""); }} className="text-xs text-slate-400 hover:text-white">Clear</button>
                          </div>
                          <div className="space-y-3">
                            <label className="block">
                              <span className="mb-1 block text-xs text-slate-400">Start Date</span>
                              <input
                                type="date"
                                value={dateRangeStart}
                                onChange={(event) => setDateRangeStart(event.target.value)}
                                className="w-full rounded-xl border bg-black/20 px-3 py-2 text-sm text-white outline-none"
                                style={{ borderColor: hexToRgba(accentColor, 0.16), colorScheme: "dark" }}
                              />
                            </label>
                            <label className="block relative z-50">
                              <span className="mb-1 block text-xs text-slate-400">End Date</span>
                              <input
                                type="date"
                                value={dateRangeEnd}
                                onChange={(event) => setDateRangeEnd(event.target.value)}
                                className="w-full rounded-xl border bg-black/20 px-3 py-2 text-sm text-white outline-none relative z-50"
                                style={{ borderColor: hexToRgba(accentColor, 0.16), colorScheme: "dark" }}
                              />
                            </label>
                          </div>
                        </div>
                    )}
                  </div>
                  <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                    <CustomSelect
                      value={String(tradesLogLimit)}
                      onChange={(val: string) => {
                        setTradesLogLimit(Number(val));
                        if (typeof window !== 'undefined') window.localStorage.setItem('journal-trades-log-limit', val);
                      }}
                      panelTint={panelTint}
                      accentColor={accentColor}
                      options={[
                        { value: "10", label: "10 Trades" },
                        { value: "25", label: "25 Trades" },
                        { value: "50", label: "50 Trades" },
                        { value: "100", label: "100 Trades" },
                        { value: "500", label: "500 Trades" }
                      ]}
                      className="min-w-[120px]"
                      buttonClassName="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3"
                    />

                    <CustomSelect
                      value={sortBy}
                      onChange={(val: string) => setSortBy(val as SortBy)}
                      panelTint={panelTint}
                      accentColor={accentColor}
                      options={[
                        { value: "soldTimestamp", label: "Exit Date" },
                        { value: "pnl", label: "P&L" },
                        { value: "symbol", label: "Symbol" }
                      ]}
                      className="min-w-[120px]"
                      buttonClassName="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3"
                    />
                    <button onClick={() => setSortOrder((current) => (current === "asc" ? "desc" : "asc"))} className="flex-1 sm:flex-none rounded-xl sm:rounded-2xl border px-3 sm:px-4 py-2.5 sm:py-3 text-sm whitespace-nowrap outline-none flex items-center justify-center transition-colors" style={softPanelStyle}>
                      {sortOrder === "asc" ? "Ascending ↑" : "Descending ↓"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border backdrop-blur-2xl" style={panelStyle}>
              <div className="overflow-x-auto rounded-3xl custom-scrollbar">
                <table className="min-w-[800px] sm:min-w-full text-left">
                  <thead className="border-b border-white/10 bg-black/10 text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">Trade</th>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">Exit</th>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">Tags</th>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">Entry / Exit</th>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">Qty</th>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">P&L</th>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">Duration</th>
                      <th className="px-3 sm:px-5 py-3 sm:py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.slice(0, tradesLogLimit).map((trade) => {
                      const netPnl = getNetPnl(trade);
                      const status = getTradeStatus(netPnl, breakevenFloor, breakevenCeiling);
                      const tone = getStatusTone(status);
                      const sortedEntry = [...(trade.entryTags ?? [])].sort((a, b) => { const idxA = entryLibrary.indexOf(a); const idxB = entryLibrary.indexOf(b); return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB); });
                      const sortedConfluence = [...(trade.confluenceTags ?? [])].sort((a, b) => { const idxA = confluenceLibrary.indexOf(a); const idxB = confluenceLibrary.indexOf(b); return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB); });
                      const sortedMistake = [...(trade.mistakeTags ?? [])].sort((a, b) => { const idxA = mistakeLibrary.indexOf(a); const idxB = mistakeLibrary.indexOf(b); return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB); });
                      const tags = [...sortedEntry, ...sortedConfluence, ...sortedMistake];
                      return (
                        <tr key={tradeKey(trade)} className="border-b border-white/10 text-xs sm:text-sm text-slate-200 transition hover:bg-white/[0.03]">
                          <td className="px-3 sm:px-5 py-3 sm:py-4 align-top">
                            <div className="font-semibold text-white text-sm sm:text-base">{trade.symbol}</div>
                            <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-[10px] uppercase tracking-[0.16em] text-slate-200">{trade.direction}</span>
                              <span className={`rounded-full border px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-[10px] uppercase tracking-[0.16em] ${tone.pill}`}>{status}</span>
                              {getTradingSession(trade.boughtTimestamp) && (
                                <span className={`rounded-full border px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-[10px] uppercase tracking-[0.16em] ${getSessionTagStyle(getTradingSession(trade.boughtTimestamp)!)}`}>
                                  {getTradingSession(trade.boughtTimestamp)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-3 sm:py-4 align-top text-[10px] sm:text-xs text-slate-300">{new Date(trade.soldTimestamp).toLocaleString()}</td>
                          <td className="px-3 sm:px-5 py-3 sm:py-4 align-top">
                            <div className="flex max-w-[12rem] sm:max-w-xs flex-wrap gap-1.5 sm:gap-2">
                              {tags.length === 0 ? <span className="text-[10px] sm:text-xs text-slate-500">No tags</span> : tags.slice(0, 3).map((tag) => <span key={tag} className={`tag-chip rounded-full border px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-[10px] ${getSessionTagStyle(tag)}`}>{tag}</span>)}
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-3 sm:py-4 align-top text-[10px] sm:text-xs">{trade.direction === "short" ? `${formatCurrency(trade.sellPrice)} -> ${formatCurrency(trade.buyPrice)}` : `${formatCurrency(trade.buyPrice)} -> ${formatCurrency(trade.sellPrice)}`}</td>
                          <td className="px-3 sm:px-5 py-3 sm:py-4 align-top">{trade.qty}</td>
                          <td className={`px-3 sm:px-5 py-3 sm:py-4 align-top font-semibold text-sm sm:text-base ${tone.text}`}>
                            <div className="flex flex-col">
                              <span>{formatSignedCurrency(trade.pnl - (trade.commission || 0))}</span>
                              {(trade.commission || 0) > 0 && <span className="text-[10px] text-slate-400 font-normal mt-0.5">Gross: {trade.pnl} | Fees: {trade.commission}</span>}
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-3 sm:py-4 align-top text-[10px] sm:text-xs">{formatDuration(trade.duration)}</td>
                          <td className="px-3 sm:px-5 py-3 sm:py-4 align-top">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTradeModal(tradeKey(trade), true);
                                }}
                                className="inline-flex items-center justify-center sm:justify-start gap-1 rounded-xl border p-2 sm:px-3 sm:py-2 text-xs transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98]"
                                style={softPanelStyle}
                              >
                                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  openTradeModal(tradeKey(trade), false);
                                }}
                                className="inline-flex items-center justify-center sm:justify-start gap-1 rounded-xl border p-2 sm:px-3 sm:py-2 text-xs transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98]"
                                style={softPanelStyle}
                              >
                                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">View</span>
                              </button>
                              <button
                                onClick={() => {
                                  const key = tradeKey(trade);
                                  if (pendingRemoveTradeKey === key) {
                                    removeTrade(key);
                                    setPendingRemoveTradeKey(null);
                                  } else {
                                    setPendingRemoveTradeKey(key);
                                  }
                                }}
                                className="inline-flex items-center justify-center sm:justify-start gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 sm:px-3 sm:py-2 text-xs text-rose-200 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98]"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">{pendingRemoveTradeKey === tradeKey(trade) ? "Confirm" : "Remove"}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "terminal" && (
          <Terminal 
            user={user} 
            panelStyle={panelStyle} 
            softPanelStyle={softPanelStyle} 
            accentColor={displayAccentColor} 
            accentButtonStyle={accentButtonStyle} 
            panelTint={displayPanelTint}
            onNavigate={(tab: Tab, id?: string) => {
              if (tab === "friends" && id) {
                setViewUserId(id);
              } else {
                setActiveTab(tab);
                if (id) setViewUserId(id);
              }
            }}
            openTradeViewer={(trade: any) => {
              // open trade modal
            }}
          />
        )}

        {activeTab === "friends" && (
          <Friends 
            user={user} 
            panelStyle={panelStyle} 
            softPanelStyle={softPanelStyle} 
            accentColor={displayAccentColor} 
            accentButtonStyle={accentButtonStyle} 
            panelTint={displayPanelTint} 
            onThemeChange={setActiveFriendTheme}
            viewUserId={viewUserId}
            setViewUserId={setViewUserId}
          />
        )}

        {activeTab === "communities" && (
          <Communities 
            user={user} 
            panelStyle={panelStyle} 
            softPanelStyle={softPanelStyle} 
            accentColor={displayAccentColor} 
            accentButtonStyle={accentButtonStyle} 
            panelTint={displayPanelTint} 
            onNavigate={(tab: Tab, id?: string) => {
              if (tab === "friends" && id) {
                setViewUserId(id);
              } else {
                setActiveTab(tab);
                if (id) setViewUserId(id);
              }
            }}
          />
        )}

        {activeTab === "admin" && isAdmin && (
          <AdminPanel />
        )}

        {viewUserId && activeTab !== "friends" && (
          <Friends 
            user={user} 
            panelStyle={panelStyle} 
            softPanelStyle={softPanelStyle} 
            accentColor={displayAccentColor} 
            accentButtonStyle={accentButtonStyle} 
            panelTint={displayPanelTint} 
            onThemeChange={setActiveFriendTheme}
            viewUserId={viewUserId}
            setViewUserId={setViewUserId}
            isModal={true}
          />
        )}

        {activeTab === "settings" && (
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">General</h2>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-sm text-slate-300">Username (for friends)</span>
                    <div className="flex gap-2">
                      <input 
                        value={username} 
                        onChange={(event) => {
                          setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                          setUsernameSaved(false);
                        }} 
                        placeholder="e.g. trader_john"
                        className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none text-white" 
                        style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }} 
                      />
                      <button 
                        disabled={isSavingUsername || isSavingSettings}
                        onClick={async () => {
                          if (!user) return;
                          setIsSavingUsername(true);
                          const { error } = await supabase.from('user_settings').update({ username }).eq('user_id', user.id);
                          setIsSavingUsername(false);
                          if (!error) {
                            setIsSavingSettings(false);
                            setSettingsSaved(true);
                            setTimeout(() => setSettingsSaved(false), 2000);
                          }
                        }}
                        className="mt-2 relative inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold text-white overflow-hidden transition-all duration-300"
                        style={accentButtonStyle}
                      >
                        <div className={`transition-transform duration-300 ${settingsSaved ? '-translate-y-10' : 'translate-y-0'}`}>Save</div>
                        <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${settingsSaved ? 'translate-y-0' : 'translate-y-10'}`}>
                          <Check className="h-5 w-5" />
                        </div>
                      </button>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 block">Only lowercase letters, numbers, and underscores.</span>
                  </label>

                  <label className="block mt-4">
                    <span className="text-sm text-slate-300">Profile Picture</span>
                    <div className="mt-2 flex items-center gap-4">
                      <img 
                        src={user?.user_metadata?.avatar_url || "/vitto-head.png"} 
                        alt="Profile" 
                        className="h-16 w-16 rounded-full object-cover border-2 border-white/10 bg-black/20"
                      />
                      <div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleAvatarUpload}
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="rounded-xl px-4 py-2 border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                        >
                          {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" /> : null}
                          {avatarUploading ? "Uploading..." : "Upload Image"}
                        </button>
                      </div>
                    </div>
                  </label>
                </div>
                
                <h3 className="text-lg font-semibold text-white mt-10 mb-4 pb-2 border-b border-white/10 w-full text-left">Privacy</h3>
                <div className="flex flex-col gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer w-full">
                    <input type="checkbox" checked={profilePrivate} onChange={(event) => setProfilePrivate(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    Private Profile
                    <span className="text-slate-500 text-xs ml-2">(Hide your profile and feed from non-friends)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer border-t border-white/5 pt-4 w-full">
                    <input type="checkbox" checked={friendsPrivate} onChange={(event) => setFriendsPrivate(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    Make my friends list private
                    <span className="text-slate-500 text-xs ml-2">(Hide mutual friends from others)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer w-full pt-2">
                    <input type="checkbox" checked={friendsShareDetails} onChange={(event) => setFriendsShareDetails(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    Share detailed trade stats
                    <span className="text-slate-500 text-xs ml-2">(Allow friends to see confluences, mistakes, and execution details)</span>
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Custom Gradient</h2>
                  <button onClick={resetVisuals} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm" style={softPanelStyle}>
                    <RefreshCcw className="h-4 w-4" /> Reset
                  </button>
                </div>
                <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={singleColor} onChange={(event) => setSingleColor(event.target.checked)} />
                  Single color
                </label>
                <div
                  className="mt-4 h-36 rounded-3xl border"
                  style={singleColor ? { borderColor: hexToRgba(accentColor, 0.2), backgroundColor: gradientStart } : { borderColor: hexToRgba(accentColor, 0.2), backgroundImage: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientMid} 50%, ${gradientEnd} 100%)` }}
                />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Start", value: gradientStart, onChange: setGradientStart },
                    { label: "Mid", value: gradientMid, onChange: setGradientMid },
                    { label: "End", value: gradientEnd, onChange: setGradientEnd },
                  ].map((item) => (
                    <label key={item.label} className="rounded-2xl border p-3" style={softPanelStyle}>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="color" value={item.value} onChange={(event) => item.onChange(event.target.value)} className="h-10 w-12 bg-transparent" />
                        <input type="text" value={item.value} onChange={(event) => item.onChange(event.target.value)} className="w-full rounded-lg border bg-black/15 px-2 py-1.5 text-sm outline-none" style={{ borderColor: hexToRgba(accentColor, 0.14) }} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
              <h2 className="text-xl font-semibold text-white">More Dashboard Color Options</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {THEME_PRESETS.map((preset) => (
                  <button key={preset.id} onClick={() => applyPreset(preset)} className="rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5" style={{ ...softPanelStyle, borderColor: preset.id === themeId ? hexToRgba(preset.accent, 0.5) : hexToRgba(accentColor, 0.16) }}>
                    <div className="font-semibold text-white">{preset.name}</div>
                    <div className="mt-3 h-16 rounded-xl border" style={{ borderColor: hexToRgba(preset.accent, 0.25), backgroundImage: `linear-gradient(135deg, ${preset.start} 0%, ${preset.mid} 50%, ${preset.end} 100%)` }} />
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-4">
                <label className="rounded-2xl border p-4" style={softPanelStyle}>
                  <span className="text-sm text-slate-300">Accent Color</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="h-11 w-14 bg-transparent" />
                    <input
                      value={accentInput}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setAccentInput(raw);
                        const normalized = normalizeHex(raw, "");
                        if (normalized) setAccentColor(normalized);
                      }}
                      onBlur={() => setAccentInput(accentColor)}
                      placeholder="#4f7cff"
                      className="w-full rounded-lg border bg-black/15 px-2 py-1.5 text-sm outline-none"
                      style={{ borderColor: hexToRgba(accentColor, 0.14) }}
                    />
                  </div>
                </label>
                <label className="rounded-2xl border p-4" style={softPanelStyle}>
                  <span className="text-sm text-slate-300">Glass Panel Tint</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="color" value={panelTint} onChange={(event) => setPanelTint(event.target.value)} className="h-11 w-14 bg-transparent" />
                    <input
                      value={panelTintInput}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setPanelTintInput(raw);
                        const normalized = normalizeHex(raw, "");
                        if (normalized) setPanelTint(normalized);
                      }}
                      onBlur={() => setPanelTintInput(panelTint)}
                      placeholder="#0f172a"
                      className="w-full rounded-lg border bg-black/15 px-2 py-1.5 text-sm outline-none"
                      style={{ borderColor: hexToRgba(accentColor, 0.14) }}
                    />
                  </div>
                </label>
                <label className="rounded-2xl border p-4" style={softPanelStyle}>
                  <span className="text-sm text-slate-300">Text Color</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} className="h-11 w-14 bg-transparent" />
                    <input
                      value={textColorInput}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setTextColorInput(raw);
                        const normalized = normalizeHex(raw, "");
                        if (normalized) setTextColor(normalized);
                      }}
                      onBlur={() => setTextColorInput(textColor)}
                      placeholder="#e2e8f0"
                      className="w-full rounded-lg border bg-black/15 px-2 py-1.5 text-sm outline-none"
                      style={{ borderColor: hexToRgba(accentColor, 0.14) }}
                    />
                  </div>
                </label>
                <label className="rounded-2xl border p-4" style={softPanelStyle}>
                  <span className="text-sm text-slate-300">Glass Opacity</span>
                  <input type="range" min="0.2" max="0.85" step="0.01" value={glassOpacity} onChange={(event) => setGlassOpacity(Number.parseFloat(event.target.value))} className="mt-3 w-full" />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
              <h2 className="text-xl font-semibold text-white">Saved Presets</h2>
              <div className="mt-4 flex gap-3">
                <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" className="w-full rounded-2xl border px-4 py-3 outline-none" style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }} />
                <button onClick={saveCurrentPreset} className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={accentButtonStyle}>
                  <Sparkles className="h-4 w-4" /> Save
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedPresets.map((preset) => (
                  <div key={preset.id} className="rounded-2xl border p-3" style={softPanelStyle}>
                    <div className="font-semibold text-white">{preset.name}</div>
                    <div className="mt-2 h-12 rounded-lg border" style={{ borderColor: hexToRgba(preset.accent, 0.25), backgroundImage: `linear-gradient(135deg, ${preset.start} 0%, ${preset.mid} 50%, ${preset.end} 100%)` }} />
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => applyPreset(preset)} className="rounded-lg border px-2 py-1 text-xs" style={softPanelStyle}>Apply</button>
                      <button onClick={() => setSavedPresets((prev) => prev.filter((item) => item.id !== preset.id))} className="rounded-lg border border-rose-500/30 px-2 py-1 text-xs text-rose-200">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border p-6 backdrop-blur-2xl relative z-40" style={panelStyle}>
              <div className="flex flex-col md:flex-row md:items-start gap-8">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white">Default Timezone</h2>
                  <p className="mt-1 text-sm text-slate-400">When logging manual trades, timestamps will be formatted in this timezone.</p>
                  <div className="mt-4">
                    <CustomSelect
                      value={tradeTimezone}
                      onChange={(val: string) => setTradeTimezone(val)}
                      panelTint={panelTint}
                      accentColor={accentColor}
                      options={[
                        { value: "Local", label: "Local Browser Time" },
                        { value: "America/New_York", label: "New York Time (EST/EDT)" },
                        { value: "Europe/London", label: "London (GMT/BST)" },
                        { value: "America/Chicago", label: "Chicago Time (CST/CDT)" },
                        { value: "Asia/Tokyo", label: "Tokyo Time (JST)" },
                        { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)" },
                        { value: "America/Denver", label: "Mountain Time (MST/MDT)" },
                        { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
                        { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
                        { value: "UTC", label: "UTC" },
                      ]}
                      className="w-full max-w-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                <div className="flex flex-col gap-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                      Breakeven Auto Flag Range
                      <div className="group relative flex items-center">
                        <Info className="h-4 w-4 text-slate-400 cursor-help" />
                        <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 rounded-lg border border-white/10 p-2 text-[10px] text-slate-300 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] normal-case tracking-normal backdrop-blur-xl pointer-events-none" style={{ backgroundColor: hexToRgba(panelTint, 0.95) }}>
                          Any trade with a P&L within this range will automatically be flagged as Breakeven instead of Win or Loss.
                        </div>
                      </div>
                    </h2>
                    <div className="mt-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Low: ${breakevenLow}</span>
                        <span>High: ${breakevenHigh}</span>
                      </div>
                      <DualRangeSlider 
                        min={-500} max={500} 
                        low={breakevenLow} high={breakevenHigh} 
                        setLow={setBreakevenLow} setHigh={setBreakevenHigh} 
                        accentColor={accentColor} panelTint={panelTint} 
                      />
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <label>
                          <input type="number" value={breakevenLow} onChange={(event) => setBreakevenLow(Number.parseFloat(event.target.value) || 0)} className="w-full rounded-2xl border px-4 py-3 outline-none text-sm" style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }} />
                        </label>
                        <label>
                          <input type="number" value={breakevenHigh} onChange={(event) => setBreakevenHigh(Number.parseFloat(event.target.value) || 0)} className="w-full rounded-2xl border px-4 py-3 outline-none text-sm" style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                <h2 className="text-xl font-semibold text-white">Tag Libraries</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Entry</div>
                    <div className="mt-2 flex gap-2">
                      <input value={newEntryTag} onChange={(event) => setNewEntryTag(event.target.value)} placeholder="Add tag" className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }} />
                      <button
                        onClick={() => {
                          ensureLibraryTag("entry", newEntryTag);
                          setNewEntryTag("");
                        }}
                        className="rounded-xl border px-3 py-2 text-sm"
                        style={softPanelStyle}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <Reorder.Group axis="y" values={entryLibrary} onReorder={setEntryLibrary} className="mt-3 grid grid-cols-2 gap-2">
                      {entryLibrary.map((tag) => (
                        <Reorder.Item key={tag} value={tag} className="tag-chip flex justify-between items-center bg-white/5 pl-3 pr-1 py-1 text-sm text-slate-200 cursor-grab active:cursor-grabbing rounded-lg border border-white/10" drag transition={{ duration: 0 }}>
                          <span className="pointer-events-none truncate mr-1">{tag}</span>
                          <button onClick={() => setEntryLibrary((prev) => prev.filter((item) => item !== tag))} className="shrink-0 p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Confluence</div>
                    <div className="mt-2 flex gap-2">
                      <input value={newConfluenceTag} onChange={(event) => setNewConfluenceTag(event.target.value)} placeholder="Add tag" className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }} />
                      <button
                        onClick={() => {
                          ensureLibraryTag("confluence", newConfluenceTag);
                          setNewConfluenceTag("");
                        }}
                        className="rounded-xl border px-3 py-2 text-sm"
                        style={softPanelStyle}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <Reorder.Group axis="y" values={confluenceLibrary} onReorder={setConfluenceLibrary} className="mt-3 grid grid-cols-2 gap-2">
                      {confluenceLibrary.map((tag) => (
                        <Reorder.Item key={tag} value={tag} className="tag-chip flex justify-between items-center bg-white/5 pl-3 pr-1 py-1 text-sm text-slate-200 cursor-grab active:cursor-grabbing rounded-lg border border-white/10" drag transition={{ duration: 0 }}>
                          <span className="pointer-events-none truncate mr-1">{tag}</span>
                          <button onClick={() => setConfluenceLibrary((prev) => prev.filter((item) => item !== tag))} className="shrink-0 p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Mistakes</div>
                    <div className="mt-2 flex gap-2">
                      <input value={newMistakeTag} onChange={(event) => setNewMistakeTag(event.target.value)} placeholder="Add tag" className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }} />
                      <button
                        onClick={() => {
                          ensureLibraryTag("mistake", newMistakeTag);
                          setNewMistakeTag("");
                        }}
                        className="rounded-xl border px-3 py-2 text-sm"
                        style={softPanelStyle}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <Reorder.Group axis="y" values={mistakeLibrary} onReorder={setMistakeLibrary} className="mt-3 grid grid-cols-2 gap-2">
                      {mistakeLibrary.map((tag) => (
                        <Reorder.Item key={tag} value={tag} className="tag-chip flex justify-between items-center bg-white/5 pl-3 pr-1 py-1 text-sm text-slate-200 cursor-grab active:cursor-grabbing rounded-lg border border-white/10" drag transition={{ duration: 0 }}>
                          <span className="pointer-events-none truncate mr-1">{tag}</span>
                          <button onClick={() => setMistakeLibrary((prev) => prev.filter((item) => item !== tag))} className="shrink-0 p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Data Management</h2>
                </div>
                <button
                  onClick={async () => {
                    if (window.prompt("Type 'I want to delete all of my data'") === "I want to delete all of my data") {
                      setTrades([]);
                      setSelectedDayKey(null);
                      setActiveTradeKey(null);
                      window.localStorage.removeItem(STORAGE.trades);
                      if (user && !isDemoMode) {
                        try {
                          const { error } = await supabase.from('trades_v2').delete().eq('user_id', user.id);
                          if (error) throw error;
                        } catch (err) {
                          console.error("Error deleting all trades:", err);
                        }
                      }
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200"
                >
                  <Trash2 className="h-4 w-4" /> Delete All
                </button>
              </div>
            </div>

            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Suggestions & Bug Reports</h2>
                  <p className="text-sm text-slate-400 mt-1">Found a bug or have an idea? Let us know!</p>
                </div>
                <div className="flex flex-col gap-3">
                  <textarea
                    value={suggestionText}
                    onChange={(e) => setSuggestionText(e.target.value)}
                    placeholder="Describe your suggestion or report a bug..."
                    className="w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none min-h-[120px] resize-y"
                    style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }}
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={!suggestionText.trim() || isSubmittingSuggestion}
                      onClick={async () => {
                        if (!suggestionText.trim() || !user || isDemoMode) {
                          if (isDemoMode) setImportStatus({ type: "error", message: "Cannot submit feedback in demo mode." });
                          return;
                        }
                        setIsSubmittingSuggestion(true);
                        try {
                          await supabase.from('suggestions').insert({
                            user_id: user.id,
                            username: username,
                            message: suggestionText
                          });
                          setSuggestionText("");
                          setImportStatus({ type: "success", message: "Feedback submitted successfully!" });
                        } catch (err) {
                          setImportStatus({ type: "error", message: "Failed to submit feedback." });
                        } finally {
                          setIsSubmittingSuggestion(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      style={accentButtonStyle}
                    >
                      {isSubmittingSuggestion ? "Submitting..." : "Submit Feedback"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        )}
      </main>

      {selectedDayTrades && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: hexToRgba(panelTint, 0.75) }}
          onClick={() => setSelectedDayKey(null)}
        >
          <div
            ref={dayModalRef}
            className="modal-pop w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border p-6 backdrop-blur-2xl"
            style={panelStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedDayTrades.title}</h3>
              </div>
              <button onClick={() => setSelectedDayKey(null)} className="rounded-2xl p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-3 shrink-0 text-sm text-slate-400">Click any trade below to view and edit it.</div>
            <div className="mt-4 space-y-3 p-2 -mx-2 px-2 flex-1 overflow-y-auto custom-scrollbar">
              {selectedDayTrades.trades.map((trade) => {
                if (!trade) return null;
                const status = getTradeStatus(trade.pnl || 0, breakevenFloor, breakevenCeiling);
                const tone = getStatusTone(status);
                const directionLabel = trade.direction === "short" ? "SHORT" : "LONG";
                const sessionStr = trade.boughtTimestamp && getTradingSession(trade.boughtTimestamp);
                return (
                  <button
                    key={tradeKey(trade)}
                    onClick={() => {
                      openTradeModal(tradeKey(trade), false);
                    }}
                    className="w-full rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01]"
                    style={softPanelStyle}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{trade.symbol || "Unknown"}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-100">{directionLabel}</span>
                          <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${tone?.pill || "border-white/10 bg-white/5"}`}>{status}</span>
                          {sessionStr && (
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getSessionTagStyle(sessionStr) || "border-white/10"}`}>
                              {sessionStr}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">Exit {trade.soldTimestamp && !isNaN(new Date(trade.soldTimestamp).getTime()) ? new Date(trade.soldTimestamp).toLocaleString() : 'Unknown'} • Qty {trade.qty || 0}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${tone?.text || "text-white"}`}>{formatSignedCurrency(trade.pnl || 0)}</div>
                        <div className="mt-1 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openTradeModal(tradeKey(trade), true);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1 text-xs transition-all duration-300 hover:bg-white/10 active:scale-95"
                            style={softPanelStyle}
                          >
                            <Edit className="h-3 w-3" /> Edit Trade
                          </button>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedTrade && tradeEditForm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 backdrop-blur-md"
          style={{ background: hexToRgba(panelTint, 0.75) }}
          onPaste={handleTradePaste}
          onClick={() => {
            setActiveTradeKey(null);
            setPendingRemoveTradeKey(null);
          }}
        >
          {(() => {
            const currentIndex = trades.findIndex(t => tradeKey(t) === activeTradeKey);
            const hasPrev = currentIndex > 0;
            const hasNext = currentIndex >= 0 && currentIndex < trades.length - 1;
            return (
              <div className="flex w-full items-center justify-center gap-1 sm:gap-4 h-full" onClick={() => { setActiveTradeKey(null); setPendingRemoveTradeKey(null); }}>
                <div className="shrink-0 flex items-center justify-center min-w-[2.5rem] sm:min-w-[3rem]" onClick={(e) => e.stopPropagation()}>
                  {hasPrev && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openTradeModal(tradeKey(trades[currentIndex - 1]));
                      }}
                      className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 hover:scale-110 transition-all z-[90]"
                    >
                       <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  )}
                </div>
                
                <div
                  ref={tradeModalRef}
                  className={`modal-pop w-full ${isTradeEditMode ? "max-w-[calc(100vw-6rem)] sm:max-w-5xl lg:max-w-6xl" : "max-w-[calc(100vw-6rem)] sm:max-w-4xl lg:max-w-5xl"} max-h-[90vh] flex flex-col rounded-3xl border backdrop-blur-2xl relative transition-all duration-300`}
                  style={panelStyle}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between border-b border-white/10 p-4 sm:p-6 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedTrade.symbol} Trade Details</h3>
                <p className="mt-1 text-sm text-slate-400">
                  ID: {selectedTrade.buyFillId} / {selectedTrade.sellFillId}
                  {!isTradeEditMode && tradeEditForm.soldTimestamp && !isNaN(new Date(tradeEditForm.soldTimestamp).getTime()) && ` • ${new Date(tradeEditForm.soldTimestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsTradeEditMode(!isTradeEditMode)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-all border ${isTradeEditMode ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-300 hover:scale-105 active:scale-95" : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95"}`}
                >
                  {isTradeEditMode ? "Editing Mode" : "View Mode"}
                </button>
                <button onClick={() => openTradeModal(null)} className="rounded-2xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all hover:scale-110 active:scale-95">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-5">
              {!isTradeEditMode ? (
                <div className="flex flex-col gap-6 w-full">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-2xl border p-4 flex flex-col justify-center" style={softPanelStyle}>
                      <div className="text-xs uppercase tracking-widest text-slate-400">P&L</div>
                      <div className={`mt-1 flex flex-wrap items-center gap-1 text-2xl font-bold ${tradeEditForm.pnl.toString().startsWith('-') ? 'text-rose-400' : Number(tradeEditForm.pnl) > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {formatSignedCurrency(Number(tradeEditForm.pnl))}
                        {Number(tradeEditForm.commission) > 0 && <span className="text-[10px] text-slate-500 font-normal ml-1">({tradeEditForm.commission} fee)</span>}
                      </div>
                    </div>
                    <div className="rounded-2xl border p-4" style={softPanelStyle}>
                      <div className="text-xs uppercase tracking-widest text-slate-400">Direction</div>
                      <div className={`mt-1 text-lg font-bold uppercase ${tradeEditForm.direction === 'long' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tradeEditForm.direction}
                      </div>
                    </div>
                    <div className="rounded-2xl border p-4" style={softPanelStyle}>
                      <div className="text-xs uppercase tracking-widest text-slate-400">Quantity</div>
                      <div className="mt-1 text-lg font-bold text-white">{tradeEditForm.qty || '-'}</div>
                    </div>
                    <div className="rounded-2xl border p-4" style={softPanelStyle}>
                      <div className="text-xs uppercase tracking-widest text-slate-400">Points</div>
                      <div className="mt-1 text-base font-bold text-white break-words">
                        {tradeEditForm.direction === 'long' 
                          ? `${tradeEditForm.buyPrice} → ${tradeEditForm.sellPrice}`
                          : `${tradeEditForm.sellPrice} → ${tradeEditForm.buyPrice}`}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                      <div className="rounded-2xl border p-5" style={softPanelStyle}>
                         <h4 className="font-semibold text-white mb-4">Tags & Accounts</h4>
                         <div className="space-y-4">
                           {tradeEditForm.accountId && (
                             <div>
                               <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Accounts</div>
                               <div className="flex flex-wrap gap-2">
                                 {tradeEditForm.accountId.split(',').filter(Boolean).map(accId => {
                                    let accName = accId;
                                    accountsLibrary.forEach(g => g.accounts.forEach(a => { if (a.id === accId) accName = a.name; }));
                                    return <span key={accId} className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-white border border-white/10">{accName}</span>;
                                 })}
                               </div>
                             </div>
                           )}
                           
                           {tradeEditForm.entryTags && tradeEditForm.entryTags.length > 0 && (
                             <div>
                                <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Entry setups</div>
                                <div className="flex flex-wrap gap-2">
                                  {tradeEditForm.entryTags.map(tag => <span key={tag} className="tag-chip px-2.5 py-1 border border-amber-500/30 text-xs text-amber-200 bg-amber-500/10 rounded-full">{tag}</span>)}
                                </div>
                             </div>
                           )}

                           {tradeEditForm.confluenceTags && tradeEditForm.confluenceTags.length > 0 && (
                             <div>
                                <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Confluences</div>
                                <div className="flex flex-wrap gap-2">
                                  {tradeEditForm.confluenceTags.map(tag => <span key={tag} className="tag-chip px-2.5 py-1 border border-emerald-500/30 text-xs text-emerald-200 bg-emerald-500/10 rounded-full">{tag}</span>)}
                                </div>
                             </div>
                           )}

                           {tradeEditForm.mistakeTags && tradeEditForm.mistakeTags.length > 0 && (
                             <div>
                                <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Mistakes</div>
                                <div className="flex flex-wrap gap-2">
                                  {tradeEditForm.mistakeTags.map(tag => <span key={tag} className="tag-chip px-2.5 py-1 border border-rose-500/30 text-xs text-rose-200 bg-rose-500/10 rounded-full">{tag}</span>)}
                                </div>
                             </div>
                           )}
                           
                           {!tradeEditForm.accountId && (!tradeEditForm.entryTags || tradeEditForm.entryTags.length === 0) && (!tradeEditForm.confluenceTags || tradeEditForm.confluenceTags.length === 0) && (!tradeEditForm.mistakeTags || tradeEditForm.mistakeTags.length === 0) && (
                             <div className="text-sm text-slate-500 italic">No tags selected.</div>
                           )}
                         </div>
                      </div>

                      {tradeEditForm.images && tradeEditForm.images.length > 0 && (
                        <div className="rounded-2xl border p-5" style={softPanelStyle}>
                           <h4 className="font-semibold text-white mb-3">Screenshots</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             {tradeEditForm.images.map((img, idx) => (
                               <div key={idx} className="relative h-36 rounded-lg overflow-hidden border border-white/10 cursor-pointer" onClick={() => {setLightboxImageSrc(img); setLightboxZoomed(false);}}>
                                 <img src={img} className="w-full h-full object-cover transition-transform hover:scale-[1.03]" />
                               </div>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col h-full rounded-2xl border p-5" style={softPanelStyle}>
                       <div className="flex justify-between items-center mb-3">
                         <h4 className="font-semibold text-white">Trade Notes</h4>
                       </div>
                       <textarea
                         value={tradeEditForm.notes ?? ""}
                         onChange={(e) => setTradeEditForm(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                         placeholder="Type your notes here... Changes won't save automatically. Click save when done."
                         className="flex-1 min-h-[250px] w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-slate-200 outline-none resize-y"
                       />
                       <div className="mt-4 flex justify-end">
                         <button onClick={saveTradeEdits} disabled={isUpdatingTrade} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50" style={accentButtonStyle}>
                           {isUpdatingTrade ? "Saving..." : "Save Notes"}
                         </button>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border p-4" style={softPanelStyle}>
                    <div className="grid gap-3 md:grid-cols-2">
                    {[
                      { label: "Symbol", key: "symbol" },
                      { label: "Qty", key: "qty" },
                      { label: "Start Price", key: tradeEditForm.direction === "short" ? "sellPrice" : "buyPrice" },
                      { label: "End Price", key: tradeEditForm.direction === "short" ? "buyPrice" : "sellPrice" },
                      { label: "P&L", key: "pnl" },
                      { label: "Commission", key: "commission" },
                      { label: "Max Points Profit (MFE)", key: "maxPointsProfit", tooltip: "Maximum Favorable Excursion calculates the average maximum points of profit recorded per trade" },
                      { label: "Tick Size", key: "_tickSize" },
                      { label: "Price Format", key: "_priceFormat" },
                      { label: "Price Format Type", key: "_priceFormatType" },
                      { label: "Duration (sec or text)", key: "duration" },
                    ].map((field) => (
                      <label key={field.key} className="relative">
                        <div className="text-xs uppercase tracking-[0.12em] text-slate-400 flex items-center gap-1.5">
                          {field.label}
                          {field.tooltip && (
                            <div className="group relative flex items-center">
                              <Info className="h-3 w-3 text-slate-500 cursor-help" />
                              <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-48 rounded-lg border border-white/10 p-2 text-[10px] text-slate-300 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] normal-case tracking-normal backdrop-blur-xl pointer-events-none" style={{ backgroundColor: hexToRgba(panelTint, 0.95) }}>
                                {field.tooltip}
                              </div>
                            </div>
                          )}
                        </div>
                        <input
                          disabled={!isTradeEditMode}
                          value={tradeEditForm[field.key as keyof TradeEditForm] as string}
                          onChange={(event) => setTradeEditForm((prev) => (prev ? { ...prev, [field.key]: event.target.value } : prev))}
                          className="mt-1.5 w-full rounded-xl border bg-black/15 px-3 py-2 text-sm text-white outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ borderColor: hexToRgba(accentColor, 0.16) }}
                        />
                      </label>
                    ))}
                    <div className="flex flex-col">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Direction</div>
                      <button 
                        disabled={!isTradeEditMode}
                        className="mt-1.5 relative flex h-[38px] w-full cursor-pointer items-center rounded-xl border p-1 bg-black/15 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ borderColor: hexToRgba(accentColor, 0.16) }}
                        onClick={() => setTradeEditForm(prev => prev ? { ...prev, direction: prev.direction === 'long' ? 'short' : 'long', buyPrice: prev.sellPrice, sellPrice: prev.buyPrice } : prev)}
                      >
                        <div 
                          className="absolute inset-y-1 rounded-lg transition-all duration-300 ease-out"
                          style={{
                            background: tradeEditForm.direction === 'long' ? '#10b981' : '#ef4444',
                            width: 'calc(50% - 4px)',
                            left: tradeEditForm.direction === 'long' ? '4px' : 'calc(50%)'
                          }}
                        />
                        <div className="relative z-10 flex w-1/2 items-center justify-center text-sm font-medium text-white transition-colors">
                          Long
                        </div>
                        <div className="relative z-10 flex w-1/2 items-center justify-center text-sm font-medium text-white transition-colors">
                          Short
                        </div>
                      </button>
                    </div>
                    <label className="relative z-50 pointer-events-auto">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1.5">Bought Timestamp</div>
                      <div className={isTradeEditMode ? "" : "opacity-60 pointer-events-none"}>
                        <CustomDateTimePicker
                          value={tradeEditForm.boughtTimestamp}
                          onChange={(val: string) => setTradeEditForm((prev: any) => (prev ? { ...prev, boughtTimestamp: val } : prev))}
                          panelTint={panelTint}
                          accentColor={accentColor}
                          className="w-full"
                          placement="top"
                        />
                      </div>
                    </label>
                    <label className="relative z-40 pointer-events-auto">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1.5">Sold Timestamp</div>
                      <div className={isTradeEditMode ? "" : "opacity-60 pointer-events-none"}>
                        <CustomDateTimePicker
                          value={tradeEditForm.soldTimestamp}
                          onChange={(val: string) => setTradeEditForm((prev: any) => (prev ? { ...prev, soldTimestamp: val } : prev))}
                          panelTint={panelTint}
                          accentColor={accentColor}
                          className="w-full"
                          placement="top"
                        />
                      </div>
                    </label>
                  </div>
                  {isTradeEditMode && (
                    <div className="mt-4 flex gap-2">
                      <button 
                        onClick={saveTradeEdits} 
                        disabled={isUpdatingTrade}
                        className="relative rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] overflow-hidden min-w-[124px]" 
                        style={accentButtonStyle}
                      >
                        <div className={`transition-transform duration-300 ${tradeUpdated ? '-translate-y-10' : 'translate-y-0'}`}>Save Changes</div>
                        <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${tradeUpdated ? 'translate-y-0' : 'translate-y-10'}`}>
                          <Check className="h-5 w-5" />
                        </div>
                      </button>
                      <button
                        onClick={() => setTradeEditForm((prev) => (prev ? { ...prev, pnl: tradeEditAutoPnl.toFixed(2) } : prev))}
                        className="rounded-xl border px-3 py-2 text-xs transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
                        style={softPanelStyle}
                      >
                        Fill Auto P&L
                      </button>
                      <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                        <div
                          className={`relative w-8 h-4 rounded-full cursor-pointer transition-colors ${autoFillPnl ? 'bg-emerald-500' : 'bg-slate-700'}`}
                          onClick={() => setAutoFillPnl(!autoFillPnl)}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${autoFillPnl ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </div>
                      <button onClick={() => setTradeEditForm(createTradeEditForm(selectedTrade, tradeTimezone))} className="rounded-xl border px-3 py-2 text-xs transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]" style={softPanelStyle}>Revert</button>
                      <button
                        onClick={() => {
                          const key = tradeKey(selectedTrade);
                          if (pendingRemoveTradeKey === key) {
                            removeTrade(key);
                            setPendingRemoveTradeKey(null);
                          } else {
                            setPendingRemoveTradeKey(key);
                          }
                        }}
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {pendingRemoveTradeKey === tradeKey(selectedTrade) ? "Confirm" : "Remove"} Trade
                      </button>
                    </div>
                  )}
                </div>

                {isTradeEditMode && (
                  <div
                    className="rounded-2xl border border-dashed p-4"
                    style={softPanelStyle}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      addImagesToTrade(tradeKey(selectedTrade), event.dataTransfer.files);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-slate-300">Add screenshots</div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={softPanelStyle}>
                        <ImagePlus className="h-3.5 w-3.5" />
                        Add files
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(event) => addImagesToTrade(tradeKey(selectedTrade), event.target.files)}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border p-4" style={softPanelStyle}>
                  <div className="text-sm font-semibold text-white">Entry Tags</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entryLibrary.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={!isTradeEditMode}
                        onClick={() => setTradeEditForm(prev => {
                           if (!prev) return prev;
                           const list = prev.entryTags || [];
                           return { ...prev, entryTags: list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag] };
                        })}
                        className={`tag-chip rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${(tradeEditForm.entryTags ?? []).includes(tag) ? "border-white/35 font-medium" : "border-white/10 bg-white/5 text-slate-300"}`}
                        style={(tradeEditForm.entryTags ?? []).includes(tag) ? { background: hexToRgba(accentColor, 0.2), color: getContrastColor(accentColor), borderColor: hexToRgba(accentColor, 0.5) } : undefined}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border p-4" style={softPanelStyle}>
                  <div className="text-sm font-semibold text-white">Confluence Tags</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {confluenceLibrary.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={!isTradeEditMode}
                        onClick={() => setTradeEditForm(prev => {
                           if (!prev) return prev;
                           const list = prev.confluenceTags || [];
                           return { ...prev, confluenceTags: list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag] };
                        })}
                        className={`tag-chip rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${(tradeEditForm.confluenceTags ?? []).includes(tag) ? "border-white/35 font-medium" : "border-white/10 bg-white/5 text-slate-300"}`}
                        style={(tradeEditForm.confluenceTags ?? []).includes(tag) ? { background: hexToRgba(accentColor, 0.2), color: getContrastColor(accentColor), borderColor: hexToRgba(accentColor, 0.5) } : undefined}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border p-4" style={softPanelStyle}>
                  <div className="text-sm font-semibold text-white">Mistake Tags</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mistakeLibrary.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={!isTradeEditMode}
                        onClick={() => setTradeEditForm(prev => {
                           if (!prev) return prev;
                           const list = prev.mistakeTags || [];
                           return { ...prev, mistakeTags: list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag] };
                        })}
                        className={`tag-chip rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${(tradeEditForm.mistakeTags ?? []).includes(tag) ? "border-white/35 font-medium" : "border-white/10 bg-white/5 text-slate-300"}`}
                        style={(tradeEditForm.mistakeTags ?? []).includes(tag) ? { background: hexToRgba(accentColor, 0.2), color: getContrastColor(accentColor), borderColor: hexToRgba(accentColor, 0.5) } : undefined}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={softPanelStyle}>
                {(tradeEditForm.images ?? []).length === 0 ? (
                  <div className="flex h-full min-h-72 items-center justify-center rounded-2xl border border-white/10 text-sm text-slate-400">
                    No screenshots yet.
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => {
                        setLightboxImageSrc((tradeEditForm.images ?? [])[activeTradeImageIndex]);
                        setLightboxZoomed(false);
                      }}
                      className="block w-full overflow-hidden rounded-2xl"
                    >
                      <img
                        src={(tradeEditForm.images ?? [])[activeTradeImageIndex]}
                        alt="Trade screenshot"
                        className="h-72 w-full rounded-2xl object-cover transition duration-200 hover:scale-[1.015]"
                      />
                    </button>
                    <div className="mt-2 text-xs text-slate-400">Click screenshot to enlarge.</div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(tradeEditForm.images ?? []).map((image, index) => (
                        <button
                          key={image.slice(0, 18) + index}
                          onClick={() => {
                            setActiveTradeImageIndex(index);
                            if (index === activeTradeImageIndex) {
                              setLightboxImageSrc(image);
                              setLightboxZoomed(false);
                            } else {
                              setActiveTradeImageIndex(index);
                            }
                          }}
                          className={`h-16 w-16 overflow-hidden rounded-lg border ${index === activeTradeImageIndex ? "border-white/50" : "border-white/10"}`}
                        >
                          <img src={image} alt="Trade thumbnail" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                    {isTradeEditMode && (
                      <button
                        onClick={() => removeTradeImage(tradeKey(selectedTrade), activeTradeImageIndex)}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove selected image
                      </button>
                    )}
                  </div>
                )}
                
                <div className="mt-6 border-t border-white/5 pt-6">
                  <label className="mb-2 block text-sm font-semibold text-white">Notes for trade</label>
                  <textarea
                    disabled={!isTradeEditMode}
                    value={tradeEditForm.notes ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTradeEditForm(prev => prev ? { ...prev, notes: val } : prev);
                    }}
                    className="w-full rounded-xl border px-3 py-3 text-sm text-white placeholder-slate-400 focus:outline-none min-h-[100px] resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                    style={softPanelStyle}
                    placeholder="Add your notes about this trade here..."
                  />

                  <div className="mt-6 mb-2">
                    <span className="block text-sm font-semibold text-white">Accounts</span>
                    <div className="mt-3 flex flex-col gap-3">
                      {(() => {
                        const selectedIds = (tradeEditForm?.accountId || "").split(',').filter(Boolean);
                        return (accountsLibrary || []).map((group: any, idx: number) => {
                          const groupAccs = group.accounts || [];
                          if (groupAccs.length === 0) return null;
                          const groupIds = groupAccs.map((a: any) => a.id);
                          const allSelectedInGroup = groupIds.length > 0 && groupIds.every((id: string) => selectedIds.includes(id));
                          return (
                            <div key={group.id || `group-${idx}`} className="flex flex-col gap-1 items-start">
                              <span 
                                className={`text-xs font-semibold text-slate-400 capitalize transition-colors select-none ${isTradeEditMode ? "cursor-pointer hover:text-white" : "opacity-60"}`}
                                title={isTradeEditMode ? "Shift-click to select all accounts in this broker" : ""}
                                onClick={(e) => {
                                  if (!isTradeEditMode) return;
                                  if (e.shiftKey) {
                                    let newIds = [...selectedIds];
                                    if (allSelectedInGroup) {
                                      newIds = newIds.filter(id => !groupIds.includes(id));
                                    } else {
                                      const toAdd = groupIds.filter((id: string) => !newIds.includes(id));
                                      newIds.push(...toAdd);
                                    }
                                    setTradeEditForm((prev: any) => prev ? ({ ...prev, accountId: newIds.join(',') }) : prev);
                                  }
                                }}
                              >
                                {group.firmName || group.size || "Unknown Firm"}
                              </span>
                              <div className="flex flex-wrap gap-2 mt-0.5">
                                {groupAccs.map((acc: any) => {
                                  const selected = selectedIds.includes(acc.id);
                                  return (
                                    <button
                                      key={acc.id}
                                      type="button"
                                      disabled={!isTradeEditMode}
                                      onClick={() => {
                                        const newSelection = selected 
                                          ? selectedIds.filter(id => id !== acc.id)
                                          : [...selectedIds, acc.id];
                                        setTradeEditForm((prev: any) => prev ? ({ ...prev, accountId: newSelection.join(',') }) : prev);
                                      }}
                                      className={`rounded-xl border px-3 py-1.5 text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${!isTradeEditMode ? "" : "hover:scale-[1.05]"} ${selected ? "font-medium" : "text-slate-400 hover:text-white"}`}
                                      style={selected ? { background: accentColor, color: getContrastColor(accentColor), borderColor: "transparent" } : { background: hexToRgba(panelTint, 0.35), borderColor: "rgba(255,255,255,0.1)" }}
                                    >
                                      {acc.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                          );
                        })
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              </div>
              )}
            </div>
          </div>
            
          <div className="shrink-0 flex items-center justify-center min-w-[2.5rem] sm:min-w-[3rem]" onClick={(e) => e.stopPropagation()}>
            {hasNext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openTradeModal(tradeKey(trades[currentIndex + 1]));
                }}
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 hover:scale-110 transition-all z-[90]"
              >
                 <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>
        </div>
        );
        })()}
      </div>
    )}

      {lightboxImageSrc && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: hexToRgba(panelTint, 0.9) }}
          onClick={() => {
            setLightboxImageSrc(null);
            setLightboxZoomed(false);
          }}
        >
          <button
            onClick={() => {
              setLightboxImageSrc(null);
              setLightboxZoomed(false);
            }}
            className="absolute right-5 top-5 rounded-2xl border border-white/10 bg-black/20 p-2 text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            <XCircle className="h-6 w-6" />
          </button>
          <img
            src={lightboxImageSrc}
            alt="Trade screenshot enlarged"
            className={`max-h-[90vh] max-w-[92vw] rounded-3xl border border-white/10 object-contain shadow-2xl transition-transform duration-200 ${lightboxZoomed ? "scale-[1.7] cursor-zoom-out" : "scale-100 cursor-zoom-in"}`}
            onClick={(event) => {
              event.stopPropagation();
              setLightboxZoomed((prev) => !prev);
            }}
          />
        </div>
      )}
    </div>
  );
}
