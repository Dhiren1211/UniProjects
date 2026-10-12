"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Heart,
  Loader2,
  MessageSquare,
  MessagesSquare,
  SendHorizonal,
  Sparkles,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addPostComment,
  createPost,
  deletePost,
  fetchPosts,
  toggleBookmark,
  toggleLike,
  type CommentDTO,
  type Navigate,
  type PostDTO,
  type SafeUserDTO,
} from "../api-client";
import { useAppStore, requireAuth } from "../store";
import { EmptyState, StaffBadge, UserAvatar, timeAgo } from "../ui-bits";

function newestFirst(a: { createdAt: string }, b: { createdAt: string }) {
  return b.createdAt.localeCompare(a.createdAt);
}

export function CommunityView({ navigate }: { navigate: Navigate }) {
  const { user, openAuth } = useAppStore();
  const [posts, setPosts] = useState<PostDTO[] | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchPosts(ac.signal)
      .then((rows) => {
        setPosts([...rows].sort(newestFirst));
        setError(false);
      })
      .catch((e) => {
        if (ac.signal.aborted || e.name === "AbortError") return;
        setPosts([]);
        setError(true);
      });
    return () => ac.abort();
    // refetch when the signed-in user changes so like/bookmark states stay accurate
  }, [retry, user?.id]);

  const loading = posts === null;
  const count = posts?.length ?? 0;

  const patchPost = (updated: PostDTO) => {
    setPosts((prev) => (prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev));
  };

  const removePost = (id: string) => {
    setPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  };

  const submitPost = async () => {
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const post = await createPost(text);
      setPosts((prev) => [post, ...(prev ?? [])]);
      setBody("");
      toast.success("Posted!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish your post");
    } finally {
      setSubmitting(false);
    }
  };

  const tryAgain = () => {
    setPosts(null);
    setError(false);
    setRetry((r) => r + 1);
  };

  // Live numbers for the right rail — computed from the already-loaded feed, no extra API calls.
  const stats = useMemo(() => {
    if (!posts) return null;
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const authors = new Map<string, { user: PostDTO["user"]; count: number }>();
    let likes = 0;
    let week = 0;
    for (const p of posts) {
      likes += p.likeCount;
      if (now - new Date(p.createdAt).getTime() < WEEK) week += 1;
      const entry = authors.get(p.user.id) ?? { user: p.user, count: 0 };
      entry.count += 1;
      authors.set(p.user.id, entry);
    }
    const voices = [...authors.values()].sort((a, b) => b.count - a.count).slice(0, 4);
    return { total: posts.length, week, people: authors.size, likes, voices };
  }, [posts]);

  const submitProject = () => {
    const { user: current, openAuth: open } = useAppStore.getState();
    if (!requireAuth(current, open)) return;
    navigate({ name: "create" });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 pb-20 md:px-8 md:py-14">
      {/* Heading */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Community</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base" aria-live="polite">
          {loading
            ? "Loading posts…"
            : error
              ? "Something went wrong while loading."
              : `${count} ${count === 1 ? "post" : "posts"} from campus`}
        </p>
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main column — composer + feed. Centered below xl, full-width beside the rail above. */}
        <div className="mx-auto w-full max-w-3xl xl:mx-0 xl:max-w-none">
          {/* Composer */}
          {user ? (
            <section
              aria-label="Write a post"
              className="rounded-2xl border border-up-border bg-card p-5 shadow-card"
            >
              <div className="flex gap-3">
                <UserAvatar
                  name={user.displayName}
                  avatarUrl={user.avatarUrl}
                  ring={false}
                  className="size-10 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl border border-up-border bg-card transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
                    <Textarea
                      aria-label="Write a post"
                      placeholder="Share an update, a question, or something you learned…"
                      value={body}
                      rows={body.length > 0 ? 4 : 2}
                      onChange={(e) => setBody(e.target.value)}
                      className="resize-none rounded-2xl border-0 bg-transparent p-3.5 text-[15px] shadow-none focus-visible:border-0 focus-visible:ring-0"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <span className="text-xs text-muted-foreground">
                      {body.length > 0 ? `${body.length} characters` : "Everyone on campus can see this"}
                    </span>
                    <Button
                      onClick={submitPost}
                      disabled={submitting || body.trim().length < 1}
                      className="h-9 rounded-xl px-5 font-semibold"
                    >
                      {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Post"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-up-border bg-card p-5 shadow-card">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                    <MessagesSquare className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                  <p className="font-medium text-foreground">Sign in to join the conversation</p>
                </div>
                <Button onClick={() => openAuth("login")} className="h-9 rounded-xl px-5 font-semibold">
                  Sign in
                </Button>
              </div>
            </section>
          )}

          {/* Feed */}
          <div className="mt-8 space-y-4" aria-live="polite">
            {loading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-up-border bg-card p-5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-10 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-3/4" />
                    </div>
                  </div>
                ))}
              </>
            ) : error ? (
              <EmptyState
                icon={AlertTriangle}
                title="Something went wrong"
                hint="We couldn't load the community feed. Check your connection and try again."
                action={
                  <Button onClick={tryAgain} variant="outline" className="rounded-xl font-semibold">
                    Try again
                  </Button>
                }
              />
            ) : count === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="No posts yet"
                hint={
                  user
                    ? "Your post could be the first — say hello above."
                    : "Be the first to start the conversation."
                }
              />
            ) : (
              posts?.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  viewer={user}
                  openAuth={openAuth}
                  onPatch={patchPost}
                  onRemove={removePost}
                />
              ))
            )}
          </div>
        </div>

        {/* Right rail — turns the wide-screen margins into live community info */}
        <aside className="hidden xl:block" aria-label="Community highlights">
          <div className="sticky top-24 space-y-4">
            {stats ? (
              <>
                <PulseCard stats={stats} />
                <VoicesCard voices={stats.voices} navigate={navigate} />
                <StartCard onClick={submitProject} />
              </>
            ) : (
              <div className="space-y-4">
                <Skeleton className="h-44 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- right rail widgets ----------

type PulseStats = {
  total: number;
  week: number;
  people: number;
  likes: number;
  voices: { user: PostDTO["user"]; count: number }[];
};

function CardHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
        <Icon className="size-4 text-primary-700" aria-hidden />
        {title}
      </h2>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function PulseCard({ stats }: { stats: PulseStats }) {
  const tiles = [
    { label: "Posts", value: stats.total, icon: MessagesSquare },
    { label: "This week", value: stats.week, icon: Sparkles },
    { label: "Voices", value: stats.people, icon: Users },
    { label: "Reactions", value: stats.likes, icon: Heart },
  ];
  return (
    <section className="rounded-2xl border border-up-border bg-card p-5 shadow-card">
      <CardHeading icon={Activity} title="Community pulse" hint="live" />
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-surface-muted/60 px-3.5 py-3">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600">
              <t.icon className="size-4" aria-hidden />
            </span>
            <p className="mt-2 text-xl font-bold leading-none tabular-nums text-foreground">{t.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VoicesCard({
  voices,
  navigate,
}: {
  voices: { user: PostDTO["user"]; count: number }[];
  navigate: Navigate;
}) {
  return (
    <section className="rounded-2xl border border-up-border bg-card p-5 shadow-card">
      <CardHeading icon={Users} title="Active voices" hint="most posts" />
      {voices.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No posts yet — the first voice could be yours.
        </p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {voices.map((v) => (
            <li key={v.user.id}>
              <button
                type="button"
                onClick={() => navigate({ name: "profile", username: v.user.username })}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserAvatar
                  name={v.user.displayName}
                  avatarUrl={v.user.avatarUrl}
                  ring={false}
                  className="size-9 text-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {v.user.displayName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{v.user.username}
                  </span>
                </span>
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary-700">
                  {v.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StartCard({ onClick }: { onClick: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-night p-5 text-white shadow-card">
      <div
        className="absolute -right-10 -top-10 size-32 rounded-full bg-teal-400/20 blur-3xl"
        aria-hidden
      />
      <h2 className="text-sm font-bold tracking-tight">Built something worth showing?</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-white/70">
        Turn your next update into a full project entry — covers, teams, timelines and all.
      </p>
      <Button
        onClick={onClick}
        className="mt-4 h-9 w-full rounded-xl bg-white font-semibold text-night hover:bg-white/90"
      >
        Submit project
      </Button>
    </section>
  );
}

// ---------- post card ----------

function PostCard({
  post,
  viewer,
  openAuth,
  onPatch,
  onRemove,
}: {
  post: PostDTO;
  viewer: SafeUserDTO | null;
  openAuth: (mode?: "login" | "register") => void;
  onPatch: (p: PostDTO) => void;
  onRemove: (id: string) => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwn = viewer?.id === post.user.id;

  const comments: CommentDTO[] = [...post.comments].sort(newestFirst);

  const requireViewer = () => {
    if (viewer) return true;
    import("sonner").then(({ toast: t }) => t.info("Sign in to continue"));
    openAuth("login");
    return false;
  };

  const handleLike = async () => {
    if (!requireViewer()) return;
    const next = !post.liked;
    onPatch({ ...post, liked: next, likeCount: Math.max(0, post.likeCount + (next ? 1 : -1)) });
    try {
      const res = await toggleLike({ targetType: "POST", targetId: post.id });
      onPatch({ ...post, liked: res.active, likeCount: Math.max(0, post.likeCount + (res.active ? 1 : -1)) });
    } catch {
      onPatch(post); // revert
      toast.error("Could not update like");
    }
  };

  const handleBookmark = async () => {
    if (!requireViewer()) return;
    const next = !post.bookmarked;
    onPatch({ ...post, bookmarked: next });
    try {
      const res = await toggleBookmark({ targetType: "POST", targetId: post.id });
      onPatch({ ...post, bookmarked: res.active });
    } catch {
      onPatch(post); // revert
      toast.error("Could not update bookmark");
    }
  };

  const handleComment = async () => {
    const text = commentBody.trim();
    if (!text || commenting) return;
    setCommenting(true);
    try {
      const comment = await addPostComment(post.id, text);
      onPatch({
        ...post,
        comments: [comment, ...post.comments],
        commentCount: post.commentCount + 1,
      });
      setCommentBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add your comment");
    } finally {
      setCommenting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      onRemove(post.id);
      toast.success("Post deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the post");
      setDeleting(false);
    }
  };

  return (
    <article className="card-hover rounded-2xl border border-up-border bg-card p-5 shadow-card">
      {/* Author row */}
      <div className="flex items-start gap-3">
        <UserAvatar
          name={post.user.displayName}
          avatarUrl={post.user.avatarUrl}
          ring={false}
          className="size-10 text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold tracking-tight text-foreground">{post.user.displayName}</span>
            <StaffBadge role={post.user.role} />
            <span className="text-xs text-muted-foreground">@{post.user.username}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
        </div>
        {isOwn ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete post"
                className="size-8 shrink-0 rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the post and all of its comments.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-danger text-white hover:bg-danger/90"
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {/* Body */}
      <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
        {post.body}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-1 border-t border-up-border pt-3">
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={post.liked}
          aria-label={post.liked ? "Unlike post" : "Like post"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
            post.liked && "text-danger hover:text-danger"
          )}
        >
          <Heart className={cn("size-4", post.liked && "fill-current")} aria-hidden />
          {post.likeCount}
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? "Hide comments" : "Show comments"}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <MessageSquare className="size-4" aria-hidden />
          {post.commentCount}
        </button>
        <button
          type="button"
          onClick={handleBookmark}
          aria-pressed={post.bookmarked}
          aria-label={post.bookmarked ? "Remove bookmark" : "Bookmark post"}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
            post.bookmarked && "text-primary-700 hover:text-primary-700"
          )}
        >
          {post.bookmarked ? (
            <BookmarkCheck className="size-4 fill-current" aria-hidden />
          ) : (
            <Bookmark className="size-4" aria-hidden />
          )}
          {post.bookmarked ? "Saved" : "Save"}
        </button>
      </div>

      {/* Comments */}
      {commentsOpen ? (
        <div className="mt-4 space-y-4 border-t border-up-border pt-4">
          {comments.length > 0 ? (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <UserAvatar
                    name={c.user.displayName}
                    avatarUrl={c.user.avatarUrl}
                    ring={false}
                    className="size-8 text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs font-semibold text-foreground">
                        {c.user.displayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No comments yet — start the thread.</p>
          )}

          <div className="flex items-center gap-2">
            <Input
              aria-label="Write a comment"
              placeholder="Write a comment…"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleComment();
                }
              }}
              className="h-9 rounded-xl border-up-border bg-white text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Add comment"
              onClick={handleComment}
              disabled={commenting || commentBody.trim().length < 1}
              className="size-9 shrink-0 rounded-xl"
            >
              {commenting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <SendHorizonal className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
