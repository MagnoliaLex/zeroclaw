"use client";

import { useEffect, useRef } from "react";

export default function LiveFeed({ entries, filterProject, filterSkill }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  let filtered = entries || [];
  if (filterProject) {
    filtered = filtered.filter((e) => e.includes(`[${filterProject}]`));
  }
  if (filterSkill) {
    filtered = filtered.filter((e) => e.includes(`[${filterSkill}]`));
  }

  return (
    <div className="bg-[#0d1117] border border-[#262626] rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-[#262626] flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#a3a3a3]">Live AI Feed</h3>
        <span className="text-xs text-[#666]">
          {filtered.length} entries
        </span>
      </div>
      <div
        ref={containerRef}
        className="p-3 h-64 overflow-y-auto live-feed"
      >
        {filtered.length === 0 ? (
          <div className="text-[#444] text-center py-8">
            No activity yet
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div key={i} className="live-feed-entry">
              {entry}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
