import Link from "next/link";

import { PeerHelpStaffQueues } from "@/components/finance/peer-help-staff-queues";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireStaffPage } from "@/lib/portal/accounts";
import { listDisputedEscrowsForStaff, listQueuedPeerPayoutsForStaff } from "@/lib/portal/job-escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Peer-help ops · Finance · Honic" };

export default async function FinancePeerHelpPage() {
  const db = await requireStaffPage();
  const [disputes, payouts] = await Promise.all([
    listDisputedEscrowsForStaff(db),
    listQueuedPeerPayoutsForStaff(db),
  ]);

  return (
    <DashboardShell
      title="Peer-help ops"
      subtitle="Disputes and helper payout queue for protected escrow."
      statusDotClass="bg-emerald-500"
      headerBelow={
        <Link href="/finance" className="text-dash-accent text-sm font-semibold">
          ← Finance ledger
        </Link>
      }
    >
      <PeerHelpStaffQueues disputes={disputes} payouts={payouts} />
    </DashboardShell>
  );
}
