import Link from "next/link";
import { Suspense } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatusBanner } from "@/components/dashboard/status-banner";
import { HomeStudentsPanel } from "@/components/home/home-students-panel";
import { HomeSummaryCards } from "@/components/home/home-summary-cards";
import { WorkflowTableMinimal } from "@/components/home/workflow-table-minimal";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { loadHomeWorkflowPage } from "@/lib/home-workflow-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { banner, projects, summaries } = await loadHomeWorkflowPage();

  const connected = isDashboardRegistryOk(banner);
  const statusDotClass = connected ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]" : "bg-amber-500";

  return (
    <DashboardShell
      title="Project workflow"
      subtitle="Project pipeline on home. Students, title requests, and Help desk chat are in the portal system below."
      statusDotClass={statusDotClass}
    >
      {/* Modern Hero Section */}
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:mb-10 md:px-8 md:py-12 lg:py-14">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
        </div>

        <div className="relative">
          <div className="mb-6 flex flex-col justify-between gap-4 md:mb-8 md:flex-row md:items-center md:gap-6 lg:gap-8">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Project Dashboard
              </h1>
              <p className="mt-2 text-base text-slate-300 sm:mt-3 sm:text-lg">
                Track your workflow, manage projects, and monitor progress in real-time
              </p>
            </div>
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg active:scale-95 sm:px-6 sm:py-3"
            >
              <span>➕</span>
              <span className="hidden sm:inline">New project</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between md:gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full ${statusDotClass}`} />
              <span className="text-sm font-medium text-slate-300">
                {connected ? "System Connected" : "Connection Alert"}
              </span>
            </div>
            <p className="text-xs text-slate-400 sm:text-sm">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </section>

      <StatusBanner banner={banner} />

      {/* Summary Cards Section - Responsive Grid */}
      <section id="overview" className="mb-8 scroll-mt-28 md:mb-10 lg:mb-12">
        <div className="mb-6 flex flex-col gap-2 md:mb-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
            Project Summary
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 sm:text-base">
            Key metrics for your selected working year
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 dark:from-slate-900 dark:to-slate-800 sm:p-6 md:p-8">
          <HomeSummaryCards s={summaries} />
        </div>
      </section>

      {/* Students Panel */}
      <section className="mb-8 scroll-mt-28 md:mb-10 lg:mb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
            Students & Staff
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
            Manage registered users and project assignments
          </p>
        </div>
        <HomeStudentsPanel />
      </section>

      {/* Activity Overview Section */}
      <section id="workflow" className="mb-8 scroll-mt-28 md:mb-10 lg:mb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
            Activity Overview
          </h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">
            <span className="font-semibold text-slate-900 dark:text-white">Pipeline</span> shows checklist progress •{" "}
            <span className="font-semibold text-slate-900 dark:text-white">Timeline</span> displays dates and milestones •{" "}
            <Link href="/plans" className="font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              View this week’s milestones
            </Link>
          </p>
        </div>
        <Suspense fallback={<div className="rounded-2xl bg-slate-100 p-8 dark:bg-slate-900">Loading...</div>}>
          <WorkflowTableMinimal projects={projects} />
        </Suspense>
      </section>

      {/* Quick Links Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700">
        <nav className="grid grid-cols-2 gap-3 pt-8 sm:gap-4 md:grid-cols-5 md:gap-2 md:pt-10">
          <Link
            href="/projects"
            className="group rounded-xl bg-slate-50 p-3 text-center transition-all hover:bg-blue-50 hover:shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 sm:p-4"
          >
            <span className="text-lg sm:text-2xl">📊</span>
            <p className="mt-1 text-xs font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-200 sm:text-sm">
              All Projects
            </p>
          </Link>
          <Link
            href="/users"
            className="group rounded-xl bg-slate-50 p-3 text-center transition-all hover:bg-blue-50 hover:shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 sm:p-4"
          >
            <span className="text-lg sm:text-2xl">👥</span>
            <p className="mt-1 text-xs font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-200 sm:text-sm">
              Users
            </p>
          </Link>
          <Link
            href="/users/requests"
            className="group rounded-xl bg-slate-50 p-3 text-center transition-all hover:bg-blue-50 hover:shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 sm:p-4"
          >
            <span className="text-lg sm:text-2xl">📋</span>
            <p className="mt-1 text-xs font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-200 sm:text-sm">
              Requests
            </p>
          </Link>
          <Link
            href="/plans"
            className="group rounded-xl bg-slate-50 p-3 text-center transition-all hover:bg-blue-50 hover:shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 sm:p-4"
          >
            <span className="text-lg sm:text-2xl">📅</span>
            <p className="mt-1 text-xs font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-200 sm:text-sm">
              Milestones
            </p>
          </Link>
          <Link
            href="/students/help-desk"
            className="group rounded-xl bg-slate-50 p-3 text-center transition-all hover:bg-blue-50 hover:shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 sm:p-4"
          >
            <span className="text-lg sm:text-2xl">💬</span>
            <p className="mt-1 text-xs font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-200 sm:text-sm">
              Help Desk
            </p>
          </Link>
        </nav>
        <div className="mt-8 border-t border-slate-200 py-6 text-center text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400 sm:mt-10 sm:text-sm">
          <p>Honic Project Management System • Workflow Pipeline</p>
        </div>
      </footer>
    </DashboardShell>
  );
}
