import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Rename Tabs & Arrangement: Overview, Calendar, Trade Journal, Trade Log, Lab, Friends, Import Trades, Settings.
content = content.replace(
  /type Tab = "dashboard" \| "calendar" \| "tradeJournal" \| "reports" \| "lab" \| "trades" \| "import" \| "settings" \| "friends" \| "admin";/,
  'type Tab = "dashboard" | "calendar" | "tradeJournal" | "reports" | "lab" | "trades" | "import" | "settings" | "friends" | "admin";'
);

content = content.replace(
  /const navItems: .*? = \[.*?\];/s,
  `const navItems: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "tradeJournal", label: "Trade Journal", icon: Notebook },
  { id: "trades", label: "Trade Log", icon: List },
  { id: "lab", label: "Lab", icon: FlaskConical },
  { id: "friends", label: "Friends", icon: Users },
  { id: "import", label: "Import Trades", icon: Upload },
  { id: "settings", label: "Settings", icon: Settings },
];`
);

// 2. THEME_PRESETS replacement
// Remove midnight sapphire and polar indigo. Add "White on Black" and 2 unique ones.
content = content.replace(
  /const THEME_PRESETS: ThemePreset\[\] = \[.*?\];/s,
  `const THEME_PRESETS: ThemePreset[] = [
  { id: "deep-navy", name: "Deep Navy", accent: "#4f7cff", start: "#020617", mid: "#0b1c48", end: "#020617", panelTint: "#0f172a" },
  { id: "teal", name: "Ocean Teal", accent: "#14b8a6", start: "#02111b", mid: "#083344", end: "#03222e", panelTint: "#0d2b35" },
  { id: "violet", name: "Royal Violet", accent: "#a855f7", start: "#0b1020", mid: "#581c87", end: "#1e1b4b", panelTint: "#241744" },
  { id: "ember", name: "Ember Night", accent: "#f97316", start: "#0f172a", mid: "#431407", end: "#1c1917", panelTint: "#2b180f" },
  { id: "monochrome", name: "Black & White", accent: "#ffffff", start: "#000000", mid: "#111111", end: "#000000", panelTint: "#0a0a0a" },
  { id: "white-on-black", name: "White on Black", accent: "#000000", start: "#ffffff", mid: "#f1f5f9", end: "#f8fafc", panelTint: "#e2e8f0" },
  { id: "crimson-gold", name: "Crimson Gold", accent: "#fbbf24", start: "#450a0a", mid: "#7f1d1d", end: "#2e0804", panelTint: "#450a0a" },
  { id: "neon-cyber", name: "Neon Cyber", accent: "#e81cff", start: "#170229", mid: "#090114", end: "#170229", panelTint: "#2d0b4e" },
  { id: "wine-glow", name: "Wine Glow", accent: "#a855f7", start: "#d19dd2", mid: "#581c87", end: "#780712", panelTint: "#583c49" },
];`
);

// 3. Month Total format on Calendar tab
content = content.replace(
  /Week (\d+)/g,
  '"Week " + ($1)' // just a regex trick string check
);

// We will do precise replacements here:
content = content.replace(
  /<div className="text-\[10px\] sm:text-xs uppercase tracking-\[0\.16em\] text-slate-400">W\{weekIndex \+ 1\}<\/div>/g,
  '<div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Week {weekIndex + 1}</div>'
);

// 4. Session Tags
content = content.replace(
  /if \(totalMinutes === 0 \|\| totalMinutes >= 1200\) return "Asia"; \/\/ 20:00 - 00:00/,
  'if (totalMinutes === 0 || totalMinutes >= 1200) return "Asia"; // 20:00 - 00:00'
);

fs.writeFileSync('src/App.tsx', content);
