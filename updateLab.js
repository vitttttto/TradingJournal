const fs = require('fs');
let content = fs.readFileSync('src/components/TheLab.tsx', 'utf-8');

// Replace state
content = content.replace(
  /const \[col1, setCol1\] = useState.*?;\n  const \[col2, setCol2\] = useState.*?;/s,
  `const [columns, setColumns] = useState<ColumnState[]>([initialLabState, initialLabState]);`
);

// Replace stats logic
content = content.replace(
  /const stats1 = useMemo.*?;\n  const stats2 = useMemo.*?;/s,
  `const colStats = useMemo(() => columns.map(c => getStats(c)), [trades, columns, breakevenFloor, breakevenCeiling]);`
);

// Replace toggleTag
content = content.replace(
  /const toggleTag = \(colIndex: 1 \| 2.*?\n  };\n/s,
  `const toggleTag = (realIndex: number, tag: string, type: 'confluence' | 'mistake' | 'entry' | 'session', isShiftKey: boolean = false) => {
    setColumns(prev => {
      const newCols = [...prev];
      const newState = { ...newCols[realIndex] };
      
      const updateTagsState = (
        currentTags: Record<string, TagState>, 
        allTagsList: string[]
      ) => {
        if (isShiftKey) {
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
        newState.selectedEntries = updateTagsState(prev[realIndex].selectedEntries, allEntries);
      } else if (type === 'confluence') {
        newState.selectedConfluences = updateTagsState(prev[realIndex].selectedConfluences, allConfluences);
      } else if (type === 'mistake') {
        newState.selectedMistakes = updateTagsState(prev[realIndex].selectedMistakes, allMistakes);
      } else if (type === 'session') {
        newState.selectedSessions = updateTagsState(prev[realIndex].selectedSessions, allSessions);
      }
      newCols[realIndex] = newState;
      return newCols;
    });
  };\n`
);

// Replace setSymbol
content = content.replace(
  /const setSymbol = .*?\n  };\n/s,
  `const setSymbol = (realIndex: number, symbol: string) => {
    setColumns(prev => {
      const newCols = [...prev];
      newCols[realIndex] = { ...newCols[realIndex], selectedSymbol: symbol };
      return newCols;
    });
  };\n\n  const resetColumn = (idx: number) => {
    setColumns(prev => {
      const nc = [...prev];
      nc[idx] = initialLabState;
      return nc;
    });
  };\n\n  const removeColumn = (idx: number) => {
    setColumns(prev => prev.filter((_, i) => i !== idx));
  };\n`
);

// Replace renderColumn signature and reset button
content = content.replace(
  /const renderColumn = \(colIndex: 1 \| 2, /s,
  `const renderColumn = (colIndex: number, colState: ColumnState, stats: ReturnType<typeof getStats>) => {\n    const realIndex = colIndex - 1;\n`
);

content = content.replace(
  /<h3 className="text-xl font-semibold text-white">Column \{colIndex\} Filters<\/h3>/s,
  `<h3 className="text-xl font-semibold text-white">Column {colIndex} Filters</h3>
              <button onClick={() => resetColumn(realIndex)} className="px-2 py-1 ml-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Reset</button>
              {columns.length > 1 && <button onClick={() => removeColumn(realIndex)} className="px-2 py-1 ml-2 text-xs rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition">Remove</button>}`
);

// Replace mapping to realIndex in onClick methods
content = content.replaceAll('colIndex, ""', 'realIndex, ""');
content = content.replaceAll('colIndex, symbol', 'realIndex, symbol');
content = content.replaceAll('colIndex, tag', 'realIndex, tag');
content = content.replaceAll('colIndex, sess', 'realIndex, sess');

// Replace the return block
content = content.replace(
  /<div className="grid gap-6 md:grid-cols-2">.*?<\/div>\n    <\/div>/s,
  `<div className="flex justify-end mb-4">
        <button onClick={() => setColumns(prev => [...prev, initialLabState])} className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-semibold rounded-2xl transition">+ Add Column</button>
      </div>
      <div className="grid gap-6 md:grid-cols-2" style={{ gridTemplateColumns: columns.length === 1 ? '1fr' : undefined }}>
        {columns.map((col, idx) => (
          <React.Fragment key={idx}>
            {renderColumn(idx + 1, col, colStats[idx])}
          </React.Fragment>
        ))}
      </div>
    </div>`
);

fs.writeFileSync('src/components/TheLab.tsx', content);
