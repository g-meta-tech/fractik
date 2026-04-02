"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const project = useQuery(api.projects.getBySlug, { slug });

  if (project === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
        <div className="mt-8 h-32 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-bold">Proyecto no encontrado</h1>
        <p className="mt-2 text-muted-foreground">
          El proyecto no existe o no pertenece a tu organizaci&oacute;n.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
      {project.description && (
        <p className="mt-2 text-muted-foreground">{project.description}</p>
      )}

      {project.visionContent && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Vision Statement</h2>
          <div className="mt-3 rounded-lg border bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm">{project.visionContent}</p>
          </div>
        </section>
      )}

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Slug</p>
          <p className="mt-1 font-mono text-sm">{project.slug}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Visibilidad</p>
          <p className="mt-1 text-sm">{project.isPublic ? "P\u00fablico" : "Privado"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Versi\u00f3n Vision</p>
          <p className="mt-1 text-sm">v{project.visionVersionNumber}</p>
        </div>
        {project.githubRepoUrl && (
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">GitHub</p>
            <a
              href={project.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block truncate text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {project.githubRepoUrl.replace("https://github.com/", "")}
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
