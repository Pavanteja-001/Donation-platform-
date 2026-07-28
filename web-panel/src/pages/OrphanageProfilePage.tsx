import { useEffect, useState, type FormEvent } from "react";
import { updateOrphanageProfile } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PhotoPicker } from "../components/PhotoPicker";
import { uploadPhotos } from "../lib/api";
import { EmptyState } from "../components/ui";

/**
 * Where a home sets what donors see in the mobile directory, and what a meal costs to sponsor.
 *
 * Every field here is optional by design. A home is listed as soon as an admin approves its KYC,
 * and filling this in improves the listing rather than gating it — a half-complete profile with
 * a real address still beats a home that never appears because it couldn't finish a form.
 */

/** Numeric inputs come back as strings; "" means "clear this value", not zero. */
function toNullableInt(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

export function OrphanageProfilePage() {
  const { token, user, refreshUser } = useAuth();

  const [about, setAbout] = useState("");
  const [childrenCount, setChildrenCount] = useState("");
  const [staffCount, setStaffCount] = useState("");
  const [roomsCount, setRoomsCount] = useState("");
  const [breakfastCost, setBreakfastCost] = useState("");
  const [lunchCost, setLunchCost] = useState("");
  const [dinnerCost, setDinnerCost] = useState("");
  const [acceptingBookings, setAcceptingBookings] = useState(true);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  // Already-uploaded gallery URLs, plus files staged for this save. Kept apart so removing an
  // existing photo and adding a new one in the same edit both work.
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Prefill from the account itself — /api/auth/me returns the caller's whole row.
  useEffect(() => {
    if (!user) return;
    setAbout(user.about ?? "");
    setChildrenCount(user.childrenCount != null ? String(user.childrenCount) : "");
    setStaffCount(user.staffCount != null ? String(user.staffCount) : "");
    setRoomsCount(user.roomsCount != null ? String(user.roomsCount) : "");
    setBreakfastCost(user.breakfastCost != null ? String(user.breakfastCost) : "");
    setLunchCost(user.lunchCost != null ? String(user.lunchCost) : "");
    setDinnerCost(user.dinnerCost != null ? String(user.dinnerCost) : "");
    setAcceptingBookings(user.acceptingBookings ?? true);
    setCoverPhotoUrl(user.coverPhotoUrl ?? null);
    setGallery(user.galleryPhotos ?? []);
  }, [user]);

  if (user && user.institutionType !== "ORPHANAGE") {
    return (
      <div>
        <h2>Home profile</h2>
        <EmptyState
          title="Only for orphanages and old-age homes"
          subtitle="This page configures the meal-sponsorship listing, which applies to orphanage and old-age-home accounts. Your account is registered as a different institution type."
        />
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      let cover = coverPhotoUrl;
      if (coverFiles.length > 0) {
        const [uploaded] = await uploadPhotos(token, coverFiles.slice(0, 1), "profile-photos");
        cover = uploaded ?? cover;
      }

      let galleryUrls = gallery;
      if (galleryFiles.length > 0) {
        const uploaded = await uploadPhotos(token, galleryFiles, "profile-photos");
        galleryUrls = [...gallery, ...uploaded];
      }

      await updateOrphanageProfile(token, {
        galleryPhotos: galleryUrls,
        about: about.trim() || null,
        childrenCount: toNullableInt(childrenCount) ?? null,
        staffCount: toNullableInt(staffCount) ?? null,
        roomsCount: toNullableInt(roomsCount) ?? null,
        breakfastCost: toNullableInt(breakfastCost) ?? null,
        lunchCost: toNullableInt(lunchCost) ?? null,
        dinnerCost: toNullableInt(dinnerCost) ?? null,
        acceptingBookings,
        coverPhotoUrl: cover,
      });

      setCoverFiles([]);
      setGallery(galleryUrls);
      setGalleryFiles([]);
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile");
    } finally {
      setIsSaving(false);
    }
  }

  const isApproved = user?.kycStatus === "APPROVED";

  return (
    <div>
      <h2>Home profile</h2>
      <p className="hint">
        This is what donors see in the app when they browse homes. Leave a meal price empty if you
        don't offer that meal for sponsorship.
      </p>

      {/* Filling this in is pointless until KYC clears, because an unapproved home isn't listed
          at all — better to say so than let someone wonder why they can't be found. */}
      {!isApproved && (
        <div className="callout callout-warning">
          <strong>Not visible yet</strong>
          <span style={{ fontSize: 13 }}>
            Your listing appears in the app once an administrator approves your registration. You
            can fill this in now — it'll go live with the approval.
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {saved && (
        <div className="callout callout-success">
          <strong>Saved</strong>
          <span style={{ fontSize: 13 }}>Your listing has been updated.</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label>
          About your home
          <textarea
            rows={4}
            value={about}
            placeholder="What you provide, who you care for, anything a donor should know."
            onChange={(e) => setAbout(e.target.value)}
          />
        </label>

        <h3 style={{ marginTop: 24, fontSize: 15 }}>Capacity</h3>
        <div className="detail-grid">
          <label>
            Residents
            <input type="number" min={0} value={childrenCount} onChange={(e) => setChildrenCount(e.target.value)} />
          </label>
          <label>
            Staff
            <input type="number" min={0} value={staffCount} onChange={(e) => setStaffCount(e.target.value)} />
          </label>
          <label>
            Rooms
            <input type="number" min={0} value={roomsCount} onChange={(e) => setRoomsCount(e.target.value)} />
          </label>
        </div>

        <h3 style={{ marginTop: 24, fontSize: 15 }}>Meal sponsorship prices (₹)</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          What one meal for the whole home costs. A donor sponsors a single meal on a single day.
        </p>
        <div className="detail-grid">
          <label>
            Breakfast
            <input type="number" min={0} placeholder="Not offered" value={breakfastCost} onChange={(e) => setBreakfastCost(e.target.value)} />
          </label>
          <label>
            Lunch
            <input type="number" min={0} placeholder="Not offered" value={lunchCost} onChange={(e) => setLunchCost(e.target.value)} />
          </label>
          <label>
            Dinner
            <input type="number" min={0} placeholder="Not offered" value={dinnerCost} onChange={(e) => setDinnerCost(e.target.value)} />
          </label>
        </div>

        <h3 style={{ marginTop: 24, fontSize: 15 }}>Cover photo</h3>
        <p className="hint" style={{ marginTop: 0 }}>Shown at the top of your listing.</p>
        {coverPhotoUrl && coverFiles.length === 0 && (
          <img
            src={coverPhotoUrl}
            alt="Current cover"
            style={{ width: 220, height: 130, objectFit: "cover", borderRadius: 10, border: "1px solid var(--color-border)", marginBottom: 12 }}
          />
        )}
        <PhotoPicker files={coverFiles} onChange={setCoverFiles} max={1} />

        <h3 style={{ marginTop: 24, fontSize: 15 }}>Gallery — your work</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Photos of meals you've served, celebrations and your facilities. Donors see these on your
          page in the app. These are public — keep documents and anything identifying a resident
          out of them.
        </p>

        {gallery.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            {gallery.map((url) => (
              <div key={url} style={{ position: "relative" }}>
                <img
                  src={url}
                  alt=""
                  style={{ width: 132, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid var(--color-border)" }}
                />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setGallery((prev) => prev.filter((u) => u !== url))}
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    background: "var(--color-danger)",
                    color: "#fff",
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {/* No cap on the gallery — a home can show as much of its work as it wants. */}
        <PhotoPicker files={galleryFiles} onChange={setGalleryFiles} max={Infinity} />

        <h3 style={{ marginTop: 24, fontSize: 15 }}>Availability</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={acceptingBookings}
            onChange={(e) => setAcceptingBookings(e.target.checked)}
          />
          <span>
            <strong>Accepting bookings</strong>
            <span className="hint" style={{ display: "block", margin: 0 }}>
              Turn this off to pause new sponsorships without being removed from the directory.
            </span>
          </span>
        </label>

        <button type="submit" disabled={isSaving} style={{ marginTop: 24 }}>
          {isSaving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
