import Link from "next/link";
import { after } from "next/server";
import type { ReactNode } from "react";

import { publishTitleDocument } from "@/app/portal/title-claim-actions";
import { NexisBrandBar } from "@/components/brand/nexis-brand-bar";
import { TitlesFrame } from "@/components/portal/cohort-title-board";
import { DocumentsUnlockPanel } from "@/components/portal/documents-unlock-panel";
import { LinkifiedText } from "@/components/portal/linkified-text";
import { ProfileForm } from "@/components/portal/profile-form";
import { SiteFooter } from "@/components/portal/site-footer";
import { TitleJumpNav } from "@/components/portal/title-jump-nav";
import { TitleRelated } from "@/components/portal/title-related";
import { TitleSelectAction } from "@/components/portal/title-select-panel";
import { TitleTermsGate } from "@/components/portal/title-terms-gate";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { hasProjectDocumentsAccess } from "@/lib/portal/document-access";
import { TitleEngagementStats } from "@/components/portal/title-engagement-stats";
import { claimsForTarget, publishedDocuments, type TitleClaim, type TitleTargetKind } from "@/lib/portal/title-claims";
import { engagementForTargets, recordTitleClick, type TitleEngagement } from "@/lib/portal/title-engagement";
import { projectMark } from "@/lib/portal/project-mark";
import { loadGuestLiteratureCatalogue, loadStudentLiteratureCatalogue } from "@/lib/portal/literature-guest-cache";
import { loadReviewItemWithCatalogue, type ReviewItem } from "@/lib/portal/title-choices";
import {
  planModeLabel,
  titleHideEntitlement,
  type TitleHideEntitlement,
} from "@/lib/portal/title-limits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";
import { parseTitleListFiltersFromRecord, titleListHref } from "@/lib/portal/title-list-filters";
import {
  portalFixedHeaderAsideSticky,
  portalTitleSectionScrollMt,
} from "@/lib/portal/fixed-header";
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
  published: "The document is published. Viewers need a Nexis Desk plan or documents unlock to open it.",
  missing: "Add the missing name or file.",
  large: "That file is larger than 25 MB.",
  owner: "Only the confirmed owner can publish documents.",
  upload: "The document could not be stored.",
  unavailable: "Claims are not ready yet.",
};

