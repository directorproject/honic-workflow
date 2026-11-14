import Link from "next/link";
import type { ReactNode } from "react";

import { publishTitleDocument } from "@/app/portal/title-claim-actions";
import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { TitlesFrame } from "@/components/portal/cohort-title-board";
import { LinkifiedText } from "@/components/portal/linkified-text";
import { PortalAuth } from "@/components/portal/portal-auth";
import { ProfileForm } from "@/components/portal/profile-form";
import { SiteFooter } from "@/components/portal/site-footer";
import { TitleJumpNav } from "@/components/portal/title-jump-nav";
import { TitleRelated } from "@/components/portal/title-related";
import { TitleSelectAction } from "@/components/portal/title-select-panel";
import { TitleTermsGate } from "@/components/portal/title-terms-gate";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { TitleEngagementStats } from "@/components/portal/title-engagement-stats";
import { claimsForTarget, publishedDocuments, type TitleClaim, type TitleTargetKind } from "@/lib/portal/title-claims";
import { engagementForTargets, recordTitleClick, type TitleEngagement } from "@/lib/portal/title-engagement";
import { projectMark } from "@/lib/portal/project-mark";
import { loadLiterature, type ReviewItem } from "@/lib/portal/title-choices";
import {
  MAX_TITLE_CHOICES,
  planModeLabel,
  titleHideEntitlement,
  type TitleHideEntitlement,
} from "@/lib/portal/title-limits";
import { titleTermsStatus } from "@/lib/portal/title-terms";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";
import { formatDate } from "@/lib/workspace/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Title · Honic Company Limited" };

const NOTICES: Record<string, string> = {
  selected: "Title shortlisted. Classmates can still see it until you pay to make it yours and hide it.",
  owned: "This title is yours and hidden from classmates at your institution / course / level.",
  claimed: "Your claim was sent. It stays hidden until an admin confirms it.",
  waiting: "You already asked for this project. It is waiting for an admin.",
  taken: "Someone already owns this project.",
  published: "The document is published. Anyone who opens this title can read it.",
  missing: "Add the missing name or file.",
  large: "That file is larger than 25 MB.",
  owner: "Only the confirmed owner can publish documents.",
  upload: "The document could not be stored.",
  unavailable: "Claims are not ready yet.",
};

