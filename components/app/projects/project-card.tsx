"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import type { Id } from "@/convex/_generated/dataModel";

interface ProjectCardProps {
  project: {
    _id: Id<"projects">;
    slug: string;
    name: string;
    description: string;
    updatedAt: number;
  };
}

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "hace un momento";
  if (diffMinutes < 60) return `hace ${diffMinutes} ${diffMinutes === 1 ? "minuto" : "minutos"}`;
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  if (diffDays < 30) return `hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;
  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => router.push(`/projects/${project.slug}`)}
    >
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {project.description}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <span className="text-xs text-muted-foreground">
          {relativeTime(project.updatedAt)}
        </span>
      </CardFooter>
    </Card>
  );
}