export default async function PortalTitlePage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, search] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const listFilters = parseTitleListFiltersFromRecord(search);
  const listHref = titleListHref(listFilters);
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();

  if (!db) {
    return (
      <Gate>
        <p className="text-dash-muted-foreground text-sm">The title list is not available right now.</p>
      </Gate>
    );
  }

  const guest = !user;
  if (user && !state.isStaff && !profile) {
    return (
      <Gate>
        <ProfileForm
          courses={state.courses}
          profile={profile}
          suggestedName={user.suggestedName}
          needsPasswordSetup={user.needsPasswordSetup}
        />
      </Gate>
    );
  }
  const terms = state.titleTerms ?? { accepted: false, policyAccepted: false, rulesAccepted: false, acceptedAt: null };
  const acceptedAt = terms.acceptedAt;
  if (user && !state.isStaff && profile && !terms.accepted) {
    return (
      <Gate>
        <TitleTermsGate step={terms.policyAccepted ? "rules" : "policy"} />
      </Gate>
    );
  }

  const routeId = decodeURIComponent(id);
  const cataloguePromise =
    guest || state.isStaff
      ? loadGuestLiteratureCatalogue()
      : loadStudentLiteratureCatalogue(user!.id, profile!);
  const membershipPromise =
    user && !state.isStaff && db ? findMembership(db, user.id) : Promise.resolve(null);

  const [prefetched, membership] = await Promise.all([cataloguePromise, membershipPromise]);

  const { item, review } = await loadReviewItemWithCatalogue(
    db,
    guest || state.isStaff ? null : user!.id,
    guest || state.isStaff ? null : profile,
    routeId,
    prefetched,
  );
  const courseName = new Map(state.courses.map((course) => [course.code, course.name]));
  const noticeKey =
    typeof search.notice === "string" ? search.notice : Array.isArray(search.notice) ? search.notice[0] : undefined;
  const notice = noticeKey ? NOTICES[noticeKey] : null;
  const target = item ? titleTarget(item) : null;
  const claims = target ? await claimsForTarget(db, target.kind, target.id) : [];
  const confirmed = claims.filter((claim) => claim.status === "confirmed");
  const mineClaim =
    !guest && !state.isStaff && user ? confirmed.find((claim) => claim.requesterId === user.id) ?? null : null;
  const ownerId = confirmed[0]?.requesterId ?? null;

  const [documents, canViewDocuments, engagementMap] = await Promise.all([
    confirmed.length ? publishedDocuments(db, confirmed.map((claim) => claim.id)) : Promise.resolve([]),
    !guest && user
      ? hasProjectDocumentsAccess(db, {
          userId: user.id,
          deskExpiresAt: profile?.deskExpiresAt ?? null,
          isStaff: state.isStaff,
          isDocumentOwner: Boolean(mineClaim),
        })
      : Promise.resolve(false),
    target && confirmed.length
      ? engagementForTargets(db, [target])
      : Promise.resolve(new Map<string, TitleEngagement>()),
  ]);

  const files = documents.map((document) => ({
    id: document.id,
    name: document.name,
    href: canViewDocuments ? `/api/portal/title-documents/${document.id}` : null,
  }));

  if (!guest && user && target && confirmed.length) {
    after(() =>
      recordTitleClick(db, {
        targetKind: target.kind,
        targetId: target.id,
        viewerId: user.id,
        ownerId,
        isStaff: state.isStaff,
      }),
    );
  }

  const engagement = target ? engagementMap.get(`${target.kind}:${target.id}`) ?? null : null;
  const isMine = Boolean(item && review.mine.some((entry) => entry.id === item.id));
  const viewer = guest
    ? { name: "Guest", detail: "Preview · sign in to use", homeHref: "/portal/home" as string | null }
    : state.isStaff
      ? { name: user!.email, detail: "Staff · reading only", homeHref: null }
      : {
          name: profile?.fullName || user!.email,
          detail: profile
            ? [profile.courseOther ?? profile.courseCode, studyLevelLabel(profile.studyLevel, profile.studyLevelOther), profile.institution]
                .filter(Boolean)
                .join(" · ") || null
            : null,
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

  const locked = guest || state.isStaff;

  return (
    <TitlesFrame
      items={review.items}
      mine={review.mine}
      courses={state.courses}
      studentYear={guest || state.isStaff ? null : profile?.academicYear ?? null}
      acceptedOn={acceptedAt ? formatDate(acceptedAt) : null}
      readOnly={locked}
      guest={guest}
      viewer={viewer}
      hasWorkspace={Boolean(membership)}
      hasProgress={Boolean(profile?.trackedProjectId)}
      deskExpiresAt={profile?.deskExpiresAt ?? null}
      catalogueTools={false}
    >
      <article className="w-full px-4 pt-4 pb-10 sm:px-6 sm:pt-5 lg:px-8">
        {guest ? (
          <p className="border-dash-border bg-dash-card mb-6 rounded-xl border px-4 py-3 text-sm">
            Preview mode — read the brief and references.{" "}
            <Link href="/portal?auth=signin" className="text-dash-accent font-semibold">
              Sign in
            </Link>{" "}
            to shortlist, claim, or open source files.
          </p>
        ) : null}
        {notice ? <p className="border-dash-border mb-6 rounded-lg border bg-emerald-500/10 px-3 py-2 text-sm">{notice}</p> : null}
        {item && target && related ? (
          <TitleDetail
            listHref={listHref}
            listFilters={listFilters}
            item={item}
            routeId={routeId}
            department={item.courseCode ? (courseName.get(item.courseCode) ?? item.courseCode) : null}
            files={files}
            myClaim={mineClaim}
            engagement={engagement}
            related={related}
            isMine={isMine}
            selectedCount={review.mine.length}
            readOnly={locked}
            readOnlyReason={guest ? "guest" : "staff"}
            phone={profile?.phone ?? ""}
            canViewDocuments={canViewDocuments}
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
          <MissingTitle listHref={listHref} />
        )}
      </article>
    </TitlesFrame>
  );
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <NexisBrandBar />
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</div>
      <SiteFooter />
    </main>
  );
}

function MissingTitle({ listHref }: { listHref: string }) {
  return (
    <div>
      <h1 className="text-dash-foreground text-2xl font-semibold tracking-tight">This title is not available</h1>
      <p className="text-dash-muted-foreground mt-3 text-sm leading-relaxed">It may be hidden for your group, or it is no longer on the list.</p>
      <Link href={listHref} className="text-dash-accent mt-4 inline-block text-sm font-semibold">
        Back to all titles
      </Link>
    </div>
  );
}

