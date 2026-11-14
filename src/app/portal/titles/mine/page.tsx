import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "My projects & titles · Honic Company Limited" };

export default async function MyProjectsPage(props: { searchParams?: Promise<{ notice?: string }> }) {
  const search = props.searchParams ? await props.searchParams : {};
  const notice = search.notice ? `&notice=${encodeURIComponent(search.notice)}` : "";
  redirect(`/portal/home?tab=projects${notice}`);
}
