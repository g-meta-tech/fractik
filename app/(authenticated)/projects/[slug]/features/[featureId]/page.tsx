"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FeatureDetail } from "@/components/app/features/feature-detail";

export default function FeatureDetailPage() {
  const { featureId } = useParams<{ slug: string; featureId: string }>();
  const feature = useQuery(api.features.get, {
    featureId: featureId as Id<"features">,
  });

  if (feature === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 h-64 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (feature === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-bold">Feature no encontrado</h1>
        <p className="mt-2 text-muted-foreground">
          El feature no existe o no pertenece a tu organización.
        </p>
      </div>
    );
  }

  return <FeatureDetail feature={feature} />;
}
