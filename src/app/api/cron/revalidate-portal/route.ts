import { revalidatePath, updateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import {
  LITERATURE_CATALOGUE_TAG,
  PORTAL_COURSES_TAG,
  PORTAL_JOBS_TAG,
} from "@/lib/portal/portal-catalogue-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bust portal catalogue / titles caches so returning visitors see fresh briefs. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  updateTag(LITERATURE_CATALOGUE_TAG);
  updateTag(PORTAL_JOBS_TAG);
  updateTag(PORTAL_COURSES_TAG);

  const paths = [
    "/portal",
    "/portal/home",
    "/portal/titles",
    "/portal/titles/mine",
    "/portal/jobs",
    "/portal/jobs/mine",
    "/portal/packs",
  ];
  for (const path of paths) {
    revalidatePath(path);
    revalidatePath(path, "layout");
  }
  revalidatePath("/portal/titles/[id]", "page");
  revalidatePath("/portal/jobs/[id]", "page");

  return NextResponse.json({
    ok: true,
    refreshedAt: new Date().toISOString(),
    tags: [LITERATURE_CATALOGUE_TAG, PORTAL_JOBS_TAG, PORTAL_COURSES_TAG],
    paths,
  });
}
