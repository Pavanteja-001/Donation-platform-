import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchLocations, postBloodNeed, uploadPhotos, type BloodGroup, type DistrictLocation } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatBloodGroup } from "../lib/needMeta";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { CreateNeedScaffold, Field } from "../components/CreateNeedScaffold";
import { Input, Chip } from "../components/ui";

const BLOOD_GROUPS: BloodGroup[] = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
];

// PRD §8.3 — post a BLOOD need (group + units).
export function CreateBloodNeedScreen({ onDone }: { onDone: () => void }) {
  const { token, user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(user?.city ?? "");
  const [area, setArea] = useState(user?.area ?? "");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [unitsNeeded, setUnitsNeeded] = useState("1");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [districts, setDistricts] = useState<DistrictLocation[]>([]);

  useEffect(() => {
    fetchLocations()
      .then(({ districts }) => setDistricts(districts))
      .catch(() => {});
  }, []);

  const currentDistrictObj = districts.find((d) => d.name.toLowerCase() === city.trim().toLowerCase());
  const availableAreas = currentDistrictObj ? currentDistrictObj.areas : [];

  async function handleSubmit() {
    if (!token) return;
    const units = Number(unitsNeeded);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!bloodGroup) return setError("Select a blood group");
    if (!units || units <= 0) return setError("Enter how many units are needed");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postBloodNeed(token, {
        title: title.trim(),
        description: description.trim(),
        bloodGroup,
        unitsNeeded: units,
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        photos: photoUrls,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this need");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CreateNeedScaffold
      type="BLOOD"
      title="Request blood"
      subtitle="Eligible donors in your city are notified once this is verified."
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Submit blood request"
    >
      <Input
        label="Title"
        placeholder="e.g. AB+ blood needed at City Hospital"
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label="Description"
        placeholder="Describe the situation and the hospital details"
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      <Field label="District / City" helper="Matches donors in this district">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {districts.map((d) => (
            <Chip
              key={d.id}
              label={d.name}
              active={city.toLowerCase() === d.name.toLowerCase()}
              onPress={() => {
                setCity(d.name);
                setArea("");
                setError(null);
              }}
            />
          ))}
        </ScrollView>
        <Input
          label=""
          placeholder="Or type city if not listed"
          icon="map-pin"
          value={city}
          onChangeText={(txt) => {
            setCity(txt);
            setError(null);
          }}
        />
      </Field>

      <Field label="Area / Locality" helper="Specific area or hospital location">
        {availableAreas.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 8 }}>
            {availableAreas.map((a) => (
              <Chip
                key={a}
                label={a}
                active={area.toLowerCase() === a.toLowerCase()}
                onPress={() => {
                  setArea(a);
                  setError(null);
                }}
              />
            ))}
          </ScrollView>
        )}
        <Input
          label=""
          placeholder="e.g. Gajuwaka, MVP Colony"
          icon="navigation"
          value={area}
          onChangeText={(txt) => {
            setArea(txt);
            setError(null);
          }}
        />
      </Field>

      {/* D-012 — urgency is deliberately absent: it's admin/institution-verified, never
          self-declared, so there is no field for the poster to set it. */}
      <Field label="Blood group needed" helper="Donors are matched on group, eligibility and city">
        <View style={styles.chipGrid}>
          {BLOOD_GROUPS.map((g) => (
            <Chip
              key={g}
              label={formatBloodGroup(g)}
              tone="blood"
              active={bloodGroup === g}
              onPress={() => {
                setBloodGroup(g);
                setError(null);
              }}
            />
          ))}
        </View>
      </Field>

      <Input
        label="Units needed"
        placeholder="2"
        icon="droplet"
        keyboardType="number-pad"
        value={unitsNeeded}
        onChangeText={(txt) => {
          setUnitsNeeded(txt);
          setError(null);
        }}
      />

      <PhotoPicker photos={photos} onChange={setPhotos} />
    </CreateNeedScaffold>
  );
}

const styles = StyleSheet.create({
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
