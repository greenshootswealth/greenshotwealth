import React, { Suspense } from "react";
import InsightsContent from "./InsightsClient";
import { getPublishedReports } from "@/lib/research/server";
import { toPublicationCard, type PublicationCard } from "@/lib/research/types";

export default async function InsightsPage() {
  let publications: PublicationCard[] = [];
  try {
    publications = (await getPublishedReports()).map(toPublicationCard);
  } catch (error) {
    // Blogs still render if the reports query fails.
    console.error("Failed to load research reports:", error);
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F1E8]" />}>
      <InsightsContent publications={publications} />
    </Suspense>
  );
}
