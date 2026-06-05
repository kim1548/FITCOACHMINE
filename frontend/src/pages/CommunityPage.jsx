import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "../api/config";
import PageSurface from "../components/PageSurface";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmProvider";
import usePageTitle from "../hooks/usePageTitle";
import { avatarSrc } from "../constants/avatars";

/**
 * Personals — 운동 메이트 매거진 컬럼 (Editorial Magazine 톤).
 * 디자인 토큰: bg-paper, text-ink, accent-red, accent-gold, font-display, font-mono.
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
  "w-full px-3 py-2 outline-none text-sm font-display bg-paper border border-ink/15 focus:border-accent-red text-ink transition-colors";

const fieldLabelCls =
  "block font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-1";

const monoBtnPrimary =
  "font-mono text-[0.6875rem] tracking-label uppercase px-5 py-2 border border-accent-red text-accent-red hover:bg-accent-red hover:text-ink transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent-red";

const monoBtnGhost =
  "font-mono text-[0.6875rem] tracking-meta uppercase px-3 py-2 text-taupe hover:text-ink transition-colors";

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
          <span className="font-mono text-[0.625rem] text-taupe">· {comment.author.age}</span>
        )}
        {comment.is_secret && (
          <span className="font-mono text-[0.5625rem] text-accent-gold tracking-meta uppercase">
            · Secret
          </span>
        )}
        <span className="ml-auto font-mono text-[0.5625rem] text-hint tracking-meta uppercase">
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
              className="font-mono text-[0.5625rem] tracking-meta uppercase text-taupe hover:text-ink"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="font-mono text-[0.5625rem] tracking-meta uppercase text-taupe hover:text-accent-red"
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
            <label className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-meta uppercase cursor-pointer text-taupe">
              <input
                type="checkbox"
                checked={secret}
                onChange={(e) => setSecret(e.target.checked)}
                className="accent-accent-red"
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
                className="font-mono text-[0.625rem] tracking-label uppercase text-accent-red hover:text-ink disabled:opacity-40 flex items-center gap-1"
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
// PostCard — Personals entry (글 1개)
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
    if (post.squat != null) parts.push(`Squat ${post.squat}`);
    if (post.bench != null) parts.push(`Bench ${post.bench}`);
    if (post.deadlift != null) parts.push(`Deadlift ${post.deadlift}`);
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
    <article className="grid grid-cols-[2.75rem_1fr] md:grid-cols-[4.5rem_1fr_auto] gap-4 md:gap-5 py-6 md:py-7 border-t border-ink/10 first:border-t-0 items-start">
      {/* Avatar — 설정한 아바타 이미지, 없으면 닉네임 첫 글자 */}
      <div className="w-11 h-11 md:w-[4.5rem] md:h-[4.5rem] rounded-full overflow-hidden bg-paper-soft border border-ink/15 flex items-center justify-center font-display italic text-lg md:text-2xl text-taupe">
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
          <span className="font-display italic text-[0.6875rem] text-hint">No. {noLabel}</span>
          <span className="font-display text-lg md:text-xl text-ink leading-tight">
            {post.author.nickname}
          </span>
          <span className="font-mono text-[0.6875rem] text-taupe">
            {post.author.age != null && <>· {post.author.age}</>}
            {post.address && <> · {post.address}</>}
          </span>
          {/* Active — 모바일은 헤더 줄 우측에 inline (데스크탑은 우측 컬럼에 별도 표시) */}
          <span className="md:hidden ml-auto font-mono text-[0.5625rem] text-hint tracking-meta uppercase whitespace-nowrap">
            ● {timeAgo(post.created_at)}
          </span>
        </div>

        {/* Stats line */}
        {stats.length > 0 && (
          <div className="font-mono text-[0.625rem] text-taupe tracking-meta uppercase mb-3">
            {stats.join(" · ")}
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
          <blockquote className="font-display italic text-[0.9375rem] text-ink leading-relaxed border-l-2 border-accent-red pl-3 mb-4 whitespace-pre-wrap m-0">
            "{post.body}"
          </blockquote>
        )}

        {/* 액션 라인 */}
        {!editing && (
          <div className="flex flex-wrap gap-4 font-mono text-[0.6875rem] tracking-meta uppercase">
            <button
              onClick={toggleExpand}
              className="text-accent-red hover:text-ink transition-colors"
            >
              → Send a note{" "}
              <span className="text-hint normal-case tracking-normal">({post.comment_count})</span>
            </button>
            <button
              onClick={() => onLike(post.id)}
              className={`transition-colors ${
                post.liked_by_me ? "text-accent-red" : "text-taupe hover:text-ink"
              }`}
            >
              {post.liked_by_me ? "♥" : "♡"} Save{" "}
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
                  className="text-taupe hover:text-accent-red transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Active status (우측 상단) — 데스크탑 전용, 모바일은 헤더 라인에 inline */}
      <div className="hidden md:block font-mono text-[0.5625rem] text-hint tracking-meta uppercase whitespace-nowrap pt-1">
        ● Active {timeAgo(post.created_at)}
      </div>

      {/* 댓글 영역 (펼침 시 full width) */}
      {expanded && (
        <div className="col-span-2 md:col-span-3 ml-0 md:ml-[5.75rem] mt-4 pt-4 border-t border-ink/12">
          <div className="font-mono text-[0.625rem] text-accent-gold tracking-label uppercase mb-3">
            — Notes ({post.comment_count})
          </div>

          {commentsLoading ? (
            <div className="flex items-center gap-2 text-taupe py-2">
              <Loader2 className="animate-spin" size={12} />
              <span className="font-mono text-[0.625rem] tracking-meta uppercase">Loading…</span>
            </div>
          ) : (
            <div>
              {(comments || []).length === 0 && (
                <p className="font-display italic text-sm text-hint py-2">
                  No notes yet — be the first to reply.
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
              placeholder="Leave a note…"
              rows={2}
              className={inputCls + " resize-none italic"}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-meta uppercase cursor-pointer text-taupe">
                <input
                  type="checkbox"
                  checked={commentSecret}
                  onChange={(e) => setCommentSecret(e.target.checked)}
                  className="accent-accent-red"
                />
                Secret note
              </label>
              <button
                onClick={submitComment}
                disabled={commentSubmitting || !commentDraft.trim()}
                className="font-mono text-[0.6875rem] tracking-label uppercase text-accent-red hover:text-ink disabled:opacity-40 flex items-center gap-1"
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
  usePageTitle('Personals · FitCoach');

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
      className="fixed inset-0 bg-surface text-ink overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300"
      style={{ scrollbarWidth: "none" }}
    >
      <PageSurface maxWidth={1100}>
      <div className="w-full px-6 md:px-12 py-8">

        {/* 헤드라인 영역 — 텍스트만 좁게 */}
        <div className="max-w-[40rem] pb-8">
          <div className="mb-3">
            <div className="font-mono text-[0.6875rem] text-accent-red tracking-label uppercase">
              — Personals
            </div>
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.0] tracking-tight font-normal">
            Find a <em className="italic text-accent-gold">training<br />companion.</em>
          </h1>
          <p className="font-display italic text-sm text-taupe mt-3 leading-relaxed">
            운동 메이트, 폼 코치, 또는 그 이상 — 같은 무게를 드는 사람을 찾는 가장 우아한 방법.
          </p>
        </div>

        {/* 글쓰기 액션 라인 (Filter 위치 활용) */}
        <div className="flex items-center justify-between border-t border-b border-ink/12 py-3 mb-0">
          <span className="font-mono text-[0.625rem] text-hint tracking-meta uppercase">
            Latest entries
          </span>
          <button
            onClick={() => setWriteOpen((v) => !v)}
            className="font-mono text-[0.6875rem] tracking-label uppercase text-accent-red hover:text-ink transition-colors"
          >
            {writeOpen ? "× Close form" : "→ Write an entry"}
          </button>
        </div>

        {/* 글쓰기 폼 */}
        {writeOpen && (
          <section className="border-b border-ink/12 py-6 bg-accent-red/[0.03]">
            <div className="font-mono text-[0.625rem] text-accent-red tracking-label uppercase mb-4">
              — Post your own
            </div>
            <PostForm
              onSubmit={createPost}
              onCancel={() => setWriteOpen(false)}
              submitting={creating}
            />
          </section>
        )}

        {/* 글 목록 */}
        {loading && (
          <div className="py-16 text-center text-taupe">
            <Loader2 className="animate-spin mx-auto mb-3" size={18} />
            <p className="font-mono text-[0.625rem] tracking-meta uppercase">Loading entries…</p>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-display text-lg text-ink mb-2">No entries yet.</p>
            <p className="font-display italic text-sm text-taupe">
              첫 글을 남겨 운동 메이트를 찾아보세요.
            </p>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div>
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
          </div>
        )}

        {/* Post your own CTA (하단) */}
        {!loading && posts.length > 0 && !writeOpen && (
          <div className="mt-10 py-8 border-t border-ink/15 bg-accent-gold/[0.04] -mx-6 md:-mx-12 px-6 md:px-12">
            <div className="font-mono text-[0.625rem] text-accent-gold tracking-label uppercase mb-3">
              — Post your own
            </div>
            <p className="font-display italic text-[1.0625rem] text-ink leading-relaxed mb-4 max-w-[40rem]">
              운동 메이트를 찾고 있나요? 당신의 광고를 게재하세요.
            </p>
            <button
              onClick={() => setWriteOpen(true)}
              className="font-mono text-[0.6875rem] tracking-label uppercase px-5 py-3 bg-accent-gold text-paper hover:bg-accent-red hover:text-ink transition-colors"
            >
              → Write an entry
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-6 mt-10 border-t border-ink/15 font-mono text-[0.6875rem] text-hint tracking-meta">
          <span className="uppercase">— FITCOACH —</span>
          <span className="uppercase text-taupe">Personals · {activeCount}</span>
        </div>
      </div>
      </PageSurface>
    </div>
  );
};

export default CommunityPage;
