"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eye, Star } from "lucide-react";
import { accentOf } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { ProjectListItem } from "./api-client";
import { formatViews, CategoryIcon, TeammateWantedChip, UserAvatar, VerifiedBadge } from "./ui-bits";

export function ProjectCard({
  project,
  onOpen,
  featured = false,
}: {
  project: ProjectListItem;
  onOpen: (slug: string) => void;
  featured?: boolean;
}) {
  const accent = accentOf(project.department.accent);
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      role="button"
      tabIndex={0}
      aria-label={`View project: ${project.title}`}
      onClick={() => onOpen(project.slug)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(project.slug);
        }
      }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-[20px] border border-up-border bg-card text-left outline-none transition-[border-color] duration-200 hover:border-up-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* Cover */}
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
          accent.cover,
          featured ? "h-48" : "aspect-[16/10]"
        )}
      >
        {project.coverImage ? (
          <img
            src={project.coverImage}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
          />
        ) : null}
        {project.coverImage ? null : (
          <span className="flex size-12 items-center justify-center rounded-2xl bg-background/85 text-foreground/60 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <CategoryIcon category={project.category} className="size-6" />
          </span>
        )}
        {project.featured ? (
          <span
            className={cn(
              "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-primary-700 shadow-sm",
              project.coverImage ? "bg-background/85" : "bg-background/85"
            )}
          >
            <Star className="size-3 fill-current" aria-hidden />
            Featured
          </span>
        ) : null}
        <span className="absolute right-3 top-3 flex items-center gap-1.5">
          {project.verified ? <VerifiedBadge /> : null}
          <span
            className={cn(
              "rounded-full border border-transparent bg-background/85 px-2 py-0.5 text-[13px] font-medium text-foreground"
            )}
          >
            {project.department.code}
          </span>
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="t-label">
          {project.category} · {project.year} {project.semester}
        </p>
        <h3 className="mt-1.5 line-clamp-1 text-lg font-medium tracking-tight text-foreground transition-colors group-hover:text-primary">
          {project.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-ink-700">
          {project.summary}
        </p>

        {/* Tech used */}
        {project.technologies.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.technologies.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {t.name}
              </span>
            ))}
            {project.technologies.length > 3 ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                +{project.technologies.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        {project.lookingForTeammates ? (
          <div className="mt-3">
            <TeammateWantedChip />
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-up-border pt-4">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {project.members.slice(0, 4).map((m) => (
                <UserAvatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} />
              ))}
            </div>
            {project.members.length > 4 ? (
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                +{project.members.length - 4}
              </span>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <Eye className="size-3.5" aria-hidden />
            {formatViews(project.views)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export function ProjectCardGrid({
  projects,
  onOpen,
}: {
  projects: ProjectListItem[];
  onOpen: (slug: string) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onOpen={onOpen} />
      ))}
    </div>
  );
}
