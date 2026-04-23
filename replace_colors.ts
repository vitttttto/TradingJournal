import fs from 'fs';

const files = [
  'src/App.tsx',
  'src/components/Reports.tsx',
  'src/components/TradeJournal.tsx',
  'src/components/TheLab.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf-8');
  
  // Replace text colors
  content = content.replace(/text-white/g, 'opacity-100');
  content = content.replace(/text-slate-200/g, 'opacity-90');
  content = content.replace(/text-slate-300/g, 'opacity-80');
  content = content.replace(/text-slate-400/g, 'opacity-60');
  content = content.replace(/text-slate-500/g, 'opacity-40');
  
  // Replace borders
  content = content.replace(/border-white\/([0-9]+)/g, 'border-current/$1');
  
  // Replace bg
  content = content.replace(/bg-slate-950\/([0-9]+)/g, 'bg-black/$1');
  content = content.replace(/bg-slate-900\/([0-9]+)/g, 'bg-black/$1');
  content = content.replace(/bg-slate-900/g, 'bg-black/20');
  content = content.replace(/bg-slate-800/g, 'bg-black/40');
  content = content.replace(/bg-white\/([0-9]+)/g, 'bg-current/$1');

  // Replace accent colors for better contrast on light/dark
  content = content.replace(/text-emerald-300/g, 'text-emerald-500');
  content = content.replace(/text-rose-300/g, 'text-rose-500');
  content = content.replace(/text-sky-300/g, 'text-sky-500');
  content = content.replace(/text-sky-200/g, 'text-sky-500');
  content = content.replace(/text-amber-200/g, 'text-amber-500');
  content = content.replace(/text-amber-300/g, 'text-amber-500');
  content = content.replace(/text-violet-200/g, 'text-violet-500');

  fs.writeFileSync(file, content);
});
