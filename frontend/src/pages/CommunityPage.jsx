import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "../api/config";
import PageSurface from "../components/PageSurface";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmProvider";
import usePageTitle from "../hooks/usePageTitle";
import { avatarSrc } from "../constants/avatars";
import Reveal from "../components/Reveal";

/**
 * Community — 운동·식단을 공유하고 서로 댓글·좋아요로 소통하는 피드 (Gleap 톤).
 * 디자인 토큰: bg-paper, text-ink, lilac/lilac-deep, font-display, font-sans.
 */

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const timeAgo = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return iso.slice(5, 10);
};

const inputCls =
  "w-full px-3 py-2 outline-none text-sm font-display bg-paper border border-ink/15 rounded-[10px] focus:border-lilac-deep text-ink transition-colors";

const fieldLabelCls =
  "block font-sans text-[0.72rem] text-taupe tracking-meta uppercase mb-1";

const monoBtnPrimary =
  "font-sans text-[0.78rem] font-medium uppercase px-5 py-3 bg-lilac text-ink rounded-[12px] hover:opacity-90 transition-opacity disabled:opacity-40";

const monoBtnGhost =
  "font-sans text-[0.78rem] tracking-meta uppercase px-3 py-2 text-taupe hover:text-ink transition-colors";

// ============================================================
// PostForm — 글 작성/수정 폼
// ============================================================
const PostForm = ({ initial, onSubmit, onCancel, submitting }) => {
  const [body, setBody] = useState(initial?.body || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [bench, setBench] = useState(initial?.bench ?? "");
  const [deadlift, setDeadlift] = useState(initial?.deadlift ?? "");
  const [squat, setSquat] = useState(initial?.squat ?? "");

  const handle = () => {
    if (!body.trim()) return;
    onSubmit({
      body: body.trim(),
      address: address.trim() || null,
      bench: bench === "" ? null : Number(bench),
      deadlift: deadlift === "" ? null : Number(deadlift),
      squat: squat === "" ? null : Number(squat),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <span className={fieldLabelCls}>Entry · message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="운동 메이트를 찾거나, 오늘 운동을 공유해보세요."
          rows={3}
          className={inputCls + " resize-none italic"}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-1">
          <span className={fieldLabelCls}>Location</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="강남"
            className={inputCls}
          />
        </div>
        {[
          { label: "Squat", value: squat, setter: setSquat },
          { label: "Bench", value: bench, setter: setBench },
          { label: "Deadlift", value: deadlift, setter: setDeadlift },
        ].map((f) => (
          <div key={f.label}>
            <span className={fieldLabelCls}>{f.label} · kg</span>
            <input
              type="number"
              step="0.5"
              inputMode="decimal"
              value={f.value}
              onChange={(e) => f.setter(e.target.value)}
              placeholder="—"
              className={inputCls + " tabular-nums"}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button onClick={onCancel} className={monoBtnGhost}>
            Cancel
          </button>
        )}
        <button
          onClick={handle}
          disabled={submitting || !body.trim()}
          className={monoBtnPrimary + " flex items-center gap-2"}
        >
          {submitting && <Loader2 size={12} className="animate-spin" />}
          → {initial ? "Update" : "Post entry"}
        </button>
      </div>
    </div>
  );
};

// ============================================================
// CommentRow — 댓글 1개
// ============================================================
const CommentRow = ({ comment, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [secret, setSecret] = useState(comment.is_secret);
  const [saving, setSaving] = useState(false);

  const saveEdit = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onUpdate(comment.id, { body: draft.trim(), is_secret: secret });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-3 border-b border-ink/8 last:border-b-0">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="font-display text-sm text-ink">{comment.author.nickname}</span>
        {comment.author.age != null && (
          <span className="font-sans text-[0.72rem] text-taupe">· {comment.author.age}</span>
        )}
        {comment.is_secret && (
          <span className="font-sans text-[0.66rem] text-lilac-deep tracking-meta uppercase">
            · Secret
          </span>
        )}
        <span className="ml-auto font-sans text-[0.66rem] text-hint tracking-meta uppercase">
          {timeAgo(comment.created_at)}
        </span>
        {comment.is_mine && !editing && (
          <>
            <button
              onClick={() => {
                setDraft(comment.body);
                setSecret(comment.is_secret);
                setEditing(true);
              }}
              className="font-sans text-[0.66rem] tracking-meta uppercase text-taupe hover:text-ink"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="font-sans text-[0.66rem] tracking-meta uppercase text-taupe hover:text-ink"
            >
              Delete
            </button>
          </>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={inputCls + " resize-none"}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 font-sans text-[0.72rem] tracking-meta uppercase cursor-pointer text-taupe">
              <input
                type="checkbox"
                checked={secret}
                onChange={(e) => setSecret(e.target.checked)}
                className="accent-lilac-deep"
              />
              Secret
            </label>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className={monoBtnGhost + " !px-2 !py-1"}>
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !draft.trim()}
                className="font-sans text-[0.72rem] tracking-label uppercase text-ink hover:text-ink disabled:opacity-40 flex items-center gap-1"
              >
                {saving && <Loader2 size={10} className="animate-spin" />}
                → Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p
          className={`font-display text-sm leading-relaxed whitespace-pre-wrap ${
            comment.can_read ? "text-body" : "italic text-hint"
          }`}
        >
          {comment.body}
        </p>
      )}
    </div>
  );
};

// ============================================================
// PostCard — 커뮤니티 글 1개 (스탯·댓글·좋아요)
// ============================================================
const PostCard = ({
  post,
  onLike,
  onDelete,
  onUpdate,
  onLoadComments,
  comments,
  commentsLoading,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSecret, setCommentSecret] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const stats = useMemo(() => {
    const parts = [];
    if (post.squat != null) parts.push({ label: "Squat", value: post.squat });
    if (post.bench != null) parts.push({ label: "Bench", value: post.bench });
    if (post.deadlift != null) parts.push({ label: "Deadlift", value: post.deadlift });
    return parts;
  }, [post.squat, post.bench, post.deadlift]);

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) onLoadComments(post.id);
  };

  const submitEdit = async (payload) => {
    setEditSubmitting(true);
    try {
      await onUpdate(post.id, payload);
      setEditing(false);
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitComment = async () => {
    if (!commentDraft.trim()) return;
    setCommentSubmitting(true);
    try {
      await onAddComment(post.id, { body: commentDraft.trim(), is_secret: commentSecret });
      setCommentDraft("");
      setCommentSecret(false);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const noLabel = String(post.id).padStart(3, "0");

  return (
    <article className="grid grid-cols-[2.75rem_1fr] md:grid-cols-[4.5rem_1fr_auto] gap-4 md:gap-5 p-6 md:p-7 mt-5 rounded-[28px] bg-paper border border-ink/10 shadow-[0_10px_28px_-10px_rgba(26,20,16,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(26,20,16,0.2)] items-start">
      {/* Avatar — 설정한 아바타 이미지, 없으면 닉네임 첫 글자 */}
      <div className="w-11 h-11 md:w-[4.5rem] md:h-[4.5rem] rounded-full overflow-hidden bg-paper-soft border border-ink/15 flex items-center justify-center font-sans text-lg md:text-2xl text-taupe">
        {avatarSrc(post.author.avatar) ? (
          <img src={avatarSrc(post.author.avatar)} alt="" className="w-full h-full object-cover" />
        ) : (
          post.author.nickname?.[0]?.toUpperCase() || "?"
        )}
      </div>

      {/* 본문 컬럼 */}
      <div className="min-w-0">
        {/* 헤더 라인 */}
        <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
          <span className="font-sans text-[0.78rem] text-hint">No. {noLabel}</span>
          <span className="font-display text-lg md:text-xl text-ink leading-tight">
            {post.author.nickname}
          </span>
          <span className="font-sans text-[0.78rem] text-taupe">
            {post.author.age != null && <>· {post.author.age}</>}
            {post.address && <> · {post.address}</>}
          </span>
          {/* Active — 모바일은 헤더 줄 우측에 inline (데스크탑은 우측 컬럼에 별도 표시) */}
          <span className="md:hidden ml-auto font-sans text-[0.66rem] text-hint tracking-meta uppercase whitespace-nowrap">
            ● {timeAgo(post.created_at)}
          </span>
        </div>

        {/* Stats line */}
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {stats.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-baseline gap-1.5 bg-bone rounded-[10px] px-2.5 py-1 font-sans text-[0.66rem] text-taupe tracking-meta uppercase"
              >
                {s.label}
                <span className="font-display text-sm text-ink tabular-nums normal-case tracking-normal">
                  {s.value}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* 본문 또는 수정 폼 */}
        {editing ? (
          <PostForm
            initial={post}
            onSubmit={submitEdit}
            onCancel={() => setEditing(false)}
            submitting={editSubmitting}
          />
        ) : (
          <blockquote className="font-sans text-[0.9375rem] text-ink leading-relaxed border-l-2 border-lilac-deep pl-3 mb-4 whitespace-pre-wrap m-0">
            "{post.body}"
          </blockquote>
        )}

        {/* 액션 라인 */}
        {!editing && (
          <div className="flex flex-wrap gap-4 font-sans text-[0.78rem] tracking-meta uppercase">
            <button
              onClick={toggleExpand}
              className="text-ink hover:text-ink transition-colors"
            >
              → Comment{" "}
              <span className="text-hint normal-case tracking-normal">({post.comment_count})</span>
            </button>
            <button
              onClick={() => onLike(post.id)}
              className={`transition-colors ${
                post.liked_by_me ? "text-ink" : "text-taupe hover:text-ink"
              }`}
            >
              {post.liked_by_me ? "♥" : "♡"} Like{" "}
              <span className="text-hint normal-case tracking-normal">({post.like_count})</span>
            </button>
            {post.is_mine && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-taupe hover:text-ink transition-colors ml-auto"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(post.id)}
                  className="text-taupe hover:text-ink transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Active status (우측 상단) — 데스크탑 전용, 모바일은 헤더 라인에 inline */}
      <div className="hidden md:block font-sans text-[0.66rem] text-hint tracking-meta uppercase whitespace-nowrap pt-1">
        ● Active {timeAgo(post.created_at)}
      </div>

      {/* 댓글 영역 (펼침 시 full width) */}
      {expanded && (
        <div className="col-span-2 md:col-span-3 ml-0 md:ml-[5.75rem] mt-4 pt-4 border-t border-ink/12">
          <div className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] text-lilac-deep tracking-label uppercase mb-3">
            — Comments ({post.comment_count})
          </div>

          {commentsLoading ? (
            <div className="flex items-center gap-2 text-taupe py-2">
              <Loader2 className="animate-spin" size={12} />
              <span className="font-sans text-[0.72rem] tracking-meta uppercase">Loading…</span>
            </div>
          ) : (
            <div>
              {(comments || []).length === 0 && (
                <p className="font-sans text-sm text-hint py-2">
                  아직 댓글이 없어요 — 첫 댓글을 남겨보세요.
                </p>
              )}
              {(comments || []).map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  onUpdate={(id, payload) => onUpdateComment(post.id, id, payload)}
                  onDelete={(id) => onDeleteComment(post.id, id)}
                />
              ))}
            </div>
          )}

          {/* 댓글 입력 */}
          <div className="pt-4 space-y-2">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="댓글을 남겨보세요…"
              rows={2}
              className={inputCls + " resize-none italic"}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-sans text-[0.72rem] tracking-meta uppercase cursor-pointer text-taupe">
                <input
                  type="checkbox"
                  checked={commentSecret}
                  onChange={(e) => setCommentSecret(e.target.checked)}
                  className="accent-lilac-deep"
                />
                Secret note
              </label>
              <button
                onClick={submitComment}
                disabled={commentSubmitting || !commentDraft.trim()}
                className="font-sans text-[0.78rem] tracking-label uppercase text-ink hover:text-ink disabled:opacity-40 flex items-center gap-1"
              >
                {commentSubmitting && <Loader2 size={10} className="animate-spin" />}
                → Send
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

// ============================================================
// CommunityPage
// ============================================================
const CommunityPage = ({ theme }) => {
  usePageTitle('Community · FitCoach');

  const toast = useToast();
  const confirm = useConfirm();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [writeOpen, setWriteOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});

  const fetchPosts = useCallback(() => {
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/community/posts`, { headers: authHeaders() })
      .then((res) => setPosts(res.data || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ---------- Post handlers ----------
  const createPost = async (payload) => {
    setCreating(true);
    try {
      await axios.post(`${API_BASE_URL}/community/posts`, payload, { headers: authHeaders() });
      setWriteOpen(false);
      fetchPosts();
      toast.success("글을 등록했습니다.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "등록에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const updatePost = async (id, payload) => {
    try {
      const res = await axios.patch(`${API_BASE_URL}/community/posts/${id}`, payload, {
        headers: authHeaders(),
      });
      setPosts((prev) => prev.map((p) => (p.id === id ? res.data : p)));
      toast.success("글을 수정했습니다.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "수정에 실패했습니다.");
    }
  };

  const deletePost = async (id) => {
    const ok = await confirm({
      title: "이 글을 삭제할까요?",
      description: "삭제 후 되돌릴 수 없으며, 달린 댓글도 함께 사라집니다.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE_URL}/community/posts/${id}`, { headers: authHeaders() });
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "삭제에 실패했습니다.");
    }
  };

  const togglePostLike = async (id) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/community/posts/${id}/like`,
        null,
        { headers: authHeaders() },
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, liked_by_me: res.data.liked, like_count: res.data.like_count } : p,
        ),
      );
    } catch {
      /* 조용히 실패 */
    }
  };

  // ---------- Comment handlers ----------
  const loadComments = async (postId) => {
    if (commentsByPost[postId]) return;
    setCommentsLoading((m) => ({ ...m, [postId]: true }));
    try {
      const res = await axios.get(`${API_BASE_URL}/community/posts/${postId}/comments`, {
        headers: authHeaders(),
      });
      setCommentsByPost((m) => ({ ...m, [postId]: res.data || [] }));
    } catch {
      setCommentsByPost((m) => ({ ...m, [postId]: [] }));
    } finally {
      setCommentsLoading((m) => ({ ...m, [postId]: false }));
    }
  };

  const addComment = async (postId, payload) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/community/posts/${postId}/comments`,
        payload,
        { headers: authHeaders() },
      );
      setCommentsByPost((m) => ({ ...m, [postId]: [...(m[postId] || []), res.data] }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p)),
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "댓글 등록에 실패했습니다.");
    }
  };

  const updateComment = async (postId, commentId, payload) => {
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/community/comments/${commentId}`,
        payload,
        { headers: authHeaders() },
      );
      setCommentsByPost((m) => ({
        ...m,
        [postId]: (m[postId] || []).map((c) => (c.id === commentId ? res.data : c)),
      }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "댓글 수정에 실패했습니다.");
    }
  };

  const deleteComment = async (postId, commentId) => {
    const ok = await confirm({
      title: "이 댓글을 삭제할까요?",
      description: "삭제 후 되돌릴 수 없습니다.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE_URL}/community/comments/${commentId}`, {
        headers: authHeaders(),
      });
      setCommentsByPost((m) => ({
        ...m,
        [postId]: (m[postId] || []).filter((c) => c.id !== commentId),
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) - 1) } : p,
        ),
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "댓글 삭제에 실패했습니다.");
    }
  };

  const activeCount = posts.length;

  return (
    <div
      className="fixed inset-0 lg:left-[var(--sb-w,15rem)] transition-[left] duration-300 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: "none" }}
    >
      <PageSurface maxWidth={1100}>
      <div className="w-full px-6 md:px-12 py-8">

        {/* 헤드라인 영역 — 텍스트만 좁게 */}
        <Reveal className="max-w-[40rem] pb-8">
          <div className="mb-3">
            <span className="inline-block bg-lilac/60 rounded-[10px] px-3 py-1 font-sans text-[0.78rem] font-medium tracking-wide text-ink">
              Community
            </span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.0] tracking-tight font-normal">
            Lift, share, <em className="italic text-lilac-deep">grow<br />together.</em>
          </h1>
          <p className="font-sans text-sm text-taupe mt-3 leading-relaxed">
            오늘의 운동과 식단을 공유하고, 서로의 기록에 응원과 조언을 남기는 곳.
          </p>
        </Reveal>

        {/* 글쓰기 액션 라인 (Filter 위치 활용) */}
        <div className="flex items-center justify-between border-t border-b border-ink/12 py-3 mb-0">
          <span className="font-sans text-[0.72rem] text-hint tracking-meta uppercase">
            Latest entries
          </span>
          <button
            onClick={() => setWriteOpen((v) => !v)}
            className="font-sans text-[0.78rem] tracking-label uppercase text-ink hover:text-ink transition-colors"
          >
            {writeOpen ? "× Close form" : "→ Write an entry"}
          </button>
        </div>

        {/* 글쓰기 폼 */}
        {writeOpen && (
          <Reveal delay={80}>
            <section className="mt-6 rounded-[28px] bg-gradient-to-br from-lilac/40 to-paper border border-ink/10 shadow-[0_10px_28px_-10px_rgba(26,20,16,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(26,20,16,0.2)] p-6">
              <div className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] text-ink tracking-label uppercase mb-4">
                — Post your own
              </div>
              <PostForm
                onSubmit={createPost}
                onCancel={() => setWriteOpen(false)}
                submitting={creating}
              />
            </section>
          </Reveal>
        )}

        {/* 글 목록 */}
        {loading && (
          <div className="py-16 text-center text-taupe">
            <Loader2 className="animate-spin mx-auto mb-3" size={18} />
            <p className="font-sans text-[0.72rem] tracking-meta uppercase">Loading entries…</p>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-display text-lg text-ink mb-2">No entries yet.</p>
            <p className="font-sans text-sm text-taupe">
              첫 글을 남겨 운동 메이트를 찾아보세요.
            </p>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <Reveal delay={160}>
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onLike={togglePostLike}
                onDelete={deletePost}
                onUpdate={updatePost}
                onLoadComments={loadComments}
                comments={commentsByPost[p.id]}
                commentsLoading={!!commentsLoading[p.id]}
                onAddComment={addComment}
                onUpdateComment={updateComment}
                onDeleteComment={deleteComment}
              />
            ))}
          </Reveal>
        )}

        {/* Post your own CTA (하단) */}
        {!loading && posts.length > 0 && !writeOpen && (
          <div className="mt-10 py-8 border-t border-ink/15 bg-lilac/[0.04] -mx-6 md:-mx-12 px-6 md:px-12">
            <div className="inline-block bg-bone rounded-[10px] px-3 py-1 font-sans text-[0.72rem] text-lilac-deep tracking-label uppercase mb-3">
              — Post your own
            </div>
            <p className="font-sans text-[1.0625rem] text-ink leading-relaxed mb-4 max-w-[40rem]">
              오늘의 운동, 식단, 혹은 고민을 나눠보세요. 함께라면 더 멀리 갑니다.
            </p>
            <button
              onClick={() => setWriteOpen(true)}
              className="bg-lilac text-ink rounded-[12px] px-5 py-3 font-sans text-[0.78rem] font-medium uppercase hover:opacity-90 transition-opacity"
            >
              → Write an entry
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-sans text-[0.78rem] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">Community · {activeCount}</span>
        </div>
      </div>
      </PageSurface>
    </div>
  );
};

export default CommunityPage;
