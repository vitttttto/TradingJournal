import React, { useMemo, useState } from "react";
import { type TradeRecord } from "../mockData";
import { getNetPnl } from "../App";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Settings, Plus, Trash2, X, Check } from "lucide-react";
import { getContrastColor } from "../lib/colors";
import { CustomSelect, CustomCombobox } from "./CustomInputs";

export type PlatformAccount = {
  id: string;
  name: string;
  balance: number;
};

export type AccountFirm = {
  id: string;
  firmName: string;
  accounts: PlatformAccount[];
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

const parseBalance = (val: string) => {
  if (!val) return 0;
  const lower = val.toLowerCase().trim();
  if (lower.endsWith('k')) {
    return (parseFloat(lower.replace('k', '')) || 0) * 1000;
  }
  return parseFloat(lower.replace(/,/g, '')) || 0;
};

type Props = {
  trades: TradeRecord[];
  accountsLibrary: any[];
  setAccountsLibrary: (library: any[]) => void;
  onAccountsDeleted?: (accountIds: string[]) => void;
  panelStyle?: React.CSSProperties;
  softPanelStyle?: React.CSSProperties;
  panelTint?: string;
  accentColor?: string;
  onEditTrade?: (key: string) => void;
};

export const AccountsLab = ({ trades, accountsLibrary, setAccountsLibrary, onAccountsDeleted, panelStyle, softPanelStyle, panelTint = "#0f172a", accentColor = "#4f7cff", onEditTrade }: Props) => {
  const [isSettingsMode, setIsSettingsMode] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [newAccountNames, setNewAccountNames] = useState<Record<string, string>>({}); 
  const [newAccountBalances, setNewAccountBalances] = useState<Record<string, string>>({});

  const [selectedFirmId, setSelectedFirmId] = useState<string>("ALL");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Migration from old formats to flattened firm format
  const normalizedLibrary: AccountFirm[] = useMemo(() => {
    if (!accountsLibrary || accountsLibrary.length === 0) return [];
    
    return accountsLibrary.map(item => {
      if (item.size && !item.firmName) {
        return {
          id: Math.random().toString(36).substring(7),
          firmName: "My Firm",
          accounts: item.accounts.map((a: any) => ({ ...a, balance: parseInt(item.size.replace(/k/i, '000')) || 0 }))
        };
      }
      if (item.firmName && item.sizes && !item.accounts) {
        const flattened = item.sizes.flatMap((s: any) => s.accounts.map((a: any) => ({ ...a, balance: parseInt(s.size.replace(/k/i, '000')) || 0})));
        return {
          id: item.id || Math.random().toString(36).substring(7),
          firmName: item.firmName,
          accounts: flattened
        };
      }
      return item;
    });
  }, [accountsLibrary]);

  const allAccountsData = useMemo(() => {
    const validTrades = trades.filter(t => t.accountId && t.accountId.trim() !== "").sort((a, b) => a.soldTimestamp - b.soldTimestamp);
    
    let startingBalance = 0;
    normalizedLibrary.forEach(f => f.accounts.forEach(a => { startingBalance += Number(a.balance) || 0; }));

    let cumulative = 0;
    const chartData = [{
      id: "start",
      index: 0,
      date: "Start",
      pnl: 0,
      equity: startingBalance,
    }];
    
    validTrades.forEach((t, idx) => {
      cumulative += getNetPnl(t);
      chartData.push({
        id: String(t.id || Math.random().toString()),
        index: idx + 1,
        date: new Date(t.soldTimestamp).toLocaleDateString(),
        pnl: getNetPnl(t),
        equity: startingBalance + cumulative,
      });
    });
    
    return {
      name: "All Accounts",
      firmName: "Portfolio Overview",
      balance: startingBalance,
      totalPnl: cumulative,
      chartData,
    };
  }, [trades, normalizedLibrary]);

  const selectedData = useMemo(() => {
    if (selectedFirmId === "ALL") return null;
    
    const firm = normalizedLibrary.find(f => f.id === selectedFirmId);
    if (!firm) return null;

    let targetAccounts = firm.accounts.filter(a => selectedAccountIds.includes(a.id));
    if (targetAccounts.length === 0) {
      targetAccounts = firm.accounts; 
    }

    const targetIds = new Set(targetAccounts.map(a => a.id));
    const startingBalance = targetAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const relevantTrades = trades.filter(t => {
      if (!t.accountId) return false;
      const tIds = t.accountId.split(',');
      return tIds.some(id => targetIds.has(id));
    }).sort((a, b) => a.soldTimestamp - b.soldTimestamp);

    let cumulative = 0;
    const chartData = [{
      id: "start",
      index: 0,
      date: "Start",
      pnl: 0,
      equity: startingBalance,
    }];
    
    relevantTrades.forEach((t, idx) => {
      cumulative += getNetPnl(t);
      chartData.push({
        id: String(t.id || Math.random().toString()),
        index: idx + 1,
        date: new Date(t.soldTimestamp).toLocaleDateString(),
        pnl: getNetPnl(t),
        equity: startingBalance + cumulative,
      });
    });

    const isAllFirm = targetAccounts.length === firm.accounts.length;
    return {
      name: isAllFirm ? `${firm.firmName} (All)` : targetAccounts.map(a => a.name).join(", "),
      firmName: firm.firmName,
      balance: startingBalance,
      totalPnl: cumulative,
      chartData,
    };
  }, [selectedFirmId, selectedAccountIds, normalizedLibrary, trades]);

  const toggleSelectedAccount = (accountId: string) => {
    setSelectedAccountIds(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  const renderChart = (chartData: any[], title: string, subtitle: string, equity: number, netPnl: number) => {
    return (
      <div className="rounded-3xl border p-6 backdrop-blur-2xl flex flex-col w-full" style={panelStyle}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start md:items-center mb-6 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{subtitle}</div>
            <h3 className="text-2xl font-bold text-white leading-tight">{title}</h3>
          </div>
          <div className="sm:text-right shrink-0">
            <div className="text-sm text-slate-400 mb-1">Current Equity</div>
            <div className="text-3xl font-bold text-white tracking-tight">{formatCurrency(equity)}</div>
            <div className={`text-sm font-semibold mt-1 ${netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSignedCurrency(netPnl)} Net P&L
            </div>
          </div>
        </div>

        {chartData.length <= 1 ? (
          <div className="flex-1 min-h-[16rem] flex items-center justify-center text-sm text-slate-500 bg-black/10 rounded-2xl w-full border border-white/5">
            No trades recorded for this view.
          </div>
        ) : (
          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="index" stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(val: number) => [formatSignedCurrency(val), "Equity"]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                <Line 
                  type="stepAfter" 
                  dataKey="equity" 
                  stroke={accentColor} 
                  strokeWidth={2} 
                  dot={false} 
                  activeDot={{ 
                    r: 4, 
                    fill: accentColor, 
                    stroke: "#0f172a", 
                    strokeWidth: 2,
                    onClick: (_, payload: any) => onEditTrade && onEditTrade(payload.payload.id),
                    cursor: onEditTrade ? 'pointer' : 'default'
                  }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  if (isSettingsMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white pl-1">Accounts Settings</h2>
          <button 
            onClick={() => setIsSettingsMode(false)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
          <div className="flex gap-3 max-w-md mb-8">
            <input 
              placeholder="Add a new broker (e.g., Broker1)"
              value={newFirmName}
              onChange={e => setNewFirmName(e.target.value)}
              className="flex-1 rounded-xl border px-4 py-3 outline-none text-white transition-all"
              style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }}
            />
            <button
              disabled={!newFirmName.trim()}
              onClick={() => {
                setAccountsLibrary([...normalizedLibrary, { id: Math.random().toString(36).substring(7), firmName: newFirmName.trim(), accounts: [] }]);
                setNewFirmName("");
              }}
              className="rounded-xl px-5 py-3 font-semibold disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] drop-shadow-[0_0_15px_rgba(var(--accent-color),0.5)] border border-white/20"
              style={{ background: accentColor, color: getContrastColor(accentColor) }}
            >
              Add Broker
            </button>
          </div>

          <div className="space-y-6">
            {normalizedLibrary.map((firm, firmIndex) => (
              <div key={firm.id} className="rounded-2xl border p-5" style={softPanelStyle}>
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-bold text-white">{firm.firmName}</h3>
                  <button 
                    onClick={() => {
                      const newLib = [...normalizedLibrary];
                      const firmToDelete = newLib[firmIndex];
                      if (onAccountsDeleted) onAccountsDeleted(firmToDelete.accounts.map(a => a.id));
                      newLib.splice(firmIndex, 1);
                      setAccountsLibrary(newLib);
                    }}
                    className="text-rose-400 hover:text-rose-300 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 mb-5">
                  {firm.accounts.map((acc, accIdx) => (
                    <div key={acc.id} className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">{acc.name}</span>
                        <span className="text-xs text-slate-400 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                          {formatCurrency(acc.balance || 0)} bal
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const newLib = [...normalizedLibrary];
                          const accountToDelete = newLib[firmIndex].accounts[accIdx];
                          if (onAccountsDeleted) onAccountsDeleted([accountToDelete.id]);
                          newLib[firmIndex].accounts.splice(accIdx, 1);
                          setAccountsLibrary(newLib);
                        }}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input 
                    placeholder="Account Name (e.g. Apex 50k 1)"
                    value={newAccountNames[firm.id] || ""}
                    onChange={(e) => setNewAccountNames(prev => ({ ...prev, [firm.id]: e.target.value }))}
                    className="flex-1 min-w-[200px] rounded-xl border px-3 py-2 text-sm text-white outline-none"
                    style={{ background: hexToRgba(panelTint, 0.4), borderColor: "rgba(255,255,255,0.1)" }}
                  />
                  <div className="relative flex items-center w-[200px]">
                    <CustomCombobox
                      value={newAccountBalances[firm.id] || ""}
                      onChange={(val: string) => setNewAccountBalances((prev: any) => ({ ...prev, [firm.id]: val }))}
                      placeholder="Starting Balance"
                      panelTint={panelTint}
                      accentColor={accentColor}
                      options={[
                        { value: '10k', label: '10,000' },
                        { value: '25k', label: '25,000' },
                        { value: '50k', label: '50,000' },
                        { value: '100k', label: '100,000' },
                        { value: '150k', label: '150,000' },
                        { value: '200k', label: '200,000' },
                      ]}
                      className="w-full"
                    />
                  </div>
                  <button
                    disabled={!newAccountNames[firm.id]?.trim()}
                    onClick={() => {
                      const newLib = [...normalizedLibrary];
                      newLib[firmIndex].accounts.push({
                        id: Math.random().toString(36).substring(7),
                        name: newAccountNames[firm.id].trim(),
                        balance: parseBalance(newAccountBalances[firm.id] || "0")
                      });
                      setAccountsLibrary(newLib);
                      setNewAccountNames(prev => ({ ...prev, [firm.id]: "" }));
                      setNewAccountBalances(prev => ({ ...prev, [firm.id]: "" }));
                    }}
                    className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] drop-shadow-[0_0_15px_rgba(var(--accent-color),0.5)] border border-white/20"
                    style={{ background: accentColor, color: getContrastColor(accentColor) }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeFirm = normalizedLibrary.find(f => f.id === selectedFirmId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white pl-1">Accounts</h2>
        <button 
          onClick={() => setIsSettingsMode(true)}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {normalizedLibrary.length === 0 ? (
        <div className="rounded-3xl border p-12 backdrop-blur-2xl text-center text-slate-400" style={panelStyle}>
          <div className="flex flex-col items-center justify-center gap-4">
            <h3 className="text-lg">No accounts configured.</h3>
            <button 
              onClick={() => setIsSettingsMode(true)}
              className="rounded-xl px-6 py-3 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] drop-shadow-[0_0_15px_rgba(var(--accent-color),0.5)] border border-white/20"
              style={{ background: accentColor, color: getContrastColor(accentColor) }}
            >
              Add Your First Account
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {renderChart(
            allAccountsData.chartData, 
            allAccountsData.name, 
            allAccountsData.firmName, 
            allAccountsData.balance + allAccountsData.totalPnl, 
            allAccountsData.totalPnl
          )}

          <div className="rounded-3xl border p-6 backdrop-blur-2xl flex flex-col w-full" style={panelStyle}>
             <div className="flex flex-col gap-4 mb-6">
               <h3 className="text-base font-semibold text-white">Custom View</h3>
               <div className="flex flex-col gap-3">
                 <CustomSelect
                   value={selectedFirmId}
                   onChange={(val: string) => {
                     setSelectedFirmId(val);
                     setSelectedAccountIds([]);
                   }}
                   options={[
                     { value: "ALL", label: "Select a broker..." },
                     ...normalizedLibrary.map(f => ({ value: f.id, label: f.firmName }))
                   ]}
                   panelTint={panelTint}
                   accentColor={accentColor}
                   className="w-full max-w-[280px]"
                 />
                 
                 {activeFirm && activeFirm.accounts.length > 0 && (
                   <div className="flex flex-wrap gap-2">
                     {activeFirm.accounts.map(acc => {
                       const isSelected = selectedAccountIds.includes(acc.id) || selectedAccountIds.length === 0;
                       return (
                         <button
                           key={acc.id}
                           onClick={() => toggleSelectedAccount(acc.id)}
                           className={`rounded-xl px-3 py-1.5 text-xs transition-colors border ${isSelected ? 'border-transparent font-medium' : 'text-slate-400 border-white/10 bg-transparent hover:text-white'}`}
                           style={isSelected ? { background: accentColor, color: getContrastColor(accentColor) } : {}}
                         >
                           {acc.name}
                         </button>
                       );
                     })}
                   </div>
                 )}
               </div>
             </div>

             {selectedData ? (
               <div className="border-t border-white/5 pt-6">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start md:items-center gap-4 mb-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{selectedData.firmName}</div>
                      <h3 className="text-xl font-bold text-white">{selectedData.name}</h3>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <div className="text-sm text-slate-400 mb-1">Current Equity</div>
                      <div className="text-2xl font-bold text-white tracking-tight">{formatCurrency(selectedData.balance + selectedData.totalPnl)}</div>
                      <div className={`text-sm font-semibold mt-1 ${selectedData.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatSignedCurrency(selectedData.totalPnl)} Net P&L
                      </div>
                    </div>
                 </div>
                 
                 {selectedData.chartData.length <= 1 ? (
                    <div className="flex-1 min-h-[16rem] flex items-center justify-center text-sm text-slate-500 bg-black/10 rounded-2xl w-full border border-white/5">
                      No trades recorded for this view.
                    </div>
                 ) : (
                    <div className="h-56 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedData.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="index" stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                            itemStyle={{ color: "#fff" }}
                            formatter={(val: number) => [formatSignedCurrency(val), "Equity"]}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label}
                          />
                          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                          <Line 
                            type="stepAfter" 
                            dataKey="equity" 
                            stroke={accentColor} 
                            strokeWidth={2} 
                            dot={false} 
                            activeDot={{ 
                              r: 4, 
                              fill: accentColor, 
                              stroke: "#0f172a", 
                              strokeWidth: 2,
                              onClick: (_, payload: any) => onEditTrade && onEditTrade(payload.payload.id),
                              cursor: onEditTrade ? 'pointer' : 'default'
                            }} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                 )}
               </div>
             ) : (
               <div className="flex-1 min-h-[10rem] mt-4 flex items-center justify-center text-sm text-slate-500 bg-black/10 rounded-2xl w-full border border-white/5">
                 Select a broker to view custom equity curve.
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
