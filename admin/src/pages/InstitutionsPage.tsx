import { useEffect, useState } from "react";
import { fetchKycQueue, updateKycStatus, type AdminUser, type KycStatus } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, Button } from "../components/ui";
import { PageSkeleton } from "../components/SkeletonLoader";

export function InstitutionsPage() {
  const { token } = useAuth();
  const [institutions, setInstitutions] = useState<AdminUser[] | null>(null);
  const [selectedInst, setSelectedInst] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState<KycStatus | "ALL">("PENDING_APPROVAL");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reject dialog/input state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function loadQueue() {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    fetchKycQueue(token, filter)
      .then(({ queue }) => {
        setInstitutions(queue);
        // Clear or update selected institution if it's no longer in the list
        if (selectedInst) {
          const updated = queue.find((i) => i.id === selectedInst.id);
          setSelectedInst(updated || null);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load institutions"))
      .finally(() => setIsLoading(false));
  }

  useEffect(loadQueue, [token, filter]);

  const handleApprove = async (id: string) => {
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateKycStatus(token, id, "APPROVED");
      loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve institution");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedInst) return;
    if (!rejectReason.trim()) return setError("Rejection reason is required");

    setError(null);
    setIsSubmitting(true);
    try {
      await updateKycStatus(token, selectedInst.id, "REJECTED", rejectReason.trim());
      setIsRejecting(false);
      setRejectReason("");
      loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject institution");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadges: Record<string, string> = {
    APPROVED: "badge-success",
    PENDING_APPROVAL: "badge-warning",
    REJECTED: "badge-danger",
    NOT_SUBMITTED: "badge-neutral",
  };

  const statusLabels: Record<string, string> = {
    APPROVED: "Approved",
    PENDING_APPROVAL: "Pending Review",
    REJECTED: "Rejected",
    NOT_SUBMITTED: "Not Submitted",
  };

  return (
    <div>
      <h2>Institutions & NGOs</h2>
      <p className="subtitle">Verify and manage partner organizations, hospitals, and blood banks.</p>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", marginTop: "16px", marginBottom: "20px" }}>
        {(["PENDING_APPROVAL", "APPROVED", "REJECTED", "ALL"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => {
              setFilter(opt);
              setIsRejecting(false);
              setRejectReason("");
            }}
            className={`btn-tab ${filter === opt ? "active" : ""}`}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "1px solid var(--color-border)",
              backgroundColor: filter === opt ? "var(--color-primary)" : "var(--color-surface)",
              color: filter === opt ? "#fff" : "var(--color-text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {opt === "ALL" ? "All" : opt === "PENDING_APPROVAL" ? "Pending Review" : opt === "APPROVED" ? "Approved" : "Rejected"}
          </button>
        ))}
      </div>

      {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}

      {isLoading && !institutions && <PageSkeleton />}

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* Left Side: Institutions List */}
        <div style={{ flex: 1, minWidth: "400px" }}>
          {isLoading && <p className="hint">Loading verification queue…</p>}
          {!isLoading && institutions && (
            <table>
              <thead>
                <tr>
                  <th>Legal Name</th>
                  <th>Type</th>
                  <th>City / Area</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => {
                      setSelectedInst(i);
                      setIsRejecting(false);
                      setRejectReason("");
                    }}
                    style={{
                      cursor: "pointer",
                      backgroundColor: selectedInst?.id === i.id ? "#f3f4f6" : "transparent",
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>{i.legalName ?? "No Legal Name"}</td>
                    <td>{i.institutionType ?? "—"}</td>
                    <td>{[i.area, i.city].filter(Boolean).join(", ") || "—"}</td>
                    <td>
                      <span className={`badge ${statusBadges[i.kycStatus ?? "NOT_SUBMITTED"]}`}>
                        {statusLabels[i.kycStatus ?? "NOT_SUBMITTED"]}
                      </span>
                    </td>
                  </tr>
                ))}
                {institutions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="hint" style={{ textAlign: "center", padding: "24px" }}>
                      No institutions matching status filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Right Side: Selected Details Panel */}
        {selectedInst && (
          <div style={{ width: "420px" }}>
            <Card>
              <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Institution Details</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <span className="hint" style={{ fontSize: "11px", display: "block" }}>Legal Name</span>
                  <span style={{ fontWeight: 600 }}>{selectedInst.legalName ?? "—"}</span>
                </div>
                <div>
                  <span className="hint" style={{ fontSize: "11px", display: "block" }}>Org Type</span>
                  <span style={{ fontWeight: 600 }}>{selectedInst.institutionType ?? "—"}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <span className="hint" style={{ fontSize: "11px", display: "block" }}>Registration No.</span>
                  <span style={{ fontWeight: 600 }}>{selectedInst.registrationNumber ?? "—"}</span>
                </div>
                {selectedInst.institutionType === "NGO" && (
                  <div>
                    <span className="hint" style={{ fontSize: "11px", display: "block" }}>Darpan ID</span>
                    <span style={{ fontWeight: 600 }}>{selectedInst.darpanId ?? "—"}</span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "16px" }}>
                <span className="hint" style={{ fontSize: "11px", display: "block" }}>Bank Account Details</span>
                <span style={{ fontWeight: 500 }}>{selectedInst.bankAccount ?? "—"}</span>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <span className="hint" style={{ fontSize: "11px", display: "block" }}>Physical Address</span>
                <span style={{ fontWeight: 500, whiteSpace: "pre-wrap" }}>{selectedInst.address ?? "—"}</span>
              </div>

              {selectedInst.kycDocumentUrl && (
                <div style={{ marginBottom: "16px" }}>
                  <span className="hint" style={{ fontSize: "11px", display: "block", marginBottom: "4px" }}>Identity Certificate</span>
                  <a
                    href={selectedInst.kycDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                    style={{ fontWeight: 600 }}
                  >
                    View Verification Document ↗
                  </a>
                </div>
              )}

              {selectedInst.kycPhotos && selectedInst.kycPhotos.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <span className="hint" style={{ fontSize: "11px", display: "block", marginBottom: "6px" }}>Uploaded Photos</span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {selectedInst.kycPhotos.map((url, idx) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Org Photo ${idx}`}
                          style={{
                            width: "70px",
                            height: "70px",
                            objectFit: "cover",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--color-border)",
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedInst.kycStatus === "REJECTED" && (
                <div style={{ backgroundColor: "#fff5f5", border: "1px solid #feb2b2", borderRadius: "var(--radius)", padding: "12px", marginBottom: "16px" }}>
                  <strong style={{ color: "var(--color-danger)", display: "block", fontSize: "12px" }}>Rejection Reason:</strong>
                  <span style={{ fontSize: "13px", color: "#c53030" }}>{selectedInst.kycRejectionReason ?? "None specified."}</span>
                </div>
              )}

              {selectedInst.kycStatus === "PENDING_APPROVAL" && !isRejecting && (
                <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                  <Button
                    label="Approve"
                    onClick={() => handleApprove(selectedInst.id)}
                    disabled={isSubmitting}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setIsRejecting(true)}
                    disabled={isSubmitting}
                    className="btn-secondary-outline"
                    style={{
                      flex: 1,
                      border: "1px solid var(--color-danger)",
                      color: "var(--color-danger)",
                      cursor: "pointer",
                      padding: "10px",
                      borderRadius: "var(--radius)",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}

              {isRejecting && (
                <form onSubmit={handleRejectSubmit} style={{ marginTop: "20px", borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
                  <label style={{ display: "block", marginBottom: "12px" }}>
                    Rejection Reason
                    <textarea
                      placeholder="Explain what needs to be fixed..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--color-border)",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        marginTop: "4px",
                        outline: "none",
                      }}
                    />
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button type="submit" label="Confirm Rejection" loading={isSubmitting} />
                    <button
                      type="button"
                      className="btn-secondary-outline"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setIsRejecting(false);
                        setRejectReason("");
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
