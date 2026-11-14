import { confirmTitleClaim, rejectTitleClaim } from "@/app/titles/claim-actions";
import {
  claimKindLabel,
  OWNERSHIP_QUESTIONS,
  type TitleClaim,
  type TitleClaimEvidence,
  type TitleEvidenceKind,
} from "@/lib/portal/title-claims";

const EVIDENCE_LABEL: Record<TitleEvidenceKind, string> = {
  project_document: "Project document",
  id_proof: "Ownership proof",
  reference: "Reference",
};

export function TitleClaimReviewList({
  claims,
  evidenceByClaim,
  signedUrls,
  showActions = true,
}: {
  claims: TitleClaim[];
  evidenceByClaim: Map<string, TitleClaimEvidence[]>;
  signedUrls: Map<string, string>;
  showActions?: boolean;
  /** Unused; kept for callers that pass requester context. */
  requesterPublicId?: string;
}) {
  if (!claims.length) {
    return <p className="text-dash-muted-foreground text-sm">No ownership requests for this student yet.</p>;
  }

  return (
    <ul className="space-y-6">
      {claims.map((claim) => {
        const files = evidenceByClaim.get(claim.id) ?? [];
        const docs = files.filter((f) => f.kind === "project_document");
        const proofs = files.filter((f) => f.kind !== "project_document");
        const pending = claim.status === "pending";
        const claimKey = claim.publicId || claim.id;
        return (
          <li key={claimKey} className="border-dash-border border-t pt-4 first:border-t-0 first:pt-0">
            <p className="text-sm font-semibold">{claim.title}</p>
            <p className="text-dash-muted-foreground mt-1 text-xs">
              {claimKindLabel(claim.requestKind)}. Status: {claim.status}
              {claim.proofMethod ? `. Proof by ${claim.proofMethod}` : ""}
            </p>
            {claim.idNumber ? <p className="text-dash-muted-foreground mt-1 text-xs">ID number: {claim.idNumber}</p> : null}

            {docs.length ? (
              <div className="mt-3">
                <p className="text-dash-muted-foreground text-xs font-semibold uppercase">Project documents</p>
                <FileList files={docs} signed={signedUrls} />
              </div>
            ) : null}

            {claim.proofMethod === "questions" && claim.proofAnswers ? (
              <div className="mt-3 space-y-2">
                <p className="text-dash-muted-foreground text-xs font-semibold uppercase">Answers</p>
                {OWNERSHIP_QUESTIONS.map((question) => (
                  <div key={question.id}>
                    <p className="text-dash-muted-foreground text-xs">{question.label}</p>
                    <p className="text-sm leading-relaxed">{claim.proofAnswers?.[question.id] || "Not answered"}</p>
                  </div>
                ))}
              </div>
            ) : proofs.length ? (
              <div className="mt-3">
                <p className="text-dash-muted-foreground text-xs font-semibold uppercase">Ownership proof</p>
                <FileList files={proofs} signed={signedUrls} />
              </div>
            ) : (
              <p className="text-dash-muted-foreground mt-2 text-xs">No proof attached.</p>
            )}

            {showActions && pending && claim.publicId ? (
              <div className="mt-4 flex gap-3">
                <form action={confirmTitleClaim}>
                  <input type="hidden" name="claimPublicId" value={claim.publicId} />
                  <button type="submit" className="text-dash-foreground border-b border-current text-sm font-semibold">
                    Confirm ownership
                  </button>
                </form>
                <form action={rejectTitleClaim}>
                  <input type="hidden" name="claimPublicId" value={claim.publicId} />
                  <button type="submit" className="text-dash-muted-foreground text-sm font-semibold">
                    Reject
                  </button>
                </form>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function FileList({ files, signed }: { files: TitleClaimEvidence[]; signed: Map<string, string> }) {
  return (
    <ul className="mt-1.5 space-y-1">
      {files.map((file) => {
        const href = signed.get(file.id);
        return (
          <li key={file.id} className="text-sm">
            <span className="text-dash-muted-foreground text-xs uppercase">{EVIDENCE_LABEL[file.kind]}: </span>
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="text-dash-accent font-semibold">
                {file.name}
              </a>
            ) : (
              <span className="font-semibold">{file.name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
