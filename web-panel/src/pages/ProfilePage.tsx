import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Avatar, Card, Button } from "../components/ui";
import { updateMe, uploadProfilePhoto } from "../lib/api";

export function ProfilePage() {
  const { user, token, refreshUser, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a JPEG, PNG, or WebP image.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const publicUrl = await uploadProfilePhoto(token, file);
      await updateMe(token, { profilePhotoUrl: publicUrl });
      await refreshUser();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <h2>Profile</h2>
      <p className="subtitle">Manage your institution profile.</p>

      <div style={{ maxWidth: 480, marginTop: 24 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ position: "relative" }}>
              <Avatar name={user?.name} photoUrl={user?.profilePhotoUrl} size={72} />
              <button
                type="button"
                title="Change profile photo"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--color-primary)",
                  border: "2px solid var(--color-background)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                {uploading ? "…" : "✎"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handlePhotoChange}
              />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{user?.name ?? "Institution"}</h3>
              <p className="hint" style={{ margin: 0 }}>Role: {user?.role}</p>
            </div>
          </div>

          {uploadError && <p className="error" style={{ marginBottom: 16 }}>{uploadError}</p>}

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Phone Number</label>
            <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>{user?.phone}</p>
          </div>

          {user?.email && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Email</label>
              <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>{user.email}</p>
            </div>
          )}

          <Button label="Log out" variant="danger" onClick={signOut} />
        </Card>
      </div>
    </div>
  );
}