export default async function PortalTitlePage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string }>;
}) {
  const [{ id }, search] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve({} as { notice?: string }),
  ]);
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();

  if (!user) {
    return (
      <Gate>
        <PortalAuth initialStatus={null} googleEnabled={process.env.PORTAL_GOOGLE_SIGNIN === "true"} />
      </Gate>
    );
  }
  if (!db) {
    return (
      <Gate>
        <p className="text-dash-muted-foreground text-sm">The title list is not available right now.</p>
      </Gate>
    );
  }
  if (!state.isStaff && !profile) {
    return (
      <Gate>
        <ProfileForm courses={state.courses} profile={profile} suggestedName={user.suggestedName} />
      </Gate>
    );
  }
  let acceptedAt: string | null = null;
  if (!state.isStaff && profile) {
    const account = await db.auth.admin.getUserById(user.id);
    if (account.error) throw new Error(account.error.message);
    const terms = titleTermsStatus(account.data.user?.user_metadata);
    acceptedAt = terms.acceptedAt;
    if (!terms.accepted) {
      return (
        <Gate>
          <TitleTermsGate step={terms.policyAccepted ? "rules" : "policy"} />
        </Gate>
      );
    }
  }

  const routeId = decodeURIComponent(id);
  const review = await loadLiterature(db, state.isStaff ? null : user.id, state.isStaff ? null : profile);
  const item = [...review.mine, ...review.items].find((entry) => entry.id === routeId) ?? null;
  const courseName = new Map(state.courses.map((course) => [course.code, course.name]));
  const notice = search.notice ? NOTICES[search.notice] : null;
  const target = item ? titleTarget(item) : null;
  const claims = target ? await claimsForTarget(db, target.kind, target.id) : [];
  const confirmed = claims.filter((claim) => claim.status === "confirmed");
  const documents = await publishedDocuments(db, confirmed.map((claim) => claim.id));
  const files = documents.map((document) => ({
    id: document.id,
    name: document.name,
    href: `/api/portal/title-documents/${document.id}`,
  }));
  const mineClaim = !state.isStaff && user ? confirmed.find((claim) => claim.requesterId === user.id) ?? null : null;
  const ownerId = confirmed[0]?.requesterId ?? null;
  if (target && confirmed.length) {
    await recordTitleClick(db, {
      targetKind: target.kind,
      targetId: target.id,
      viewerId: user.id,
      ownerId,
      isStaff: state.isStaff,
    });
  }
  const engagementMap =
    target && confirmed.length ? await engagementForTargets(db, [target]) : new Map<string, TitleEngagement>();
  const engagement = target ? engagementMap.get(`${target.kind}:${target.id}`) ?? null : null;
  const isMine = Boolean(item && review.mine.some((entry) => entry.id === item.id));
  const viewer = state.isStaff
    ? { name: user.email, detail: "Staff · reading only", homeHref: null }
    : {
        name: profile?.fullName || user.email,
        detail: profile ? [profile.courseOther ?? profile.courseCode, studyLevelLabel(profile.studyLevel, profile.studyLevelOther), profile.institution].filter(Boolean).join(" · ") || null : null,
        homeHref: "/portal",
      };
  const others = item ? [...review.mine, ...review.items].filter((entry) => entry.id !== item.id) : [];
  const related = item
    ? {
        department: item.courseCode ? others.filter((entry) => entry.courseCode === item.courseCode).slice(0, 6) : [],
        institution: item.institution ? others.filter((entry) => entry.institution === item.institution).slice(0, 6) : [],
        year: others.filter((entry) => entry.yearLabel === item.yearLabel).slice(0, 6),
      }
    : null;

  const membership = !state.isStaff && user ? await findMembership(db, user.id) : null;

  return (
    <TitlesFrame
      items={review.items}
      mine={review.mine}
      courses={state.courses}
      studentYear={state.isStaff ? null : profile?.academicYear ?? null}
      acceptedOn={acceptedAt ? formatDate(acceptedAt) : null}
      readOnly={state.isStaff}
      viewer={viewer}
      hasWorkspace={Boolean(membership)}
      hasProgress={Boolean(profile?.trackedProjectId)}
      deskExpiresAt={profile?.deskExpiresAt ?? null}
      catalogueTools={false}
    >
      <article className="w-full px-4 pt-4 pb-10 sm:px-6 sm:pt-5 lg:px-8">
        {notice ? <p className="border-dash-border mb-6 rounded-lg border bg-emerald-500/10 px-3 py-2 text-sm">{notice}</p> : null}
        {item && target && related ? (
          <TitleDetail
            item={item}
            routeId={routeId}
            department={item.courseCode ? (courseName.get(item.courseCode) ?? item.courseCode) : null}
            files={files}
            myClaim={mineClaim}
            engagement={engagement}
            related={related}
            isMine={isMine}
            selectedCount={review.mine.length}
            readOnly={state.isStaff}
            phone={profile?.phone ?? ""}
            entitlement={
              profile
                ? titleHideEntitlement({
                    deskExpiresAt: profile.deskExpiresAt,
                    changeCredits: profile.changeCredits,
                    selectedCount: review.mine.length,
                    hiddenCount: review.mine.filter((t) => t.isHiddenFromPeers).length,
                  })
                : null
            }
            isHiddenFromPeers={Boolean(item.isHiddenFromPeers)}
            planMode={
              profile
                ? {
                    deskExpiresAt: profile.deskExpiresAt,
                    deskPlan: profile.deskPlan,
                  }
                : null
            }
          />
        ) : (
          <MissingTitle />
        )}
      </article>
    </TitlesFrame>
  );
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</div>
      <SiteFooter />
    </main>
  );
}

function MissingTitle() {
  return (
    <div>
      <h1 className="text-dash-foreground text-2xl font-semibold tracking-tight">This title is not available</h1>
      <p className="text-dash-muted-foreground mt-3 text-sm leading-relaxed">It may be hidden for your group, or it is no longer on the list.</p>
      <Link href="/portal/titles" className="text-dash-accent mt-4 inline-block text-sm font-semibold">
        Back to all titles
      </Link>
    </div>
  );
}

