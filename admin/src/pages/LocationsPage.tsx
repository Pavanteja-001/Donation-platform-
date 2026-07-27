import { useEffect, useState, type FormEvent } from "react";
import {
  fetchLocations,
  createDistrict,
  deleteDistrict,
  createArea,
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
          <h3 style={{ marginTop: 0 }}>Add New District</h3>
          <form onSubmit={handleAddDistrict} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <label style={{ flex: 1 }}>
              District Name
              <input
                type="text"
                placeholder="e.g. Visakhapatnam, Vizianagaram"
                value={newDistrictName}
                onChange={(e) => setNewDistrictName(e.target.value)}
                required
              />
            </label>
            <label style={{ flex: 1 }}>
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
                  <form onSubmit={handleAddArea} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                    <input
                      type="text"
                      placeholder={`Add new locality/area in ${selectedDistrict.name} (e.g. Gajuwaka)`}
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      style={{ flex: 1 }}
                      required
                    />
                    <button type="submit" disabled={isAddingArea}>
                      {isAddingArea ? "Adding…" : "+ Add Area"}
                    </button>
                  </form>
                )}

                {selectedDistrict.areas.length === 0 ? (
                  <EmptyState title="No areas added yet" subtitle="Add localities to this district to populate donor dropdowns." />
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedDistrict.areas.map((areaName) => (
                      <div
                        key={areaName}
                        style={{
                          backgroundColor: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 20,
                          padding: "6px 14px",
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        📍 {areaName}
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
