import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReportView from "@/components/research/ReportView";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPublishedReports, toPublication } from "@/lib/research/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report Preview | Green Shoots Wealth Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Renders any report, draft or live, exactly as the public page would. Admins only. */
export default async function ResearchPreviewPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-[#F5F1E8] flex items-center justify-center text-sm text-[#1F3A2C]">
        <Link href="/admin" className="underline">
          Sign in to the admin portal to preview this report.
        </Link>
      </div>
    );
  }

  const { id } = await params;
  const row = await prisma.researchReport.findUnique({ where: { id } });
  if (!row) notFound();

  const pub = toPublication(row);
  const live = await getPublishedReports();
  const others = live.filter((p) => p.id !== pub.id).slice(0, 3);

  return <ReportView pub={pub} otherPublications={others} totalReports={live.length} preview />;
}
