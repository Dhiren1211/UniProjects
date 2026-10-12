"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  FileQuestion,
  FolderKanban,
  Github,
  Globe,
  MessageSquare,
  MessagesSquare,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accentOf } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  fetchProfile,
  toggleFollow,
  type Navigate,
  type PostDTO,
  type ProfileResponse,
  type ProjectListItem,
} from "../api-client";
import { useAppStore } from "../store";
import { ProjectCard } from "../project-card";
import {
  EmptyState,
  MemberAvatar,
  StaffBadge,
  TeammateWantedChip,
  UserAvatar,
  formatMonthYear,
  timeAgo,
} from "../ui-bits";

export function ProfileView({ username, navigate }: { username: string; navigate: Navigate }) {
  const { user: viewer, openAuth } = useAppStore();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchProfile(username, ac.signal)
      .then((p) => {
        setProfile(p);
        setFollowing(p.viewerFollows);
        setFollowerCount(p.followerCount);
        setNotFound(false);
        setFailed(false);
      })
      .catch((e) => {
        if (ac.signal.aborted || e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message.toLowerCase() : "";
        if (msg.includes("not found")) setNotFound(true);
        else setFailed(true);
      });
    return () => ac.abort();
  }, [username, retry]);

  if (notFound) {
    return (
      <Page>
        <EmptyState
          icon={FileQuestion}
          title="Profile not found"
          hint="This person may have left campus, or the link is incorrect."
          action={
            <Button
              onClick={() => navigate({ name: "students" })}
              className="rounded-xl font-semibold"
            >
              Browse the directory
            </Button>
          }
        />
      </Page>
    );
  }

  if (failed) {
    return (
      <Page>
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          hint="We couldn't load this profile. Check your connection and try again."
          action={
            <Button
              onClick={() => {
                setProfile(null);
                setFailed(false);
                setRetry((r) => r + 1);
              }}
              variant="outline"
              className="rounded-xl font-semibold"
            >
              Try again
            </Button>
          }
        />
      </Page>
    );
  }

  if (!profile) {
    return (
      <Page>
        {/* Header skeleton */}
        <div className="rounded-2xl border border-up-border bg-card p-6 md:p-8">
          <div className="flex items-start gap-5">
            <div className="size-20 shrink-0 animate-pulse rounded-full bg-surface-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-52 animate-pulse rounded bg-surface-muted" />
              <div className="h-3.5 w-32 animate-pulse rounded bg-surface-muted" />
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface-muted" />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-up-border bg-surface-muted" />
          ))}
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-up-border bg-surface-muted" />
          ))}
        </div>
      </Page>
    );
  }

  const { user, projects, posts } = profile;
  const isOwn = viewer?.username === username;
  const accent = user.department ? accentOf(user.department.accent) : null;

  const handleFollow = async () => {
    if (!viewer) {
      toast.info("Sign in to continue");
      openAuth("login");
      return;
    }
    if (followBusy) return;
    const next = !following;
    setFollowing(next);
    setFollowerCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setFollowBusy(true);
    try {
      const res = await toggleFollow({ targetType: "USER", targetId: user.id });
      setFollowing(res.active);
      setFollowerCount((c) =>
        res.active === next ? c : Math.max(0, c + (res.active ? 1 : -1))
      );
    } catch (e) {
      setFollowing(!next);
      setFollowerCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error(e instanceof Error ? e.message : "Could not update follow");
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <Page>
      {/* ---------- Header card ---------- */}
      <section className="rounded-2xl border border-up-border bg-card p-6 shadow-card md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-5">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                aria-hidden
                className="size-20 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <MemberAvatar name={user.displayName} ring={false} className="size-20 text-2xl" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {user.displayName}
                </h1>
                <StaffBadge role={user.role} />
                {user.lookingForTeammates ? <TeammateWantedChip /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>

              {user.bio ? (
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
                  {user.bio}
                </p>
              ) : null}

              {/* Meta chips */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {user.department ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-up-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {accent ? <span aria-hidden className={cn("size-2 rounded-full", accent.dot)} /> : null}
                    {user.department.name}
                  </span>
                ) : null}
                {user.program ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-up-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {user.program}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-up-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Joined {formatMonthYear(user.createdAt)}
                </span>
                {user.website || user.github ? (
                  <span className="inline-flex items-center gap-1.5">
                    {user.website ? (
                      <Button
                        asChild
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-xl"
                        aria-label={`${user.displayName}'s website`}
                      >
                        <a href={user.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="size-4" aria-hidden />
                        </a>
                      </Button>
                    ) : null}
                    {user.github ? (
                      <Button
                        asChild
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-xl"
                        aria-label={`${user.displayName} on GitHub`}
                      >
                        <a href={user.github} target="_blank" rel="noopener noreferrer">
                          <Github className="size-4" aria-hidden />
                        </a>
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="shrink-0">
            {isOwn ? (
              <Button
                variant="outline"
                onClick={() => navigate({ name: "settings" })}
                className="h-9 rounded-xl px-4 font-semibold"
              >
                Edit profile
              </Button>
            ) : (
              <Button
                onClick={handleFollow}
                disabled={followBusy}
                variant={following ? "outline" : "default"}
                className="h-9 rounded-xl px-5 font-semibold"
              >
                {following ? "Following" : "Follow"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section aria-label="Profile statistics" className="mt-4 grid grid-cols-3 gap-4">
        {[
          { value: followerCount, label: "Followers", icon: Users },
          { value: profile.followingCount, label: "Following", icon: UserPlus },
          { value: projects.length, label: "Projects", icon: FolderKanban },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-up-border bg-card p-4 shadow-card sm:p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600">
              <s.icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground">{s.value}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* ---------- Tabs ---------- */}
      <Tabs defaultValue="projects" className="mt-8">
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-surface-muted p-1 sm:w-72">
          <TabsTrigger
            value="projects"
            className="rounded-lg text-sm font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Projects
          </TabsTrigger>
          <TabsTrigger
            value="posts"
            className="rounded-lg text-sm font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6">
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" hint="Submitted projects will appear here." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p: ProjectListItem) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={(slug) => navigate({ name: "project", slug })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          {posts.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No posts yet"
              hint="Community posts by this person will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-up-border bg-card shadow-card">
              <ul className="divide-y divide-up-border">
                {posts.map((p: PostDTO) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ name: "community" })}
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-muted/60"
                    >
                      <UserAvatar
                        name={p.user.displayName}
                        avatarUrl={p.user.avatarUrl}
                        ring={false}
                        className="size-9 text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold text-foreground">
                            {p.user.displayName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(p.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {p.body}
                        </p>
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="size-3.5" aria-hidden />
                          {p.commentCount} {p.commentCount === 1 ? "comment" : "comments"}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------- Skills ---------- */}
      {user.skills.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-primary-600">
            Skills
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground/80"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 pb-20 md:px-8 md:py-14">{children}</div>
  );
}
