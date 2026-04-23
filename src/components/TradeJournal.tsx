import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type TradeRecord } from "../mockData";

type Props = {
  trades: TradeRecord[];
  breakevenFloor: number;
  breakevenCeiling: number;
  panelStyle?: React.CSSProperties;
  softPanelStyle?: React.CSSProperties;
  panelTint?: string;
  onEditTrade?: (tradeKey: string, isEdit?: boolean) => void;
  getTradingSession: (ts: number | null | undefined) => string | null;
  getSessionTagStyle: (session: string) => string;
  onDayClick?: (dayKey: string) => void;
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

const toDayKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getTradeStatus = (pnl: number, low: number, high: number) => {
  const floor = Math.min(low, high);
  const ceiling = Math.max(low, high);
  if (pnl < floor) return "loss" as const;
  if (pnl > ceiling) return "win" as const;
  return "breakeven" as const;
};

export const TradeJournal = ({ trades, breakevenFloor, breakevenCeiling, panelStyle, softPanelStyle, panelTint = "#0f172a", onEditTrade, getTradingSession, getSessionTagStyle, onDayClick }: Props) => {
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const daySummaries = useMemo(() => {
    const grouped = trades.reduce<Record<string, TradeRecord[]>>((acc, trade) => {
      const dayKey = toDayKey(trade.soldTimestamp);
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(trade);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([dayKey, dayTrades]) => {
        const totalTrades = dayTrades.length;
        const wins = dayTrades.filter((trade) => getTradeStatus(trade.pnl, breakevenFloor, breakevenCeiling) === "win").length;
        const losses = dayTrades.filter((trade) => getTradeStatus(trade.pnl, breakevenFloor, breakevenCeiling) === "loss").length;
        const grossPnL = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const totalProfit = dayTrades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
        const totalLoss = Math.abs(dayTrades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
        const decisiveCount = wins + losses;
        const profitFactor = totalLoss === 0 ? (totalProfit > 0 ? 999 : 0) : totalProfit / totalLoss;
        const winrate = decisiveCount ? (wins / decisiveCount) * 100 : 0;

        return {
          dayKey,
          date: new Date(`${dayKey}T00:00:00`),
          totalTrades,
          wins,
          losses,
          grossPnL,
          totalProfit,
          totalLoss,
          winrate,
          profitFactor,
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [trades, breakevenFloor, breakevenCeiling]);

  const totalPages = Math.max(1, Math.ceil(daySummaries.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedDays = daySummaries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDay = (dayKey: string) => {
    if (onDayClick) {
      onDayClick(dayKey);
      return;
    }
    setExpandedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  return (
    <div className="space-y-5">
      {paginatedDays.length === 0 ? (
        <div className="rounded-3xl border p-6 text-sm text-slate-300" style={panelStyle}>
          No trade journal days yet.
        </div>
      ) : (
        paginatedDays.map((day) => (
          <div key={day.dayKey} className="rounded-3xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl" style={panelStyle}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4 cursor-pointer" onClick={() => toggleDay(day.dayKey)}>
              <h3 className="text-lg font-semibold text-white sm:text-xl">
                {day.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
              </h3>
              <span className="text-xs text-slate-400">{onDayClick ? "View trades" : (expandedDays[day.dayKey] ? "Collapse trades" : "Expand trades")}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6 cursor-pointer" onClick={() => toggleDay(day.dayKey)}>
              {[
                { label: "Total Trades", value: String(day.totalTrades), tone: "text-white" },
                { label: "Winrate", value: `${day.winrate.toFixed(1)}%`, tone: "text-slate-200" },
                { label: "Gross P&L", value: formatSignedCurrency(day.grossPnL), tone: day.grossPnL >= 0 ? "text-emerald-300" : "text-rose-300" },
                { 
                  label: "Net P&L", 
                  value: formatSignedCurrency(day.grossPnL - trades.filter(t => toDayKey(t.soldTimestamp) === day.dayKey).reduce((acc, t) => acc + (t.commission || 0), 0)), 
                  tone: (day.grossPnL - trades.filter(t => toDayKey(t.soldTimestamp) === day.dayKey).reduce((acc, t) => acc + (t.commission || 0), 0)) >= 0 ? "text-emerald-300" : "text-rose-300" 
                },
                { label: "Winning Trades", value: String(day.wins), tone: "text-emerald-300" },
                { label: "Losing Trades", value: String(day.losses), tone: "text-rose-300" },
                { label: "Total Win", value: formatSignedCurrency(day.totalProfit), tone: "text-emerald-300" },
                { label: "Total Loss", value: formatSignedCurrency(day.totalLoss), tone: "text-rose-300" },
                { label: "Profit Factor", value: day.profitFactor === 999 ? "∞" : day.profitFactor.toFixed(2), tone: "text-violet-200" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border p-3 transition-transform duration-200 hover:-translate-y-0.5" style={softPanelStyle}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{metric.label}</div>
                  <div className={`mt-2 text-lg font-semibold ${metric.tone}`}>{metric.value}</div>
                </div>
              ))}
            </div>

            {expandedDays[day.dayKey] && (
              <div className="mt-5 space-y-3 pt-4 border-t border-white/8">
                <h4 className="text-sm font-semibold tracking-wider text-slate-300 uppercase">Day Trades</h4>
                <div className="space-y-2">
                  {trades.filter(t => toDayKey(t.soldTimestamp) === day.dayKey).map((trade, idx) => (
                    <div
                      key={idx}
                      onClick={() => onEditTrade && onEditTrade(`${trade.symbol}-${trade.buyFillId || 'id-0-b'}-${trade.sellFillId || 'id-0-s'}-${trade.boughtTimestamp}-${trade.soldTimestamp}`)}
                      className={`flex items-center justify-between p-3 rounded-2xl border text-sm transition ${onEditTrade ? 'cursor-pointer hover:bg-white/5 hover:scale-[1.01] hover:-translate-y-0.5' : ''}`}
                      style={softPanelStyle}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-white">{trade.symbol}</span>
                        <span className={`text-xs uppercase px-2 py-0.5 rounded-xl border border-white/10 ${trade.direction === "short" ? "bg-white/5 text-slate-100" : "bg-white/5 text-slate-100"}`}>{trade.direction === "short" ? "SHORT" : "LONG"}</span>
                        <span className={`text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border ${trade.pnl >= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
                          {getTradeStatus ? getTradeStatus(trade.pnl, breakevenFloor, breakevenCeiling) : (trade.pnl > 0 ? "WIN" : trade.pnl < 0 ? "LOSS" : "BREAKEVEN")}
                        </span>
                        {trade.boughtTimestamp && getTradingSession && getTradingSession(trade.boughtTimestamp) && (
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getSessionTagStyle && getSessionTagStyle(getTradingSession(trade.boughtTimestamp)!)}`}>
                            {getTradingSession(trade.boughtTimestamp)}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 ml-2">Qty: {trade.qty}</span>
                      </div>
                      <span className={`font-semibold ${trade.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatSignedCurrency(trade.pnl)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 hover:-translate-y-0.5"
            style={softPanelStyle}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <div className="text-sm text-slate-300">Page <span className="font-semibold text-white">{currentPage}</span> of <span className="font-semibold text-white">{totalPages}</span></div>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 hover:-translate-y-0.5"
            style={softPanelStyle}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-slate-300">
          <span>Days shown</span>
          <select
            value={itemsPerPage}
            onChange={(event) => {
              setItemsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}
            className="rounded-2xl border bg-transparent px-3 py-2 text-sm text-white outline-none"
            style={softPanelStyle}
          >
            <option style={{ background: panelTint }} value={10}>10</option>
            <option style={{ background: panelTint }} value={20}>20</option>
            <option style={{ background: panelTint }} value={30}>30</option>
          </select>
        </div>
      </div>
    </div>
  );
};
