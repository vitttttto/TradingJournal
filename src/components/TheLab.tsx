import React, { useMemo, useState, useEffect } from "react";
import { Info, Settings } from "lucide-react";
import { type TradeRecord } from "../mockData";
import { getNetPnl, getTradingSession } from "../App";

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

type Props = {
  trades: TradeRecord[];
  breakevenFloor: number;
  breakevenCeiling: number;
  panelStyle?: React.CSSProperties;
  softPanelStyle?: React.CSSProperties;
  panelTint?: string;
  labState?: any[];
  setLabState?: (val: any[]) => void;
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

const getTradeStatus = (pnl: number, low: number, high: number) => {
  const floor = Math.min(low, high);
  const ceiling = Math.max(low, high);
  if (pnl < floor) return "loss" as const;
  if (pnl > ceiling) return "win" as const;
  return "breakeven" as const;
};

type TagState = "not_applied" | "applied" | "neutral";

type ColumnState = {
  selectedConfluences: Record<string, TagState>;
  selectedMistakes: Record<string, TagState>;
  selectedEntries: Record<string, TagState>;
  selectedSessions: Record<string, TagState>;
  selectedOutcomes: Record<string, TagState>;
  selectedSymbol: string;
  hiddenStats: string[];
};

const getNextState = (current: TagState): TagState => {
  if (current === "neutral") return "applied";
  if (current === "applied") return "not_applied";
  return "neutral";
};

const getState = (dict: Record<string, TagState>, key: string, defaultState: TagState = "not_applied"): TagState => dict[key] ?? defaultState;

export const TheLab = ({ trades, breakevenFloor, breakevenCeiling, panelStyle, softPanelStyle, panelTint = "#0f172a", labState = [], setLabState }: Props) => {
  const initialLabState: ColumnState = { selectedConfluences: {}, selectedMistakes: {}, selectedEntries: {}, selectedSessions: {}, selectedOutcomes: {}, selectedSymbol: "", hiddenStats: [] };
  
  const [columns, setColumns] = useState<ColumnState[]>(() => {
    if (labState && labState.length > 0) {
      // Basic validation to ensure it matches ColumnState structure loosely
      return labState.map((col: any) => ({
        ...initialLabState,
        ...col
      }));
    }
    return [initialLabState, initialLabState];
  });
  
  useEffect(() => {
    if (setLabState) {
      setLabState(columns);
    }
  }, [columns, setLabState]);

  const [isStatsGearOpenForCol, setIsStatsGearOpenForCol] = useState<number | null>(null);

  // Extract all unique tags and symbols
  const allEntries = useMemo(() => {
    const tags = new Set<string>();
    trades.forEach(t => t.entryTags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [trades]);

  const allConfluences = useMemo(() => {
    const tags = new Set<string>();
    trades.forEach(t => t.confluenceTags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [trades]);

  const allMistakes = useMemo(() => {
    const tags = new Set<string>();
    trades.forEach(t => t.mistakeTags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [trades]);

  const allSessions = useMemo(() => {
    const sessions = new Set<string>();
    trades.forEach(t => {
      const s = getTradingSession(t.boughtTimestamp);
      if (s) sessions.add(s);
    });
    return Array.from(sessions).sort();
  }, [trades]);

  const allSymbols = useMemo(() => {
    const symbols = new Set<string>();
    trades.forEach(t => {
      if (t.symbol) symbols.add(t.symbol);
    });
    return Array.from(symbols).sort();
  }, [trades]);

  const getStats = (col: ColumnState) => {
    const filteredTrades = trades.filter(trade => {
      // For each tag type, check all possible tags:
      // If getState is "applied", the tag MUST be present.
      // If getState is "not_applied", the tag MUST NOT be present.
      // If getState is "neutral", we don't care.
      let valid = true;

      // entries
      for (const tag of allEntries) {
        const state = getState(col.selectedEntries, tag, "neutral");
        const has = trade.entryTags?.includes(tag) ?? false;
        if (state === "applied" && !has) valid = false;
        if (state === "not_applied" && has) valid = false;
      }
      // confluences
      for (const tag of allConfluences) {
        const state = getState(col.selectedConfluences, tag, "neutral");
        const has = trade.confluenceTags?.includes(tag) ?? false;
        if (state === "applied" && !has) valid = false;
        if (state === "not_applied" && has) valid = false;
      }
      // mistakes
      for (const tag of allMistakes) {
        const state = getState(col.selectedMistakes, tag, "neutral");
        const has = trade.mistakeTags?.includes(tag) ?? false;
        if (state === "applied" && !has) valid = false;
        if (state === "not_applied" && has) valid = false;
      }
      // sessions
      const session = getTradingSession(trade.boughtTimestamp);
      for (const sess of allSessions) {
        const state = getState(col.selectedSessions, sess, "neutral");
        const has = session === sess;
        if (state === "applied" && !has) valid = false;
        if (state === "not_applied" && has) valid = false;
      }
      // outcomes
      const outcome = getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling);
      const allOutcomes = ["win", "loss", "breakeven"];
      for (const out of allOutcomes) {
        const state = getState(col.selectedOutcomes, out, "neutral");
        const has = outcome === out;
        if (state === "applied" && !has) valid = false;
        if (state === "not_applied" && has) valid = false;
      }

      if (col.selectedSymbol !== "" && trade.symbol !== col.selectedSymbol) valid = false;

      return valid;
    });

    const winningTrades = filteredTrades.filter((trade) => getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "win");
    const losingTrades = filteredTrades.filter((trade) => getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "loss");
    
    const totalPnL = filteredTrades.reduce((sum, trade) => sum + getNetPnl(trade), 0);
    const grossProfit = winningTrades.reduce((sum, trade) => sum + getNetPnl(trade), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + getNetPnl(trade), 0));
    const decisiveCount = winningTrades.length + losingTrades.length;
    
    const winrate = decisiveCount ? (winningTrades.length / decisiveCount) * 100 : 0;
    const avgWinningTrade = winningTrades.length ? grossProfit / winningTrades.length : 0;
    const avgLosingTrade = losingTrades.length ? grossLoss / losingTrades.length : 0;
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;
    const avgTradePnL = filteredTrades.length ? totalPnL / filteredTrades.length : 0;
    
    // Calculate Average MFE
    const tradesWithMfe = filteredTrades.filter(t => t.maxPointsProfit !== undefined);
    const avgMfe = tradesWithMfe.length ? tradesWithMfe.reduce((sum, t) => sum + (t.maxPointsProfit || 0), 0) / tradesWithMfe.length : undefined;

    return {
      totalTrades: filteredTrades.length,
      totalPnL,
      winrate,
      avgWinningTrade,
      avgLosingTrade,
      profitFactor,
      avgTradePnL,
      grossProfit,
      grossLoss,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      avgMfe,
    };
  };

  const colStats = useMemo(() => columns.map(c => getStats(c)), [trades, columns, breakevenFloor, breakevenCeiling]);

  const toggleTag = (colIndex: number, tag: string, type: 'confluence' | 'mistake' | 'entry' | 'session' | 'outcome', isShiftKey: boolean = false, isCtrlKey: boolean = false) => {
    setColumns(prev => {
      const newCols = [...prev];
      const newState = { ...newCols[colIndex] };
      
      const updateTagsState = (
        currentTags: Record<string, TagState>, 
        allTagsList: string[]
      ) => {
        if (isCtrlKey) {
          const nextState: Record<string, TagState> = {};
          for (const t of allTagsList) {
            nextState[t] = "neutral";
          }
          return nextState;
        } else if (isShiftKey) {
          const nextState: Record<string, TagState> = {};
          for (const t of allTagsList) {
            nextState[t] = t === tag ? "applied" : "not_applied";
          }
          return nextState;
        } else {
          return { ...currentTags, [tag]: getNextState(getState(currentTags, tag, "neutral")) };
        }
      };

      if (type === 'entry') {
        newState.selectedEntries = updateTagsState(prev[colIndex].selectedEntries, allEntries);
      } else if (type === 'confluence') {
        newState.selectedConfluences = updateTagsState(prev[colIndex].selectedConfluences, allConfluences);
      } else if (type === 'mistake') {
        newState.selectedMistakes = updateTagsState(prev[colIndex].selectedMistakes, allMistakes);
      } else if (type === 'session') {
        newState.selectedSessions = updateTagsState(prev[colIndex].selectedSessions, allSessions);
      } else if (type === 'outcome') {
        newState.selectedOutcomes = updateTagsState(prev[colIndex].selectedOutcomes, ["win", "loss", "breakeven"]);
      }
      newCols[colIndex] = newState;
      return newCols;
    });
  };

  const setSymbol = (colIndex: number, symbol: string) => {
    setColumns(prev => {
      const newCols = [...prev];
      newCols[colIndex] = { ...newCols[colIndex], selectedSymbol: symbol };
      return newCols;
    });
  };

  const resetColumn = (colIndex: number) => {
    setColumns(prev => {
      const newCols = [...prev];
      newCols[colIndex] = initialLabState;
      return newCols;
    });
  };

  const removeColumn = (colIndex: number) => {
    setColumns(prev => prev.filter((_, i) => i !== colIndex));
  };

  const toggleHiddenStat = (colIndex: number, statId: string) => {
    setColumns(prev => {
      const newCols = [...prev];
      const hidden = newCols[colIndex].hiddenStats || [];
      newCols[colIndex] = {
        ...newCols[colIndex],
        hiddenStats: hidden.includes(statId) ? hidden.filter(id => id !== statId) : [...hidden, statId]
      };
      return newCols;
    });
  };

  const renderColumn = (colIndex: number, colState: ColumnState, stats: ReturnType<typeof getStats>) => {
    const availableStats = [
      { id: "totalPnL", label: "Total P&L", value: formatSignedCurrency(stats.totalPnL), tone: stats.totalPnL >= 0 ? "text-emerald-300" : "text-rose-300" },
      { id: "winrate", label: "Winrate", value: `${stats.winrate.toFixed(1)}%`, tone: "text-slate-200" },
      { id: "totalTrades", label: "Total Trades", value: String(stats.totalTrades), tone: "text-white" },
      { id: "avgWinningTrade", label: "Avg Winning Trade", value: formatSignedCurrency(stats.avgWinningTrade), tone: "text-emerald-300" },
      { id: "avgLosingTrade", label: "Avg Losing Trade", value: formatSignedCurrency(stats.avgLosingTrade), tone: "text-rose-300" },
      { id: "profitFactor", label: "Profit Factor", value: stats.profitFactor === 999 ? "∞" : stats.profitFactor.toFixed(2), tone: "text-violet-200" },
      { id: "avgTradePnL", label: "Avg Trade P&L", value: formatSignedCurrency(stats.avgTradePnL), tone: stats.avgTradePnL >= 0 ? "text-emerald-300" : "text-rose-300" },
      { id: "grossProfit", label: "Gross Profit", value: formatSignedCurrency(stats.grossProfit), tone: "text-emerald-300" },
      { id: "grossLoss", label: "Gross Loss", value: formatSignedCurrency(stats.grossLoss), tone: "text-rose-300" },
      { id: "winningTrades", label: "Winning Trades", value: String(stats.winningTrades), tone: "text-emerald-300" },
      { id: "losingTrades", label: "Losing Trades", value: String(stats.losingTrades), tone: "text-rose-300" },
      { id: "avgMfe", label: "Average MFE", value: stats.avgMfe !== undefined ? `${stats.avgMfe.toFixed(2)} pts` : 'N/A', tone: "text-sky-300", tooltip: "Maximum Favorable Excursion calculates the average maximum points of profit recorded per trade", solidBackground: true },
    ];

    const getTagClassName = (state: TagState) => {
      if (state === "applied") return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300';
      if (state === "not_applied") return 'bg-rose-500/20 border-rose-500/50 text-rose-300';
      return 'hover:bg-white/5 text-slate-400 border-white/10 opacity-50'; // neutral
    };

    return (
      <div key={colIndex} className="space-y-6">
        <div className="rounded-3xl border p-5 relative" style={panelStyle}>
          <div className="flex items-center justify-between mb-4 pr-20">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-white">Column {colIndex + 1} Filters</h3>
              <div className="group relative flex items-center justify-center">
                <Info className="w-4 h-4 text-slate-400 cursor-help transition-colors group-hover:text-white" />
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 hidden w-64 rounded-xl border border-white/10 p-3 text-xs text-slate-300 shadow-2xl group-hover:block z-50" style={{ background: panelTint ? hexToRgba(panelTint, 0.95) : undefined}}>
                  Click tags to toggle state (Gray &rarr; Green &rarr; Red):
                  <ul className="mt-2 space-y-1.5">
                    <li><span className="inline-block w-3 h-3 rounded-full bg-white/10 border border-white/20 mr-1.5"></span><b>Neutral (Gray):</b> Filter bypassed.</li>
                    <li><span className="inline-block w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50 mr-1.5"></span><b>Applied (Green):</b> Trade MUST have this tag.</li>
                    <li><span className="inline-block w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50 mr-1.5"></span><b>Not Applied (Red):</b> Trade MUST NOT have this tag.</li>
                  </ul>
                  <div className="mt-3 pt-3 border-t border-slate-700 space-y-1 text-[10px]">
                    <p><b>Shift+Click:</b> Select only this tag.</p>
                    <p><b>Ctrl+Click:</b> Reset all tags to neutral.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <button onClick={() => resetColumn(colIndex)} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 transition" title="Reset Filters"><span className="text-xs font-semibold px-2">Reset</span></button>
            {columns.length > 1 && (
              <button onClick={() => removeColumn(colIndex)} className="p-1.5 rounded-xl hover:bg-rose-500/20 text-rose-400 transition" title="Remove Column"><span className="text-xs font-semibold px-2">✕</span></button>
            )}
          </div>
          
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Symbol</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSymbol(colIndex, "")}
                className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${colState.selectedSymbol === "" ? 'text-white' : 'hover:bg-white/5 text-slate-300'}`}
                style={colState.selectedSymbol === "" ? { background: hexToRgba(panelTint, 0.5), borderColor: hexToRgba(panelTint, 0.8) } : softPanelStyle}
              >
                All Symbols
              </button>
              {allSymbols.map(sym => (
                <button
                  key={sym}
                  onClick={() => setSymbol(colIndex, sym)}
                  className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${colState.selectedSymbol === sym ? 'text-white' : 'hover:bg-white/5 text-slate-300'}`}
                  style={colState.selectedSymbol === sym ? { background: hexToRgba(panelTint, 0.5), borderColor: hexToRgba(panelTint, 0.8) } : softPanelStyle}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Trade Outcome</h4>
            <div className="flex flex-wrap gap-2">
              {["win", "loss", "breakeven"].map(tag => {
                const state = getState(colState.selectedOutcomes, tag, "neutral");
                return (
                  <button
                    key={tag}
                    onClick={(e) => toggleTag(colIndex, tag, 'outcome', e.shiftKey, e.ctrlKey || e.metaKey)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition-colors uppercase tracking-[0.1em] ${getTagClassName(state)}`}
                    style={state === 'neutral' ? softPanelStyle : undefined}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Sessions</h4>
            <div className="flex flex-wrap gap-2">
              {allSessions.map(tag => {
                const state = getState(colState.selectedSessions, tag, "neutral");
                return (
                  <button
                    key={tag}
                    onClick={(e) => toggleTag(colIndex, tag, 'session', e.shiftKey, e.ctrlKey || e.metaKey)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${getTagClassName(state)}`}
                    style={state === 'neutral' ? softPanelStyle : undefined}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Entries</h4>
            <div className="flex flex-wrap gap-2">
              {allEntries.map(tag => {
                const state = getState(colState.selectedEntries, tag, "neutral");
                return (
                  <button
                    key={tag}
                    onClick={(e) => toggleTag(colIndex, tag, 'entry', e.shiftKey, e.ctrlKey || e.metaKey)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${getTagClassName(state)}`}
                    style={state === 'neutral' ? softPanelStyle : undefined}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Confluences</h4>
            <div className="flex flex-wrap gap-2">
              {allConfluences.map(tag => {
                const state = getState(colState.selectedConfluences, tag, "neutral");
                return (
                  <button
                    key={tag}
                    onClick={(e) => toggleTag(colIndex, tag, 'confluence', e.shiftKey, e.ctrlKey || e.metaKey)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${getTagClassName(state)}`}
                    style={state === 'neutral' ? softPanelStyle : undefined}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Mistakes</h4>
            <div className="flex flex-wrap gap-2">
              {allMistakes.map(tag => {
                const state = getState(colState.selectedMistakes, tag, "neutral");
                return (
                  <button
                    key={tag}
                    onClick={(e) => toggleTag(colIndex, tag, 'mistake', e.shiftKey, e.ctrlKey || e.metaKey)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${getTagClassName(state)}`}
                    style={state === 'neutral' ? softPanelStyle : undefined}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border p-5" style={panelStyle}>
          <div className="flex items-center justify-between mb-4 relative">
            <h3 className="text-xl font-semibold text-white">Stats</h3>
            <button
              onClick={() => setIsStatsGearOpenForCol(isStatsGearOpenForCol === colIndex ? null : colIndex)}
              className="text-slate-400 hover:text-white transition-colors p-1"
              title="Customize visible stats"
            >
              <Settings className="h-4 w-4" />
            </button>
            {isStatsGearOpenForCol === colIndex && (
              <div 
                className="absolute top-full right-0 mt-2 w-56 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-2"
                style={{ background: panelTint ? hexToRgba(panelTint, 0.95) : undefined, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Visible Stats</span>
                  <button onClick={() => setIsStatsGearOpenForCol(null)} className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded-lg border border-white/10 hover:bg-white/10">Done</button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {availableStats.map((s) => {
                    const isHidden = (colState.hiddenStats || []).includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-xl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/20"
                          onChange={() => toggleHiddenStat(colIndex, s.id)}
                        />
                        <span className="text-sm text-slate-200">{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-3">
            {availableStats.filter(s => !(colState.hiddenStats || []).includes(s.id)).map((stat) => (
              <div 
                key={stat.id} 
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${!stat.solidBackground ? 'hover:bg-white/5' : ''}`} 
                style={stat.solidBackground ? { background: panelTint, borderColor: 'rgba(255,255,255,0.1)' } : softPanelStyle}
                title={stat.tooltip}
              >
                <div className="flex items-center gap-1.5 relative group">
                  <span className="text-slate-300">{stat.label}</span>
                  {stat.tooltip && (
                    <>
                      <Info className="h-3 w-3 text-slate-500 cursor-help" />
                      <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-48 rounded-lg border border-slate-700 p-2 text-[10px] text-slate-300 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 normal-case tracking-normal" style={{ background: hexToRgba(panelTint || '#0f172a', 0.95) }}>
                        {stat.tooltip}
                      </div>
                    </>
                  )}
                </div>
                <span className={`font-semibold ${stat.tone}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-end mb-4">
        <button onClick={() => setColumns(prev => [...prev, initialLabState])} className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-semibold text-sm rounded-2xl transition">+ Add Column</button>
      </div>
      <div className={`grid gap-6 ${columns.length === 1 ? 'grid-cols-1' : columns.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {columns.map((col, idx) => renderColumn(idx, col, colStats[idx]))}
      </div>
    </div>
  );
};