function TitleDetail({
  item,
  routeId,
  department,
  files,
  myClaim,
  engagement,
  related,
  isMine,
  selectedCount,
  readOnly,
  phone,
  entitlement,
  isHiddenFromPeers,
  planMode,
}: {
  item: ReviewItem;
  routeId: string;
  department: string | null;
  files: { id: string; name: string; href: string | null }[];
  myClaim: TitleClaim | null;
  engagement: TitleEngagement | null;
  related: { department: ReviewItem[]; institution: ReviewItem[]; year: ReviewItem[] };
  isMine: boolean;
  selectedCount: number;
  readOnly: boolean;
  phone: string;
  entitlement: TitleHideEntitlement | null;
  isHiddenFromPeers: boolean;
  planMode: { deskExpiresAt?: string | null; deskPlan?: string | null } | null;
}) {
  const mark = projectMark(item);
  const plan = planMode ? planModeLabel(planMode) : null;
  const facts = [
    ["Kind", mark.group],
    ["Category", mark.category],
    ["Code", mark.code],
    ["Catalogue", mark.citation],
    ["Year", yearSpan(item.yearLabel)],
    ["Department", department],
    ["Institution", item.institution],
    ["Group", item.batch],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const jumps: [string, string][] = [
    ["#details", "Details"],
    ["#brief", "Problem"],
    ["#explanation", "Explanation"],
    ...(item.hardware ? [["#hardware", "Hardware"] as [string, string]] : []),
    ["#literature", "Literature"],
    ["#documents", "Documents"],
    ["#more", "Related"],
  ];
  const slotsFull = selectedCount >= MAX_TITLE_CHOICES;

  return (
    <div className="w-full min-w-0 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1">
          <Link href="/portal/titles" className="text-dash-muted-foreground hover:text-dash-foreground text-xs font-semibold">
            ← All titles
          </Link>
          <p className="text-dash-muted-foreground mt-4 text-[11px] leading-relaxed tracking-wide uppercase">
            <span>{mark.year}</span>
            <span aria-hidden="true"> | </span>
            <span>{mark.group}</span>
            {mark.courseCode || department ? (
              <>
                <span aria-hidden="true"> | </span>
                <span className="lg:hidden">{mark.courseCode ?? department}</span>
                <span className="hidden lg:inline">{department ?? mark.courseCode}</span>
              </>
            ) : null}
            {mark.institute ? (
              <>
                <span aria-hidden="true"> | </span>
                <span>{mark.institute}</span>
              </>
            ) : null}
          </p>
          <h1 className="text-dash-foreground mt-2 text-xl leading-snug font-semibold tracking-tight break-words sm:text-2xl lg:text-[1.75rem]">
            {item.title}
          </h1>
          <p className="text-dash-muted-foreground mt-2 text-xs leading-relaxed break-words">{mark.citation}</p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-red-700 italic dark:text-red-400">{mark.note}</p>
          {!readOnly && plan ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    plan.mode === "paid"
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                      : "bg-dash-muted text-dash-muted-foreground"
                  }`}
                >
                  {plan.title}
                </span>
                <span className="text-dash-muted-foreground ml-2">
                  {selectedCount} shortlisted
                  {entitlement ? ` · ${entitlement.hiddenCount} hidden from classmates` : null}
                  {entitlement?.hasPaidPlan ? ` · ${entitlement.freeRemaining} free hides left` : null}
                </span>
              </p>
              {plan.detail ? (
                <p className="text-dash-muted-foreground max-w-2xl text-xs leading-relaxed">{plan.detail}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="w-full shrink-0 lg:w-64 lg:pt-8">
          <TitleSelectAction
            proposalId={item.id}
            canChoose={item.canChoose}
            isMine={isMine}
            isHiddenFromPeers={isHiddenFromPeers}
            selectedCount={selectedCount}
            readOnly={readOnly}
            needsPayment={Boolean(entitlement?.needsPayment)}
            hasPaidPlan={Boolean(entitlement?.hasPaidPlan)}
            freeRemaining={entitlement?.freeRemaining ?? 0}
            hideCredits={entitlement?.hideCredits ?? 0}
            phone={phone}
          />
        </div>
      </div>

      <TitleJumpNav jumps={jumps} />

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-12">
        <div className="min-w-0">
          {facts.length ? (
            <dl id="details" className="border-dash-border scroll-mt-24 border-t">
              {facts.map(([label, value]) => (
                <div key={label} className="border-dash-border grid gap-1 border-b py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-dash-muted-foreground text-xs font-semibold">{label}</dt>
                  <dd className="text-dash-foreground min-w-0 text-sm leading-relaxed break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <section id="brief" className="mt-10 scroll-mt-24 space-y-5">
            <div>
              <h2 className="text-dash-foreground text-sm font-semibold">Problem statement</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <LinkifiedText
                  text={
                    item.problemStatement ??
                    (item.summary ? item.summary : "No problem statement has been published yet for this title.")
                  }
                />
              </p>
            </div>
            <div>
              <h2 className="text-dash-foreground text-sm font-semibold">Main objective</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <LinkifiedText text={item.objectives ?? "No main objective has been published yet for this title."} />
              </p>
            </div>
            {item.specificObjectives ? (
              <div>
                <h2 className="text-dash-foreground text-sm font-semibold">Specific objectives</h2>
                <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  <LinkifiedText text={item.specificObjectives} />
                </p>
              </div>
            ) : null}
          </section>

          <section id="explanation" className="mt-10 scroll-mt-24">
            <h2 className="text-dash-foreground text-sm font-semibold">Explanation</h2>
            <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
              <LinkifiedText text={item.summary ?? "No explanation was recorded for this title."} />
            </p>
          </section>

          {item.hardware ? (
            <section id="hardware" className="mt-10 scroll-mt-24">
              <h2 className="text-dash-foreground text-sm font-semibold">Hardware</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words">{item.hardware}</p>
            </section>
          ) : null}
          {item.communication ? (
            <section id="communication" className="mt-10 scroll-mt-24">
              <h2 className="text-dash-foreground text-sm font-semibold">Communication</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words">{item.communication}</p>
            </section>
          ) : null}

          <section id="literature" className="mt-10 scroll-mt-24">
            <h2 className="text-dash-foreground text-sm font-semibold">Literature and source</h2>
            {item.literatureNote ? (
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <LinkifiedText text={item.literatureNote} />
              </p>
            ) : (
              <p className="text-dash-muted-foreground mt-2 text-sm">No literature note yet for this title.</p>
            )}
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-semibold break-all text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:decoration-blue-400/40 dark:hover:text-blue-300"
              >
                Open source page
              </a>
            ) : null}
          </section>

          <section id="documents" className="mt-10 scroll-mt-24">
            <h2 className="text-dash-foreground text-sm font-semibold">Project documents</h2>
            {files.length ? (
              <ul className="mt-3 space-y-2">
                {files.map((file) => (
                  <li key={file.id}>
                    {file.href ? (
                      <a href={file.href} className="text-dash-accent text-sm font-semibold" target="_blank" rel="noreferrer">
                        {file.name}
                      </a>
                    ) : (
                      <span className="text-dash-muted-foreground text-sm">{file.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-dash-muted-foreground mt-2 text-sm">
                No full report is stored here yet.
                {item.sourceUrl ? " Use the source link above to approach the original list or project page." : ""}
              </p>
            )}
          </section>

          {myClaim ? (
            <section className="border-dash-border mt-10 space-y-4 border-t pt-6">
              <div>
                <h2 className="text-dash-foreground text-sm font-semibold">Ownership confirmed</h2>
                <p className="text-dash-muted-foreground mt-1 text-xs">
                  This title is confirmed as yours. Review how many people open it and open your documents.
                </p>
                <TitleEngagementStats stats={engagement} />
              </div>
              <form action={publishTitleDocument} className="space-y-3">
                <h2 className="text-dash-foreground text-sm font-semibold">Publish a document</h2>
                <p className="text-dash-muted-foreground text-xs">A published document is shown to anyone who opens this title.</p>
                <input type="hidden" name="claimId" value={myClaim.id} />
                <input type="hidden" name="routeId" value={routeId} />
                <label className="block text-sm">
                  <span className="text-dash-muted-foreground text-xs">Document name</span>
                  <input name="name" required className="border-dash-border mt-1 w-full border-b bg-transparent py-2 text-sm outline-none" />
                </label>
                <input name="file" type="file" required className="text-sm" />
                <button type="submit" className="text-dash-foreground border-b border-current text-sm font-semibold">
                  Publish
                </button>
              </form>
            </section>
          ) : null}
        </div>

        <aside className="min-w-0 xl:sticky xl:top-28">
          <TitleRelated item={item} related={related} />
        </aside>
      </div>
    </div>
  );
}

function titleTarget(item: ReviewItem): { kind: TitleTargetKind; id: string } {
  if (item.kind === "earlier") return { kind: "earlier", id: item.id.replace(/^earlier:/, "") };
  return { kind: "proposal", id: item.id };
}

function yearSpan(label: string): string {
  const match = /^(20\d{2})\/(20\d{2})$/.exec(label);
  if (!match) return label;
  return `30 Sep ${match[1]} – 29 Sep ${match[2]}`;
}
