"use client";

export default function MetricsBar({ metrics }) {
  if (!metrics) return null;

  const items = [
    {
      label: "Active Projects",
      value: metrics.active_projects,
      color: "text-blue-400",
    },
    {
      label: "Shipped Apps",
      value: metrics.shipped_apps,
      color: "text-green-400",
    },
    {
      label: "Queue Depth",
      value: metrics.queue_depth,
      color: "text-yellow-400",
    },
    {
      label: "Needs Attention",
      value: metrics.needs_attention,
      color: metrics.needs_attention > 0 ? "text-red-400" : "text-gray-400",
    },
    {
      label: "System Health",
      value: metrics.system_health === "operational" ? "OK" : "ISSUE",
      color:
        metrics.system_health === "operational"
          ? "text-green-400"
          : "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-4"
        >
          <div className="text-[#a3a3a3] text-xs uppercase tracking-wider mb-1">
            {item.label}
          </div>
          <div className={`text-2xl font-bold ${item.color}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
