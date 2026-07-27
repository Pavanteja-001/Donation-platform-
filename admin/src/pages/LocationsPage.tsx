import { useEffect, useState, type FormEvent } from "react";
import {
  fetchLocations,
  createDistrict,
  deleteDistrict,
  createArea,
  updateArea,
  type AreaLocation,
  type DistrictItem,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, EmptyState, ErrorState, Skeleton } from "../components/ui";

export function LocationsPage() {
  const { token, isAdmin } = useAuth();
  const [districts, setDistricts] = useState<DistrictItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newDistrictName, setNewDistrictName] = useState("");
  const [newDistrictState, setNewDistrictState] = useState("Andhra Pradesh");
  const [isAddingDistrict, setIsAddingDistrict] = useState(false);

  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [isAddingArea, setIsAddingArea] = useState(false);

  function load() {
    setError(null);
    fetchLocations()
      .then(({ districts }) => {
        setDistricts(districts);
        if (districts.length > 0 && !selectedDistrictId) {
          setSelectedDistrictId(districts[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load locations"));
  }

  useEffect(load, []);

  async function handleAddDistrict(e: FormEvent) {
    e.preventDefault();
    if (!token || !newDistrictName.trim()) return;
    setIsAddingDistrict(true);
    setError(null);
    try {
      await createDistrict(token, newDistrictName.trim(), newDistrictState.trim());
      setNewDistrictName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add district");
    } finally {
      setIsAddingDistrict(false);
    }
  }

  async function handleDeleteDistrict(id: string, name: string) {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete district "${name}" and all its areas?`)) return;
    try {
      await deleteDistrict(token, id);
      if (selectedDistrictId === id) setSelectedDistrictId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete district");
    }
  }

  async function handleAddArea(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedDistrictId || !newAreaName.trim()) return;
    setIsAddingArea(true);
    setError(null);
    try {
      await createArea(token, selectedDistrictId, newAreaName.trim());
      setNewAreaName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add area");
    } finally {
      setIsAddingArea(false);
    }
  }

  // Lets an admin correct a locality centre. The seeded values are approximate (accurate to
  // roughly a kilometre) and this is the only way to refine one without re-running the seed —
  // it decides where a need with no exact pin lands on the map.
  async function handleSetAreaCoordinates(target: AreaLocation) {
    if (!token) return;
    const current = target.latitude != null && target.longitude != null ? `${target.latitude}, ${target.longitude}` : "";
    const input = window.prompt(`Coordinates for "${target.name}" as "latitude, longitude"`, current);
    if (input === null) return;
    const [latRaw, lngRaw] = input.split(",").map((s) => s.trim());
    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (!latRaw || !lngRaw || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError("Enter coordinates as two numbers, e.g. 17.7830, 83.3830");
      return;
    }
    try {
      await updateArea(token, target.id, { latitude, longitude });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update area coordinates");
    }
  }

  const selectedDistrict = districts?.find((d) => d.id === selectedDistrictId);

  return (
    <div>
      <h2>Location Management (Districts & Areas)</h2>
      <p className="hint">
        Manage standard districts and localities used across mobile & web registration and blood request forms.
      </p>

      {error && <ErrorState message={error} onRetry={load} />}

      {/* Add District Form */}
      {isAdmin && (
        <Card style={{ marginBottom: 24, marginTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Add New District</h3>
          <form onSubmit={handleAddDistrict} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "end" }}>
            <label style={{ marginBottom: 0 }}>
              District Name
              <input
                type="text"
                placeholder="e.g. Visakhapatnam, Vizianagaram"
                value={newDistrictName}
                onChange={(e) => setNewDistrictName(e.target.value)}
                required
              />
            </label>
            <label style={{ marginBottom: 0 }}>
              State
              <input
                type="text"
                value={newDistrictState}
                onChange={(e) => setNewDistrictState(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={isAddingDistrict} style={{ height: 42 }}>
              {isAddingDistrict ? "Adding…" : "+ Add District"}
            </button>
          </form>
        </Card>
      )}

      {!districts && !error && (
        <div style={{ display: "flex", gap: 20 }}>
          <Skeleton width={280} height={300} />
          <Skeleton width="100%" height={300} />
        </div>
      )}

      {districts && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
          {/* Districts List */}
          <div>
            <h3>Districts ({districts.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {districts.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDistrictId(d.id)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    cursor: "pointer",
                    backgroundColor: selectedDistrictId === d.id ? "var(--color-primary-light, #EEF2FF)" : "var(--color-surface)",
                    border: `1px solid ${selectedDistrictId === d.id ? "var(--color-primary)" : "var(--color-border)"}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{d.name}</strong>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {d.areas.length} areas
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDistrict(d.id, d.name);
                      }}
                      style={{ color: "#DC2626", fontSize: 12 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Areas List for Selected District */}
          <div>
            {selectedDistrict ? (
              <>
                <h3>Areas in {selectedDistrict.name}</h3>

                {isAdmin && (
                  <form onSubmit={handleAddArea} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                    <input
                      type="text"
                      placeholder={`Add new locality/area in ${selectedDistrict.name} (e.g. Gajuwaka)`}
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      style={{ flex: 1, marginTop: 0 }}
                      required
                    />
                    <button type="submit" disabled={isAddingArea} style={{ height: 42 }}>
                      {isAddingArea ? "Adding…" : "+ Add Area"}
                    </button>
                  </form>
                )}

                {selectedDistrict.areas.length === 0 ? (
                  <EmptyState title="No areas added yet" subtitle="Add localities to this district to populate donor dropdowns." />
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedDistrict.areas.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          backgroundColor: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 20,
                          padding: "6px 14px",
                          fontSize: 14,
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        📍 {a.name}
                        {/* An area with no centre contributes no map position: a need posted
                            there falls back to the district, or to no pin at all. Surface that
                            rather than letting it look identical to a mapped one. */}
                        {a.latitude != null && a.longitude != null ? (
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                            {a.latitude.toFixed(3)}, {a.longitude.toFixed(3)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#B45309" }}>no coordinates</span>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            className="link"
                            style={{ fontSize: 11 }}
                            onClick={() => handleSetAreaCoordinates(a)}
                          >
                            {a.latitude != null ? "edit" : "set"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="Select a district" subtitle="Click on a district on the left to manage its areas." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
