import { TradeRecord } from './mockData';

export const calculateStats = (trades: TradeRecord[], breakevenRange: [number, number] = [-30, 30]) => {
  const [beLow, beHigh] = breakevenRange;
  const totalTrades = trades.length;
  
  const profitableTrades = trades.filter((t) => t.pnl > beHigh);
  const losingTrades = trades.filter((t) => t.pnl < beLow);
  const breakevenTrades = trades.filter((t) => t.pnl >= beLow && t.pnl <= beHigh);

  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  
  const wins = profitableTrades.length;
  const losses = losingTrades.length;
  const bes = breakevenTrades.length;

  const winrateWithBE = totalTrades ? (wins / totalTrades) * 100 : 0;
  const winrateWithoutBE = (totalTrades - bes) ? (wins / (totalTrades - bes)) * 100 : 0;
  
  const avgWinningTrade = wins ? profitableTrades.reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
  const avgLosingTrade = losses ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losses : 0;
  const avgTradePnl = totalTrades ? totalPnL / totalTrades : 0;
  
  const profitFactor = Math.abs(losingTrades.reduce((s,t)=>s+t.pnl, 0)) > 0 
    ? Math.abs(profitableTrades.reduce((s,t)=>s+t.pnl, 0) / losingTrades.reduce((s,t)=>s+t.pnl, 0)) 
    : Infinity;

  // Hold times
  const allHoldTimes = trades.map(t => t.duration);
  const winHoldTimes = profitableTrades.map(t => t.duration);
  const lossHoldTimes = losingTrades.map(t => t.duration);
  
  const avgHoldTime = allHoldTimes.length ? allHoldTimes.reduce((a,b)=>a+b,0)/allHoldTimes.length : 0;
  const avgWinHoldTime = winHoldTimes.length ? winHoldTimes.reduce((a,b)=>a+b,0)/winHoldTimes.length : 0;
  const avgLossHoldTime = lossHoldTimes.length ? lossHoldTimes.reduce((a,b)=>a+b,0)/lossHoldTimes.length : 0;

  return {
    totalPnL,
    totalTrades,
    wins,
    losses,
    bes,
    breakevenPercent: totalTrades ? (bes / totalTrades) * 100 : 0,
    winrateWithBE,
    winrateWithoutBE,
    avgWinningTrade,
    avgLosingTrade,
    avgTradePnl,
    profitFactor,
    avgHoldTime,
    avgWinHoldTime,
    avgLossHoldTime,
  };
};
