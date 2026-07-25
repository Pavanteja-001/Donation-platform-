import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Card, Button } from "../components/ui";
import { updateMe, signUpload, uploadToSignedUrl, type InstitutionType, type KycStatus } from "../lib/api";

export function VerificationStatusPage() {
  const { token, user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for editing
  const [institutionType, setInstitutionType] = useState<InstitutionType>(user?.institutionType ?? "NGO");
  const [legalName, setLegalName] = useState(user?.legalName ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(user?.registrationNumber ?? "");
  const [darpanId, setDarpanId] = useState(user?.darpanId ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [bankAccount, setBankAccount] = useState(user?.bankAccount ?? "");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);

  const statusColors = {
    APPROVED: "var(--color-success)",
    PENDING_APPROVAL: "var(--color-warning)",
    REJECTED: "var(--color-danger)",
    NOT_SUBMITTED: "var(--color-text-secondary)",
  };

  const statusLabels = {
    APPROVED: "Approved",
    PENDING_APPROVAL: "Pending Review",
    REJECTED: "Rejected",
    NOT_SUBMITTED: "Not Submitted",
  };

  const currentStatus = user?.kycStatus ?? "NOT_SUBMITTED";

  const handleUpdateKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!legalName.trim()) return setError("Legal organization name is required");
    if (!registrationNumber.trim()) return setError("Registration number is required");
    if (institutionType === "NGO" && !darpanId.trim()) return setError("NGOs require a Darpan ID");
    if (!address.trim()) return setError("Address is required");
    if (!bankAccount.trim()) return setError("Bank account is required");

    setError(null);
    setIsSaving(true);

    try {
      let documentUrl = user?.kycDocumentUrl;
      if (docFile) {
        const docSigned = await signUpload(token, docFile.type, "kyc-docs");
        await uploadToSignedUrl(docSigned.uploadUrl, docFile);
        documentUrl = docSigned.publicUrl;
      }

      let photoUrls = user?.kycPhotos ?? [];
      if (photoFiles && photoFiles.length > 0) {
        photoUrls = [];
        for (let i = 0; i < photoFiles.length; i++) {
          const file = photoFiles[i];
          const photoSigned = await signUpload(token, file.type, "kyc-docs");
          await uploadToSignedUrl(photoSigned.uploadUrl, file);
          photoUrls.push(photoSigned.publicUrl);
        }
      }

      await updateMe(token, {
        institutionType,
        legalName: legalName.trim(),
        registrationNumber: registrationNumber.trim(),
        darpanId: institutionType === "NGO" ? darpanId.trim() : null,
        address: address.trim(),
        bankAccount: bankAccount.trim(),
        kycDocumentUrl: documentUrl || undefined,
        kycPhotos: photoUrls,
        kycStatus: "PENDING_APPROVAL" as KycStatus,
      });

      await refreshUser();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update KYC details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2>Verification status</h2>
      <p className="subtitle">Track and manage your organization's KYC verification.</p>

      {!isEditing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "24px", maxWidth: "640px" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>KYC Status</h3>
              <span
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  backgroundColor: statusColors[currentStatus],
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {statusLabels[currentStatus]}
              </span>
            </div>

            {currentStatus === "APPROVED" && (
              <p className="hint" style={{ margin: 0, color: "var(--color-success)" }}>
                ✓ Your organization has been approved. You are fully unlocked to post support needs to the public feed.
              </p>
            )}

            {currentStatus === "PENDING_APPROVAL" && (
              <p className="hint" style={{ margin: 0, color: "var(--color-warning)" }}>
                ⏳ Your registration details and documents are currently under review. Admin approvals usually take less than 24 hours.
              </p>
            )}

            {currentStatus === "REJECTED" && (
              <div style={{ backgroundColor: "#fff5f5", border: "1px solid #feb2b2", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                <strong style={{ color: "var(--color-danger)", display: "block", marginBottom: "4px" }}>Rejection Reason:</strong>
                <p style={{ margin: 0, fontSize: "14px", color: "#c53030" }}>{user?.kycRejectionReason ?? "No reason specified."}</p>
              </div>
            )}

            {currentStatus === "NOT_SUBMITTED" && (
              <p className="hint" style={{ margin: 0 }}>
                You have not submitted your profile and verification documents yet.
              </p>
            )}
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Submitted Details</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <span className="hint" style={{ display: "block", fontSize: "12px" }}>Legal Org Name</span>
                <span style={{ fontWeight: 600 }}>{user?.legalName ?? "—"}</span>
              </div>
              <div>
                <span className="hint" style={{ display: "block", fontSize: "12px" }}>Org Type</span>
                <span style={{ fontWeight: 600 }}>{user?.institutionType ?? "—"}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <span className="hint" style={{ display: "block", fontSize: "12px" }}>Registration Number</span>
                <span style={{ fontWeight: 600 }}>{user?.registrationNumber ?? "—"}</span>
              </div>
              {user?.institutionType === "NGO" && (
                <div>
                  <span className="hint" style={{ display: "block", fontSize: "12px" }}>Darpan ID</span>
                  <span style={{ fontWeight: 600 }}>{user?.darpanId ?? "—"}</span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <span className="hint" style={{ display: "block", fontSize: "12px" }}>Bank Account Details</span>
              <span style={{ fontWeight: 600 }}>{user?.bankAccount ?? "—"}</span>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <span className="hint" style={{ display: "block", fontSize: "12px" }}>Address</span>
              <span style={{ fontWeight: 500 }}>{user?.address ?? "—"}</span>
            </div>

            {user?.kycDocumentUrl && (
              <div style={{ marginBottom: "16px" }}>
                <span className="hint" style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Identity Certificate Document</span>
                <a href={user.kycDocumentUrl} target="_blank" rel="noopener noreferrer" className="link">
                  View Uploaded Certificate ↗
                </a>
              </div>
            )}

            {user?.kycPhotos && user.kycPhotos.length > 0 && (
              <div>
                <span className="hint" style={{ display: "block", fontSize: "12px", marginBottom: "8px" }}>Organization Photos</span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {user.kycPhotos.map((url, idx) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Org ${idx}`} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "var(--radius)" }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(currentStatus === "REJECTED" || currentStatus === "NOT_SUBMITTED") && (
              <div style={{ marginTop: "24px" }}>
                <Button label="Edit & Re-submit KYC" onClick={() => setIsEditing(true)} />
              </div>
            )}
          </Card>
        </div>
      ) : (
        <form onSubmit={handleUpdateKyc} style={{ maxWidth: "600px", marginTop: "24px" }}>
          <Card>
            <h3>Edit KYC Details</h3>

            <label>
              Organization Type
              <select
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value as InstitutionType)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--color-border)",
                  fontSize: "14px",
                  marginBottom: "16px",
                  outline: "none",
                }}
              >
                <option value="NGO">NGO</option>
                <option value="HOSPITAL">Hospital</option>
                <option value="BLOOD_BANK">Blood Bank</option>
                <option value="ORPHANAGE">Orphanage</option>
              </select>
            </label>

            <label>
              Legal Organization Name
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
              />
            </label>

            <label>
              Registration Number
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                required
              />
            </label>

            {institutionType === "NGO" && (
              <label>
                Darpan ID
                <input
                  type="text"
                  value={darpanId}
                  onChange={(e) => setDarpanId(e.target.value)}
                  required
                />
              </label>
            )}

            <label>
              Organization Address
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--color-border)",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  marginBottom: "16px",
                  outline: "none",
                }}
              />
            </label>

            <label>
              Bank Account Details
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                required
              />
            </label>

            <label style={{ display: "block", marginBottom: "16px" }}>
              Identity Certificate (Select only to overwrite current document)
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                style={{ display: "block", marginTop: "8px" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: "24px" }}>
              Organization Photos (Select only to replace current photos)
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={(e) => setPhotoFiles(e.target.files)}
                style={{ display: "block", marginTop: "8px" }}
              />
            </label>

            {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}

            <div style={{ display: "flex", gap: "12px" }}>
              <Button type="submit" label="Save & Submit KYC" loading={isSaving} />
              <button
                type="button"
                className="btn-secondary-outline"
                style={{ flex: 1 }}
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
