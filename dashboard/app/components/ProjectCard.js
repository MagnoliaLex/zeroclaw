"use client";

const PHASE_COLORS = {
  idea_pending_validation: "bg-gray-600",
  validated: "bg-blue-600",
  idea_pending_approval: "bg-yellow-600",
  approved: "bg-blue-500",
  dev_in_progress: "bg-indigo-600",
  dev_complete: "bg-indigo-500",
  review_in_progress: "bg-purple-600",
  review_complete: "bg-purple-500",
  qa_in_progress: "bg-orange-600",
  qa_passed: "bg-green-600",
  qa_failed: "bg-red-600",
  monetization: "bg-emerald-600",
  store_packaging: "bg-teal-600",
  screenshots: "bg-cyan-600",
  icon_generation: "bg-sky-600",
  video_production: "bg-violet-600",
  submission_ready: "bg-green-500",
  marketing_active: "bg-green-400",
  manual_review_required: "bg-red-500",
  paused: "bg-gray-500",
  archived: "bg-gray-700",
};

const PHASE_ORDER = [
  "idea_pending_validation",
  "validated",
  "idea_pending_approval",
  "approved",
  "dev_in_progress",
  "dev_complete",
  "review_in_progress",
  "review_complete",
  "qa_in_progress",
  "qa_passed",
  "monetization",
  "store_packaging",
  "screenshots",
  "icon_generation",
  "video_production",
  "submission_ready",
  "marketing_active",
];

function getProgressPercent(phase) {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / PHASE_ORDER.length) * 100);
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProjectCard({ project, onAction, onViewOnePager }) {
  const progress = getProgressPercent(project.phase);
  const phaseColor = PHASE_COLORS[project.phase] || "bg-gray-600";

  return (
    <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-4 hover:border-[#333] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium text-sm">{project.name}</h3>
          <p className="text-[#666] text-xs mt-0.5 truncate max-w-[250px]">
            {project.idea}
          </p>
        </div>
        <span
          className={`phase-badge ${phaseColor} text-white`}
        >
          {project.phase.replace(/_/g, " ")}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#262626] rounded-full h-1.5 mb-3">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-[#666]">
        <div className="flex gap-3">
          <span>QA: {project.qa_attempts}/3</span>
          <span>{timeAgo(project.phase_entered_at)}</span>
          {project.locked && (
            <span className="text-yellow-500">LOCKED</span>
          )}
          {project.has_error && (
            <span className="text-red-400">ERROR</span>
          )}
        </div>

        <div className="flex gap-1">
          {project.phase === "idea_pending_approval" && (
            <>
              <button
                onClick={() => onViewOnePager(project)}
                className="px-2 py-1 bg-[#262626] hover:bg-[#333] rounded text-[#a3a3a3] text-xs"
              >
                Review
              </button>
              <button
                onClick={() => onAction(project.id, "one-pager/approve")}
                className="px-2 py-1 bg-green-900 hover:bg-green-800 rounded text-green-300 text-xs"
              >
                Approve
              </button>
              <button
                onClick={() => onAction(project.id, "one-pager/reject")}
                className="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-red-300 text-xs"
              >
                Reject
              </button>
            </>
          )}
          {project.phase === "manual_review_required" && (
            <button
              onClick={() => onAction(project.id, "actions/force-retry")}
              className="px-2 py-1 bg-yellow-900 hover:bg-yellow-800 rounded text-yellow-300 text-xs"
            >
              Force Retry
            </button>
          )}
          {project.phase === "marketing_active" && (
            <button
              onClick={() => onAction(project.id, "actions/pause-marketing")}
              className="px-2 py-1 bg-[#262626] hover:bg-[#333] rounded text-[#a3a3a3] text-xs"
            >
              Pause
            </button>
          )}
          {project.phase === "paused" && (
            <button
              onClick={() => onAction(project.id, "actions/resume-marketing")}
              className="px-2 py-1 bg-green-900 hover:bg-green-800 rounded text-green-300 text-xs"
            >
              Resume
            </button>
          )}
          {["idea_pending_approval", "manual_review_required", "marketing_active", "paused"].includes(project.phase) && (
            <button
              onClick={() => onAction(project.id, "actions/archive")}
              className="px-2 py-1 bg-[#262626] hover:bg-[#333] rounded text-[#666] text-xs"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
