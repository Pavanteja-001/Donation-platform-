import { useState, useEffect, useCallback } from "react";
import {
  fetchForumQuestions,
  deleteForumQuestion,
  deleteForumAnswer,
  type ForumQuestion,
  type ForumAnswer,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, Skeleton, Badge } from "../components/ui";

// PRD §12 — Admin/Staff forum moderation: list all questions, expand to see answers, delete
// questions or individual answers. Paginated via cursor.
export function ForumModerationPage() {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      if (!token) return;
      if (!cursor) setIsLoading(true);
      setError(null);
      try {
        const { questions: fetched, nextCursor: nc } = await fetchForumQuestions(token, cursor);
        setQuestions((prev) => (cursor ? [...prev, ...fetched] : fetched));
        setNextCursor(nc);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load forum questions");
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteQuestion(id: string) {
    if (!token) return;
    if (!window.confirm("Delete this question and all its answers?")) return;
    try {
      await deleteForumQuestion(token, id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete question");
    }
  }

  async function handleDeleteAnswer(questionId: string, answerId: string) {
    if (!token) return;
    if (!window.confirm("Delete this answer?")) return;
    try {
      await deleteForumAnswer(token, answerId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, answers: (q.answers ?? []).filter((a) => a.id !== answerId) }
            : q
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete answer");
    }
  }

  if (isLoading) {
    return (
      <div>
        <h2>Forum Moderation</h2>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <Skeleton height={72} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2>Forum Moderation</h2>
        <ErrorState message={error} onRetry={() => load()} />
      </div>
    );
  }

  return (
    <div>
      <h2>Forum Moderation</h2>
      <p className="hint">
        {questions.length} question{questions.length !== 1 ? "s" : ""} in the community Q&amp;A forum.
        Expand to see answers and delete inappropriate content.
      </p>

      {questions.length === 0 ? (
        <EmptyState title="No questions yet" subtitle="The community forum is empty." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                background: "var(--color-surface)",
                overflow: "hidden",
              }}
            >
              {/* Question row */}
              <div
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{q.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {q.author.name ?? "User"} · {new Date(q.createdAt).toLocaleDateString()} ·{" "}
                    <Badge label={`${q._count?.answers ?? 0} answers`} tone="neutral" />
                  </div>
                </div>
                <button
                  className="link"
                  style={{ color: "var(--color-danger)", fontSize: 12, flexShrink: 0 }}
                  onClick={() => handleDeleteQuestion(q.id)}
                >
                  Delete
                </button>
              </div>

              {/* Expanded answers */}
              {expanded === q.id && (
                <div style={{ borderTop: "1px solid var(--color-border)", padding: "12px 16px" }}>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 8 }}>
                    Question body:
                  </div>
                  <p style={{ fontSize: 14, marginTop: 0, marginBottom: 16 }}>{q.body}</p>

                  {(q._count?.answers ?? 0) === 0 || !q.answers ? (
                    <p className="hint" style={{ fontSize: 13 }}>No answers yet.</p>
                  ) : (
                    (q.answers as ForumAnswer[]).map((a) => (
                      <div
                        key={a.id}
                        style={{
                          borderTop: "1px solid var(--color-border)",
                          paddingTop: 10,
                          marginTop: 10,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, marginBottom: 4 }}>{a.body}</div>
                          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                            {a.author.name ?? "User"} · {new Date(a.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          className="link"
                          style={{ color: "var(--color-danger)", fontSize: 12, flexShrink: 0 }}
                          onClick={() => handleDeleteAnswer(q.id, a.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => load(nextCursor)}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
