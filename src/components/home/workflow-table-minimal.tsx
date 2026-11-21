"use client";

import Link from "next/link";
import { useState } from "react";

import type { WorkflowProjectRow } from "@/lib/home-workflow-data";
import { formatProjectType } from "@/lib/project-types";
import { workflowStepCounts } from "@/lib/workflow-checklist";

function formatProjectStatus(status: string) {
  return status.replace(/_/g, " ");
}

function priorityIcon(priority: string) {
  if (priority === "critical") return "🔴";
  if (priority === "high") return "🟠";
  if (priority === "medium") return "🟡";
  return "🟢";
}

function statusIcon(status: string) {
  if (status.includes("completed")) return "✅";
  if (status.includes("in_progress")) return "⏳";
  if (status.includes("on_hold")) return "⏸️";
  return "📋";
}

export function WorkflowTableMinimal({ projects }: { projects: WorkflowProjectRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center dark:border-slate-600 dark:bg-slate-900/50">
        <p className="text-lg font-semibold text-slate-900 dark:text-white">No projects yet</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Get started by{" "}
          <Link href="/projects/new" className="font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
            creating a new project
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Client</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Project</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Pipeline</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {projects.map((p) => {
                const { done, inProgress, notProvided, total, inScopeTotal, addressed, weightedPercent } =
                  workflowStepCounts(p.workflow_checklist);
                return (
                  <tr key={p.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {p.registered_clients?.name ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-700 dark:text-slate-300">{p.title}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {formatProjectType(p.project_type)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {statusIcon(p.status)} {formatProjectStatus(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold">
                      <span className="inline-flex items-center gap-1">
                        {priorityIcon(p.priority)}
                        <span className="capitalize">{p.priority}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                            style={{ width: `${weightedPercent}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">{weightedPercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/projects/${p.id}#activity-checklist`}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile & Tablet Card View */}
      <div className="space-y-3 lg:hidden sm:space-y-4">
        {projects.map((p) => {
          const { done, inProgress, notProvided, total, inScopeTotal, addressed, weightedPercent } =
            workflowStepCounts(p.workflow_checklist);
          const isExpanded = expandedId === p.id;

          return (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all dark:border-slate-700 dark:bg-slate-800"
            >
              {/* Card Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                className="w-full px-4 py-4 text-left hover:bg-blue-50 dark:hover:bg-slate-700/50 sm:px-5 sm:py-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{statusIcon(p.status)}</span>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{p.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{p.registered_clients?.name ?? "No client"}</p>
                      </div>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-lg">{isExpanded ? "▼" : "▶"}</span>
                </div>

                {/* Quick Info Row */}
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold capitalize">
                    {priorityIcon(p.priority)} {p.priority}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {formatProjectType(p.project_type)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Pipeline Progress</span>
                    <span className="font-bold text-slate-900 dark:text-white">{weightedPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      style={{ width: `${weightedPercent}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50 sm:px-5 sm:py-5">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Status</p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">{formatProjectStatus(p.status)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Type</p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">{formatProjectType(p.project_type)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Done</p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                          {done}/{inScopeTotal}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">In Progress</p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">{inProgress}</p>
                      </div>
                    </div>

                    {p.timeline_summary && (
                      <div className="rounded-lg bg-white p-2 dark:bg-slate-800">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Timeline</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{p.timeline_summary}</p>
                      </div>
                    )}

                    <Link
                      href={`/projects/${p.id}#activity-checklist`}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 sm:py-3"
                    >
                      View Full Details
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function WorkflowTableMinimalFooter({ projects }: { projects: WorkflowProjectRow[] }) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 text-xs text-slate-600 dark:text-slate-400">
      Showing {projects.length} project{projects.length !== 1 ? "s" : ""}
    </div>
  );
}
