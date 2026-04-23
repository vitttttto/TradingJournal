import React, { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { type TradeRecord } from "../mockData";
import { getNetPnl } from "../App";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

type Props = {
  trades: TradeRecord[];
  breakevenFloor: number;
  breakevenCeiling: number;
  panelStyle?: React.CSSProperties;
  softPanelStyle?: React.CSSProperties;
  panelTint?: string;
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
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(" ");
};

const toDayKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const toMonthKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getTradeStatus = (pnl: number, low: number, high: number) => {
  const floor = Math.min(low, high);
  const ceiling = Math.max(low, high);
  if (pnl < floor) return "loss" as const;
  if (pnl > ceiling) return "win" as const;
  return "breakeven" as const;
};

export const Reports = ({ trades, breakevenFloor, breakevenCeiling, panelStyle, softPanelStyle, panelTint = "#0f172a" }: Props) => {
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  const stats = useMemo(() => {
    const winningTrades = trades.filter((trade) => getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "win");
    const losingTrades = trades.filter((trade) => getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "loss");
    const breakevenTrades = trades.filter((trade) => getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "breakeven");
    const totalPnL = trades.reduce((sum, trade) => sum + getNetPnl(trade), 0);
    const totalFees = 0;
    const totalCommissions = trades.reduce((sum, trade) => sum + (trade.commission || 0), 0);
    const grossProfit = winningTrades.reduce((sum, trade) => sum + getNetPnl(trade), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + getNetPnl(trade), 0));
    const decisiveCount = winningTrades.length + losingTrades.length;

    const dayMap = new Map<string, number>();
    trades.forEach((trade) => {
      const key = toDayKey(trade.soldTimestamp);
      dayMap.set(key, (dayMap.get(key) ?? 0) + getNetPnl(trade));
    });

    const monthMap = new Map<string, number>();
    trades.forEach((trade) => {
      const key = toMonthKey(trade.soldTimestamp);
      monthMap.set(key, (monthMap.get(key) ?? 0) + getNetPnl(trade));
    });

    const allDurations = trades.map((trade) => trade.duration).filter((value) => Number.isFinite(value) && value >= 0);
    const winningDurations = winningTrades.map((trade) => trade.duration).filter((value) => Number.isFinite(value) && value >= 0);
    const losingDurations = losingTrades.map((trade) => trade.duration).filter((value) => Number.isFinite(value) && value >= 0);

    const sortedDays = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const winningDays = sortedDays.filter(([, pnl]) => pnl > 0).length;
    const losingDays = sortedDays.filter(([, pnl]) => pnl < 0).length;
    const avgDailyPnL = sortedDays.length ? totalPnL / sortedDays.length : 0;
    const largestProfitableDay = sortedDays.length ? [...sortedDays].sort((a, b) => b[1] - a[1])[0] : null;
    const largestLosingDay = sortedDays.length ? [...sortedDays].sort((a, b) => a[1] - b[1])[0] : null;
    const bestMonth = monthMap.size ? [...monthMap.entries()].sort((a, b) => b[1] - a[1])[0] : null;
    const lowestMonth = monthMap.size ? [...monthMap.entries()].sort((a, b) => a[1] - b[1])[0] : null;
    const averageMonth = monthMap.size ? Array.from(monthMap.values()).reduce((sum, value) => sum + value, 0) / monthMap.size : 0;

    let noTradeDays = 0;
    if (trades.length) {
      const minDate = new Date(Math.min(...trades.map((trade) => trade.soldTimestamp)));
      const maxDate = new Date(Math.max(...trades.map((trade) => trade.soldTimestamp)));
      const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
      while (cursor <= end) {
        const day = cursor.getDay();
        const include = excludeWeekends ? day !== 0 && day !== 6 : true;
        if (include) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          if (!dayMap.has(key)) noTradeDays += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return {
      overview: {
        bestMonth,
        lowestMonth,
        averageMonth,
        averageDay: avgDailyPnL,
        biggestDay: largestProfitableDay,
        lowestDay: largestLosingDay,
      },
      allTime: {
        totalPnL,
        totalTrades: trades.length,
        avgWinningTrade: winningTrades.length ? grossProfit / winningTrades.length : 0,
        avgLosingTrade: losingTrades.length ? losingTrades.reduce((sum, trade) => sum + getNetPnl(trade), 0) / losingTrades.length : 0,
        numberOfWinning: winningTrades.length,
        numberOfLosing: losingTrades.length,
        breakevenTrades: breakevenTrades.length,
        breakevenPct: trades.length ? (breakevenTrades.length / trades.length) * 100 : 0,
        winrateWithoutBE: decisiveCount ? (winningTrades.length / decisiveCount) * 100 : 0,
        winrateWithBE: trades.length ? (winningTrades.length / trades.length) * 100 : 0,
        totalCommissions,
        totalFees,
        avgTradePnL: trades.length ? totalPnL / trades.length : 0,
        profitFactor: grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss,
        totalTradingDays: sortedDays.length,
        noTradeDays,
        winningDays,
        losingDays,
        avgDailyPnL,
        largestProfitableDay,
        largestLosingDay,
        monthWithMaxPnL: bestMonth,
        averageHoldTime: allDurations.length ? allDurations.reduce((sum, value) => sum + value, 0) / allDurations.length : 0,
        shortestHoldTime: allDurations.length ? Math.min(...allDurations) : 0,
        longestHoldTime: allDurations.length ? Math.max(...allDurations) : 0,
        avgWinningHoldTime: winningDurations.length ? winningDurations.reduce((sum, value) => sum + value, 0) / winningDurations.length : 0,
        avgLosingHoldTime: losingDurations.length ? losingDurations.reduce((sum, value) => sum + value, 0) / losingDurations.length : 0,
        shortestWinningHoldTime: winningDurations.length ? Math.min(...winningDurations) : 0,
        shortestLosingHoldTime: losingDurations.length ? Math.min(...losingDurations) : 0,
        longestWinningHoldTime: winningDurations.length ? Math.max(...winningDurations) : 0,
        longestLosingHoldTime: losingDurations.length ? Math.max(...losingDurations) : 0,
      },
    };
  }, [trades, breakevenFloor, breakevenCeiling, excludeWeekends]);

  const overviewCards = [
    { label: "Best Month", value: stats.overview.bestMonth ? `${new Date(`${stats.overview.bestMonth[0]}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} • ${formatSignedCurrency(stats.overview.bestMonth[1])}` : "—", tone: "text-emerald-300", tooltip: "The calendar month recording your peak performance." },
    { label: "Lowest Month", value: stats.overview.lowestMonth ? `${new Date(`${stats.overview.lowestMonth[0]}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} • ${formatSignedCurrency(stats.overview.lowestMonth[1])}` : "—", tone: "text-rose-300", tooltip: "The calendar month recording your lowest performance." },
    { label: "Average for Month", value: formatSignedCurrency(stats.overview.averageMonth), tone: "text-white", tooltip: "Your average net P&L per month." },
    { label: "Average Day", value: formatSignedCurrency(stats.overview.averageDay), tone: stats.overview.averageDay >= 0 ? "text-emerald-300" : "text-rose-300", tooltip: "Your average net P&L per day." },
    { label: "Biggest Day", value: stats.overview.biggestDay ? `${stats.overview.biggestDay[0]} • ${formatSignedCurrency(stats.overview.biggestDay[1])}` : "—", tone: "text-emerald-300", tooltip: "The date and amount of your best trading day." },
    { label: "Lowest Day", value: stats.overview.lowestDay ? `${stats.overview.lowestDay[0]} • ${formatSignedCurrency(stats.overview.lowestDay[1])}` : "—", tone: "text-rose-300", tooltip: "The date and amount of your worst trading day." },
  ];

  const allTimeRows = [
    ["Total P&L", formatSignedCurrency(stats.allTime.totalPnL), "The total net P&L accumulated from all trades."],
    ["Total Trades", String(stats.allTime.totalTrades), "The total count of trades execute and closed."],
    ["Avg Winning Trade", formatSignedCurrency(stats.allTime.avgWinningTrade), "Gross Profit / Number of Winning Trades"],
    ["Avg Losing Trade", formatSignedCurrency(stats.allTime.avgLosingTrade), "Gross Loss / Number of Losing Trades"],
    ["Number of Winning", String(stats.allTime.numberOfWinning), "Count of trades with positive P&L outside of breakeven bounds."],
    ["Number of Losing", String(stats.allTime.numberOfLosing), "Count of trades with negative P&L outside of breakeven bounds."],
    ["Breakeven Trades", String(stats.allTime.breakevenTrades), "Count of trades finishing within breakeven bounds."],
    ["Breakeven %", `${stats.allTime.breakevenPct.toFixed(1)}%`, "Percentage of total trades that were breakevens."],
    ["Winrate (without BE)", `${stats.allTime.winrateWithoutBE.toFixed(1)}%`, "Winning Trades / (Winning + Losing Trades)."],
    ["Winrate (with BE)", `${stats.allTime.winrateWithBE.toFixed(1)}%`, "Winning Trades / Total Trades."],
    ["Total Commissions", formatCurrency(stats.allTime.totalCommissions), "Combined expense from commissions."],
    ["Total Fees", formatCurrency(stats.allTime.totalFees), "Combined expense from fees."],
    ["Avg Trade P&L", formatSignedCurrency(stats.allTime.avgTradePnL), "Total Net P&L divided by number of trades."],
    ["Profit Factor", stats.allTime.profitFactor === 999 ? "∞" : stats.allTime.profitFactor.toFixed(2), "Gross Profit / Gross Loss."],
    ["Total Trading Days", String(stats.allTime.totalTradingDays), "Count of calendar days with at least 1 trade."],
    ["Number of No Trade Days", String(stats.allTime.noTradeDays), "Count of days with 0 executions executed."],
    ["Winning Days", String(stats.allTime.winningDays), "Days where aggregated P&L finished above zero."],
    ["Losing Days", String(stats.allTime.losingDays), "Days where aggregated P&L finished below zero."],
    ["Avg Daily P&L", formatSignedCurrency(stats.allTime.avgDailyPnL), "Total Net P&L divided by total number of trading days."],
    ["Largest Profitable Day", stats.allTime.largestProfitableDay ? `${stats.allTime.largestProfitableDay[0]} • ${formatSignedCurrency(stats.allTime.largestProfitableDay[1])}` : "—", "The date and amount of your best trading day."],
    ["Largest Losing Day", stats.allTime.largestLosingDay ? `${stats.allTime.largestLosingDay[0]} • ${formatSignedCurrency(stats.allTime.largestLosingDay[1])}` : "—", "The date and amount of your worst trading day."],
    ["Month with Max P&L", stats.allTime.monthWithMaxPnL ? `${new Date(`${stats.allTime.monthWithMaxPnL[0]}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} • ${formatSignedCurrency(stats.allTime.monthWithMaxPnL[1])}` : "—", "The calendar month recording your peak performance."],
    ["Average Hold Time", formatDuration(stats.allTime.averageHoldTime), "Mean duration for all closed trade executions."],
    ["Shortest Hold Time", formatDuration(stats.allTime.shortestHoldTime), "The single shortest duration for a trade execution."],
    ["Longest Hold Time", formatDuration(stats.allTime.longestHoldTime), "The single longest duration for a trade execution."],
    ["Avg Winning Hold Time", formatDuration(stats.allTime.avgWinningHoldTime), "Mean duration for winning trade executions."],
    ["Avg Losing Hold Time", formatDuration(stats.allTime.avgLosingHoldTime), "Mean duration for losing trade executions."],
    ["Shortest Winning Hold Time", formatDuration(stats.allTime.shortestWinningHoldTime), "The single shortest duration for a winning trade execution."],
    ["Shortest Losing Hold Time", formatDuration(stats.allTime.shortestLosingHoldTime), "The single shortest duration for a losing trade execution."],
    ["Longest Winning Hold Time", formatDuration(stats.allTime.longestWinningHoldTime), "The single longest duration for a winning trade execution."],
    ["Longest Losing Hold Time", formatDuration(stats.allTime.longestLosingHoldTime), "The single longest duration for a losing trade execution."],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-3xl border p-5 transition-transform duration-200 hover:-translate-y-0.5" style={panelStyle}>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-slate-400">
              {card.label}
              <div className="group relative flex items-center justify-center">
                <Info className="h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-slate-300" />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-xl px-3 py-2 text-xs text-slate-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 normal-case tracking-normal" style={{ background: panelTint }}>
                  {card.tooltip}
                  <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: panelTint }} />
                </div>
              </div>
            </div>
            <div className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border p-5" style={panelStyle}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-white">All Time Stats</h3>
          <label className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm text-slate-200" style={softPanelStyle}>
            <input type="checkbox" checked={excludeWeekends} onChange={(event) => setExcludeWeekends(event.target.checked)} className="accent-current" />
            Exclude weekends from no trade days
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {allTimeRows.map(([label, value, tooltip]) => (
            <div key={label} className="grid grid-cols-[1.2fr_0.8fr] items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:bg-white/5" style={softPanelStyle}>
              <div className="flex items-center gap-1.5 text-slate-300">
                {label}
                <div className="group relative flex items-center justify-center">
                  <Info className="h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-slate-300" />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-xl px-3 py-2 text-xs text-slate-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100" style={{ background: panelTint }}>
                    {tooltip}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: panelTint }} />
                  </div>
                </div>
              </div>
              <span className="text-right font-semibold text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Entry Stats */}
        <div className="rounded-3xl border p-5" style={panelStyle}>
          <h3 className="text-xl font-semibold text-white mb-4">Entry Stats</h3>
          <div className="space-y-4">
            {(() => {
              const taggedTrades = trades.filter(t => t.entryTags && t.entryTags.length > 0);
              const totalTaggedTrades = taggedTrades.length || 1;
              
              const tagStats = new Map<string, { count: number, wins: number }>();
              taggedTrades.forEach((trade) => {
                const isWin = getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "win";
                (trade.entryTags || []).forEach((tag) => {
                  const current = tagStats.get(tag) || { count: 0, wins: 0 };
                  tagStats.set(tag, { count: current.count + 1, wins: current.wins + (isWin ? 1 : 0) });
                });
              });
              
              const sortedTags = Array.from(tagStats.entries()).sort((a, b) => b[1].count - a[1].count);

              if (!sortedTags.length) return <div className="text-sm text-slate-400">No entries tracked.</div>;

              return sortedTags.map(([tag, { count, wins }]) => {
                const usagePct = (count / totalTaggedTrades) * 100;
                const winrate = (wins / count) * 100;
                return (
                  <div key={tag} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">{tag}</span>
                      <div className="text-right">
                        <span className="text-slate-300">{count} uses ({usagePct.toFixed(1)}%)</span>
                        <span className="ml-2 text-slate-300">{wins}W / {count - wins}L • {winrate.toFixed(1)}% WR</span>
                      </div>
                    </div>
                    <div 
                      className="h-2 w-full rounded-full" 
                      style={{ 
                        background: winrate > 0 && winrate < 100 
                          ? `linear-gradient(110deg, #059669 0%, #059669 calc(${winrate}% - 2px), transparent calc(${winrate}% - 2px), transparent calc(${winrate}% + 2px), #e11d48 calc(${winrate}% + 2px), #e11d48 100%)`
                          : (winrate === 100 ? '#059669' : '#e11d48')
                      }} 
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Confluence Stats */}
        <div className="rounded-3xl border p-5" style={panelStyle}>
          <h3 className="text-xl font-semibold text-white mb-4">Confluence Stats</h3>
          <div className="space-y-4">
            {(() => {
              const taggedTrades = trades.filter(t => t.confluenceTags && t.confluenceTags.length > 0);
              const totalTaggedTrades = taggedTrades.length || 1;
              
              const tagStats = new Map<string, { count: number, wins: number }>();
              taggedTrades.forEach((trade) => {
                const isWin = getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "win";
                (trade.confluenceTags || []).forEach((tag) => {
                  const current = tagStats.get(tag) || { count: 0, wins: 0 };
                  tagStats.set(tag, { count: current.count + 1, wins: current.wins + (isWin ? 1 : 0) });
                });
              });
              
              const sortedTags = Array.from(tagStats.entries()).sort((a, b) => b[1].count - a[1].count);

              if (!sortedTags.length) return <div className="text-sm text-slate-400">No confluences tracked.</div>;

              return sortedTags.map(([tag, { count, wins }]) => {
                const usagePct = (count / totalTaggedTrades) * 100;
                const winrate = (wins / count) * 100;
                return (
                  <div key={tag} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">{tag}</span>
                      <div className="text-right">
                        <span className="text-slate-300">{count} uses ({usagePct.toFixed(1)}%)</span>
                        <span className="ml-2 text-slate-300">{wins}W / {count - wins}L • {winrate.toFixed(1)}% WR</span>
                      </div>
                    </div>
                    <div 
                      className="h-2 w-full rounded-full" 
                      style={{ 
                        background: winrate > 0 && winrate < 100 
                          ? `linear-gradient(110deg, #059669 0%, #059669 calc(${winrate}% - 2px), transparent calc(${winrate}% - 2px), transparent calc(${winrate}% + 2px), #e11d48 calc(${winrate}% + 2px), #e11d48 100%)`
                          : (winrate === 100 ? '#059669' : '#e11d48')
                      }} 
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Mistake Stats */}
        <div className="rounded-3xl border p-5" style={panelStyle}>
          <h3 className="text-xl font-semibold text-white mb-4">Mistake Stats</h3>
          <div className="space-y-4">
            {(() => {
              const taggedTrades = trades.filter(t => t.mistakeTags && t.mistakeTags.length > 0);
              const totalTaggedTrades = taggedTrades.length || 1;
              
              const tagStats = new Map<string, { count: number, wins: number }>();
              taggedTrades.forEach((trade) => {
                const isWin = getTradeStatus(getNetPnl(trade), breakevenFloor, breakevenCeiling) === "win";
                (trade.mistakeTags || []).forEach((tag) => {
                  const current = tagStats.get(tag) || { count: 0, wins: 0 };
                  tagStats.set(tag, { count: current.count + 1, wins: current.wins + (isWin ? 1 : 0) });
                });
              });
              
              const sortedTags = Array.from(tagStats.entries()).sort((a, b) => b[1].count - a[1].count);

              if (!sortedTags.length) return <div className="text-sm text-slate-400">No mistakes tracked.</div>;

              return sortedTags.map(([tag, { count, wins }]) => {
                const usagePct = (count / totalTaggedTrades) * 100;
                const winrate = (wins / count) * 100;
                return (
                  <div key={tag} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">{tag}</span>
                      <div className="text-right">
                        <span className="text-slate-300">{count} uses ({usagePct.toFixed(1)}%)</span>
                        <span className="ml-2 text-slate-300">{wins}W / {count - wins}L • {winrate.toFixed(1)}% WR</span>
                      </div>
                    </div>
                    <div 
                      className="h-2 w-full rounded-full" 
                      style={{ 
                        background: winrate > 0 && winrate < 100 
                          ? `linear-gradient(110deg, #059669 0%, #059669 calc(${winrate}% - 2px), transparent calc(${winrate}% - 2px), transparent calc(${winrate}% + 2px), #e11d48 calc(${winrate}% + 2px), #e11d48 100%)`
                          : (winrate === 100 ? '#059669' : '#e11d48')
                      }} 
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* PNL by Symbol Bar Chart */}
      <div className="rounded-3xl border p-5" style={panelStyle}>
        <h3 className="text-xl font-semibold text-white mb-4">PNL by Symbol</h3>
        <div className="h-64 w-full">
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
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="symbol" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const val = payload[0].value as number;
                        return (
                          <div className="rounded-xl border border-white/10 p-3 shadow-xl backdrop-blur-xl" style={{ background: panelTint }}>
                            <div className="text-xs font-semibold text-slate-400">{payload[0].payload.symbol}</div>
                            <div className={`text-sm font-bold ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {val >= 0 ? 'Earned: ' : 'Lost: '} {formatSignedCurrency(val)}
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
    </div>
  );
};
