"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MetricsBar from "./components/MetricsBar";
import ProjectCard from "./components/ProjectCard";
import LiveFeed from "./components/LiveFeed";
import OnePagerModal from "./components/OnePagerModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
const POLL_INTERVAL = 30000; // 30 seconds

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("af_token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("af_token");
    window.location.href = "/login";
    return null;
  }
  return res.json();
}

export default function Dashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState(null);
  const [projects, setProjects] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [feedFilter, setFeedFilter] = useState({ project: "", skill: "" });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [metricsData, projectsData, feedData] = await Promise.all([
        apiFetch("/api/metrics"),
        apiFetch("/api/projects"),
        apiFetch("/api/live-feed?limit=200"),
      ]);
      if (metricsData) setMetrics(metricsData);
      if (projectsData) setProjects(projectsData.projects || []);
      if (feedData) setLiveFeed(feedData.entries || []);
    } catch {
      // Silently handle fetch errors
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll, router]);

  async function handleAction(projectId, action) {
    await apiFetch(`/api/projects/${projectId}/${action}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    fetchAll();
  }

  async function handleViewOnePager(project) {
    const data = await apiFetch(`/api/projects/${project.id}`);
    if (data) setSelectedProject(data);
  }

  async function handleApprove(projectId, notes) {
    await apiFetch(`/api/projects/${projectId}/one-pager/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
    setSelectedProject(null);
    fetchAll();
  }

  async function handleReject(projectId, reason) {
    await apiFetch(`/api/projects/${projectId}/one-pager/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setSelectedProject(null);
    fetchAll();
  }

  async function handleFlag(projectId, reason) {
    await apiFetch(`/api/projects/${projectId}/one-pager/flag`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setSelectedProject(null);
    fetchAll();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#666]">Loading...</div>
      </div>
    );
  }

  // Sort projects: needs attention first, then by phase
  const sortedProjects = [...projects].sort((a, b) => {
    const aUrgent =
      a.phase === "manual_review_required" || a.has_error ? -1 : 0;
    const bUrgent =
      b.phase === "manual_review_required" || b.has_error ? -1 : 0;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">
            ZeroClaw App Factory
          </h1>
          <p className="text-xs text-[#666]">Autonomous iOS Pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAll}
            className="px-3 py-1.5 bg-[#1a1a1a] border border-[#262626] hover:border-[#333] rounded text-xs text-[#a3a3a3]"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("af_token");
              router.push("/login");
            }}
            className="px-3 py-1.5 bg-[#1a1a1a] border border-[#262626] hover:border-[#333] rounded text-xs text-[#666]"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Metrics */}
      <MetricsBar metrics={metrics} />

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Project Cards (2 cols) */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[#a3a3a3]">
              Projects ({projects.length})
            </h2>
          </div>
          <div className="space-y-3">
            {sortedProjects.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-8 text-center text-[#444]">
                No projects yet. The pipeline will start generating ideas
                automatically.
              </div>
            ) : (
              sortedProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onAction={handleAction}
                  onViewOnePager={handleViewOnePager}
                />
              ))
            )}
          </div>
        </div>

        {/* Live Feed (1 col) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[#a3a3a3]">
              Live Feed
            </h2>
            <div className="flex gap-1">
              <select
                value={feedFilter.skill}
                onChange={(e) =>
                  setFeedFilter((f) => ({ ...f, skill: e.target.value }))
                }
                className="bg-[#111] border border-[#262626] rounded px-2 py-1 text-xs text-[#a3a3a3]"
              >
                <option value="">All Skills</option>
                <option value="shelly-router">Shelly Router</option>
                <option value="research-scout">Research Scout</option>
                <option value="validation-analyst">Validation Analyst</option>
                <option value="app-builder">App Builder</option>
                <option value="code-reviewer">Code Reviewer</option>
                <option value="qa-gatekeeper">QA Gatekeeper</option>
                <option value="monetization-agent">Monetization</option>
                <option value="store-packager">Store Packager</option>
                <option value="screenshot-agent">Screenshot</option>
                <option value="icon-designer">Icon Designer</option>
                <option value="video-producer">Video Producer</option>
                <option value="larry-marketing">Larry Marketing</option>
              </select>
            </div>
          </div>
          <LiveFeed
            entries={liveFeed}
            filterProject={feedFilter.project}
            filterSkill={feedFilter.skill}
          />
        </div>
      </div>

      {/* One-Pager Modal */}
      {selectedProject && (
        <OnePagerModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onFlag={handleFlag}
        />
      )}
    </div>
  );
}
