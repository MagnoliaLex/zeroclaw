"use client";

import { useState } from "react";

export default function OnePagerModal({ project, onClose, onApprove, onReject, onFlag }) {
  const [notes, setNotes] = useState("");
  const [flagReason, setFlagReason] = useState("");

  if (!project) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{project.name}</h2>
            <p className="text-xs text-[#666]">One-Pager Review</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white text-xl"
          >
            x
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">Idea</h3>
            <p className="text-white text-sm">{project.idea}</p>
          </div>

          {project.loaded_artifacts?.one_pager_md && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">
                One-Pager
              </h3>
              <pre className="bg-[#111] border border-[#262626] rounded p-4 text-sm text-[#ccc] whitespace-pre-wrap overflow-x-auto">
                {project.loaded_artifacts.one_pager_md}
              </pre>
            </div>
          )}

          {project.loaded_artifacts?.one_pager_json && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">
                Features
              </h3>
              <ul className="list-disc list-inside text-sm text-[#ccc]">
                {(
                  project.loaded_artifacts.one_pager_json.features || []
                ).map((f, i) => (
                  <li key={i}>{f.name || f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label className="text-sm text-[#a3a3a3] block mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#111] border border-[#262626] rounded px-3 py-2 text-sm text-white h-20 resize-none focus:outline-none focus:border-[#3b82f6]"
              placeholder="Add notes for the team..."
            />
          </div>

          {/* Flag */}
          <div className="mb-4">
            <label className="text-sm text-[#a3a3a3] block mb-1">
              Flag reason (if flagging)
            </label>
            <input
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              className="w-full bg-[#111] border border-[#262626] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
              placeholder="Reason for flagging..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[#262626] flex justify-between">
          <button
            onClick={() => onFlag(project.id, flagReason)}
            disabled={!flagReason}
            className="px-4 py-2 bg-yellow-900 hover:bg-yellow-800 disabled:bg-[#262626] disabled:text-[#444] rounded text-yellow-300 text-sm"
          >
            Flag for Review
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onReject(project.id, notes)}
              className="px-4 py-2 bg-red-900 hover:bg-red-800 rounded text-red-300 text-sm"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(project.id, notes)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white text-sm font-medium"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