function TitleDetail({
  listHref,
  listFilters,
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
  readOnlyReason = "staff",
  phone,
  canViewDocuments,
  entitlement,
  isHiddenFromPeers,
  planMode,
}: {
  listHref: string;
  listFilters: ReturnType<typeof parseTitleListFiltersFromRecord>;
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
  readOnlyReason?: "staff" | "guest";
  phone: string;
  canViewDocuments: boolean;
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
  const hasSourceFile = Boolean(files.length || item.sourceUrl);
  const sectionTitle = "text-blue-600 text-sm font-semibold dark:text-blue-400";
  const jumps: [string, string][] = [
    ["#details", "Details"],
    ["#brief", "Problem & objectives"],
    ["#recommendations", "Recommendations"],
    ["#references", "References"],
    ...(item.hardware ? [["#hardware", "Hardware"] as [string, string]] : []),
    ["#documents", "Documents"],
    ["#more", "Related"],
  ];
  const selectPanel = (
    <TitleSelectAction
      proposalId={item.id}
      canChoose={item.canChoose}
      isMine={isMine}
      isHiddenFromPeers={isHiddenFromPeers}
      selectedCount={selectedCount}
      readOnly={readOnly}
      readOnlyReason={readOnlyReason}
      needsPayment={Boolean(entitlement?.needsPayment)}
      hasPaidPlan={Boolean(entitlement?.hasPaidPlan)}
      freeRemaining={entitlement?.freeRemaining ?? 0}
      hideCredits={entitlement?.hideCredits ?? 0}
      phone={phone}
    />
  );

  return (
    <div className="w-full min-w-0 pb-8">
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12">
        <div className="min-w-0">
          <Link href={listHref} className="text-dash-muted-foreground hover:text-dash-foreground text-xs font-semibold">
            ← All titles
          </Link>
          <p className="text-dash-muted-foreground mt-4 text-[11px] leading-relaxed tracking-wide break-words uppercase">
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
                <span className="break-words">{mark.institute}</span>
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
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    plan.mode === "paid"
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                      : "bg-dash-muted text-dash-muted-foreground"
                  }`}
                >
                  {plan.title}
                </span>
                <span className="text-dash-muted-foreground break-words">
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

          <div className="mt-6 xl:hidden">{selectPanel}</div>

          <TitleJumpNav jumps={jumps} />

          {facts.length ? (
            <dl id="details" className={`border-dash-border mt-8 border-t ${portalTitleSectionScrollMt}`}>
              {facts.map(([label, value]) => (
                <div key={label} className="border-dash-border grid gap-1 border-b py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-dash-muted-foreground text-xs font-semibold">{label}</dt>
                  <dd className="text-dash-foreground min-w-0 text-sm leading-relaxed break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <section id="brief" className={`mt-10 space-y-5 ${portalTitleSectionScrollMt}`}>
            <div>
              <h2 className={sectionTitle}>Problem statement</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <LinkifiedText
                  text={
                    item.problemStatement ??
                    (item.summary ? item.summary : "No problem statement was found in the source document yet.")
                  }
                />
              </p>
            </div>
            <div>
              <h2 className={sectionTitle}>Main objective</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <LinkifiedText text={item.objectives ?? "No main objective was found in the source document yet."} />
              </p>
            </div>
            <div>
              <h2 className={sectionTitle}>Specific objectives</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                <LinkifiedText
                  text={item.specificObjectives ?? "No specific objectives were found in the source document yet."}
                />
              </p>
            </div>
          </section>

          <section id="recommendations" className={`mt-10 ${portalTitleSectionScrollMt}`}>
            <h2 className={sectionTitle}>Recommendations</h2>
            <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
              <LinkifiedText
                text={
                  item.limitations ??
                  "No recommendations section was found in the source document yet."
                }
              />
            </p>
          </section>

          <section id="references" className={`mt-10 ${portalTitleSectionScrollMt}`}>
            <h2 className={sectionTitle}>References</h2>
            <p className="text-dash-muted-foreground mt-1 text-xs">Up to 5 from the source report. Open the full document for the complete list.</p>
            <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
              <LinkifiedText
                text={
                  item.references ??
                  "No references were found in the source document yet."
                }
              />
            </p>
          </section>

          {item.hardware ? (
            <section id="hardware" className={`mt-10 ${portalTitleSectionScrollMt}`}>
              <h2 className={sectionTitle}>Hardware</h2>
              <p className="text-dash-foreground mt-2 text-sm leading-relaxed break-words">{item.hardware}</p>
            </section>
          ) : null}

          <section id="documents" className={`mt-10 ${portalTitleSectionScrollMt}`}>
            <h2 className={sectionTitle}>Project source file</h2>
            {hasSourceFile ? (
              canViewDocuments ? (
                <ul className="mt-3 space-y-2">
                  {files.map((file) => (
                    <li key={file.id}>
                      {file.href ? (
                        <a
                          href={file.href}
                          className="text-dash-accent text-sm font-semibold"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View {file.name}
                        </a>
                      ) : (
                        <span className="text-dash-muted-foreground text-sm">{file.name}</span>
                      )}
                    </li>
                  ))}
                  {item.sourceUrl ? (
                    <li>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-dash-accent text-sm font-semibold"
                      >
                        {/catalogue-docs/i.test(item.sourceUrl)
                          ? "View project report (PDF)"
                          : /github\.com/i.test(item.sourceUrl)
                            ? "Open source repository"
                            : "Open source page"}
                      </a>
                      <p className="text-dash-muted-foreground mt-0.5 text-xs">
                        Opens in the browser for viewing. Download is discouraged.
                      </p>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <>
                  <p className="text-dash-muted-foreground mt-2 text-sm">
                    A source file is attached, but it stays locked until payment. Active Nexis Desk plans unlock viewing;
                    or pay once for project documents access.
                  </p>
                  {!readOnly ? <DocumentsUnlockPanel phone={phone} /> : null}
                </>
              )
            ) : (
              <p className="text-dash-muted-foreground mt-2 text-sm">No full report or source document is stored here yet.</p>
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

        <aside
          className={`min-w-0 space-y-8 xl:sticky xl:max-h-[calc(100dvh-3.6rem)] xl:overflow-y-auto xl:pr-0.5 sm:xl:max-h-[calc(100dvh-4.25rem)] ${portalFixedHeaderAsideSticky}`}
        >
          <div className="hidden xl:block">{selectPanel}</div>
          <TitleRelated item={item} related={related} listFilters={listFilters} className="mt-0" />
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
