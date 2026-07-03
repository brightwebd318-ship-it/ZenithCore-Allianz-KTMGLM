const fs = require('fs');
let file = 'src/views/AppointmentsView.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add states
code = code.replace(
  "  const [realtimeNotify, setRealtimeNotify] = useState<string | null>(null);",
  `  const [realtimeNotify, setRealtimeNotify] = useState<string | null>(null);

  // Pagination & Filtering
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [visibleCount, setVisibleCount] = useState<number>(10);`
);

// 2. Add Filter tabs above the list
code = code.replace(
  "          <div className=\"space-y-3\">",
  `          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg dark:bg-slate-800/50 w-full md:w-auto overflow-x-auto">
            {['all', 'scheduled', 'completed', 'cancelled'].map(status => (
              <button
                key={status}
                onClick={() => { setFilterStatus(status as any); setVisibleCount(10); }}
                className={\`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-colors whitespace-nowrap \${
                  filterStatus === status 
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }\`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="space-y-3">`
);

// 3. Process sessions
const processRegex = /\[\.\.\.sessions\]\s*\n\s*\.sort\(\(a, b\) => new Date\(a\.start_time\)\.getTime\(\) - new Date\(b\.start_time\)\.getTime\(\)\)\s*\n\s*\.map\(\(session\) => \{/;

code = code.replace(processRegex, `(() => {
                const filtered = sessions.filter(s => filterStatus === 'all' || s.status === filterStatus);
                const sorted = [...filtered].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
                const visible = sorted.slice(0, visibleCount);
                
                return (
                  <>
                    {visible.map((session) => {`);

// 4. Add load more button
const renderEndRegex = /                                <\/button>\s*\n\s*\)\}\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*\);\s*\n\s*\}\)\s*\)}/;

code = code.replace(renderEndRegex, `                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {(() => {
                      const filtered = sessions.filter(s => filterStatus === 'all' || s.status === filterStatus);
                      if (visibleCount < filtered.length) {
                        return (
                          <div className="pt-4 pb-2 flex justify-center">
                            <button
                              onClick={() => setVisibleCount(prev => prev + 10)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-bold py-2 px-6 rounded-full shadow-sm transition-colors flex items-center"
                            >
                              <RefreshCw className="h-3 w-3 mr-2" /> Load More
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                );
              })()
            )}`);

fs.writeFileSync(file, code);
console.log('AppointmentsView patched');
