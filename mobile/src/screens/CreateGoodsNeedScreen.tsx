import type { NeedCategory } from "../lib/needCategory";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { postGoodsNeed, uploadPhotos, type GoodsDirection } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { CreateNeedScaffold } from "../components/CreateNeedScaffold";
import { theme } from "../lib/theme";
import { Chip, Input } from "../components/ui";

/**
 * Condition presets.
 *
 * Free text produced answers like "ok" that told a donor nothing, so the form offers a ladder and
 * still writes a plain string to the payload — the store stays permissive (see goodsNeed.ts), the
 * form just stops people from having to invent vocabulary.
 */
const CONDITIONS = ["Brand new", "Like new", "Good — light wear", "Working, well used", "Needs minor repair"];

/** Everything that differs between giving something away and asking for something. */
const COPY: Record<
  GoodsDirection,
  {
    title: string;
    subtitle: string;
    titleLabel: string;
    titlePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    itemLabel: string;
    itemPlaceholder: string;
    conditionLabel: string;
    conditionHelper: string;
    photosHelper: string;
    note: string;
  }
> = {
  OFFER: {
    title: "Donate an item",
    subtitle: "List something you no longer use. Anyone who needs it can ask, and you choose who gets it.",
    titleLabel: "What are you giving away?",
    titlePlaceholder: "e.g. 32-inch LED TV in working condition",
    descriptionLabel: "Details",
    descriptionPlaceholder: "Age, what's included, why you're giving it away, how pickup would work",
    itemLabel: "Item",
    itemPlaceholder: "e.g. LED television, 32 inch",
    conditionLabel: "Condition",
    conditionHelper: "Be honest — a clear condition saves both sides a wasted trip",
    photosHelper: "Add real photos of the actual item. Listings with photos get claimed far faster.",
    note: "An administrator checks your listing before it goes live. You'll be notified once it's approved.",
  },
  REQUEST: {
    title: "Request an item",
    subtitle: "Someone who has this item can claim your request and arrange handover.",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Wheelchair needed for senior citizen centre",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Describe what this item will be used for",
    itemLabel: "Item required",
    itemPlaceholder: "e.g. Manual wheelchair (adult size)",
    conditionLabel: "Acceptable condition",
    conditionHelper: "Be specific so donors know what will actually help",
    photosHelper: "Optional — a reference photo helps donors match the item",
  note: "An administrator verifies your request before it goes live.",
  },
};

// PRD §11.1/§11.2 — post a GOODS need in either direction. No partial state: an item is claimed
// or it isn't (§11.3).
export function CreateGoodsNeedScreen({
  onDone,
  direction = "REQUEST", category }: {
  onDone: () => void;
  direction?: GoodsDirection; category?: NeedCategory }) {
  const { token } = useAuth();
  const copy = COPY[direction];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [item, setItem] = useState("");
  const [condition, setCondition] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!item.trim()) return setError(direction === "OFFER" ? "Name the item you're donating" : "Describe the item you need");
    if (!condition.trim()) return setError("Pick a condition");

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999) {
      return setError("Quantity must be a whole number between 1 and 999");
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postGoodsNeed(token, {
        category,
        title: title.trim(),
        description: description.trim(),
        item: item.trim(),
        condition: condition.trim(),
        direction,
        quantity: parsedQuantity,
        photos: photoUrls,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this listing");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CreateNeedScaffold
      type="GOODS"
      title={copy.title}
      subtitle={copy.subtitle}
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel={direction === "OFFER" ? "Submit listing for approval" : "Submit for verification"}
    >
      <Input
        label={copy.titleLabel}
        placeholder={copy.titlePlaceholder}
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label={copy.descriptionLabel}
        placeholder={copy.descriptionPlaceholder}
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      <Input
        label={copy.itemLabel}
        placeholder={copy.itemPlaceholder}
        icon="box"
        value={item}
        onChangeText={(txt) => {
          setItem(txt);
          setError(null);
        }}
      />

      <Input
        label="Quantity"
        placeholder="1"
        icon="hash"
        keyboardType="number-pad"
        helper={direction === "OFFER" ? "How many of this item are you giving?" : "How many do you need?"}
        value={quantity}
        onChangeText={(txt) => {
          setQuantity(txt.replace(/[^0-9]/g, ""));
          setError(null);
        }}
      />

      <View style={styles.field}>
        <Text style={styles.label}>{copy.conditionLabel}</Text>
        <View style={styles.chipWrap}>
          {CONDITIONS.map((c) => (
            <Chip
              key={c}
              label={c}
              active={condition === c}
              onPress={() => {
                setCondition(c);
                setError(null);
              }}
            />
          ))}
        </View>
        <Text style={styles.helper}>{copy.conditionHelper}</Text>
      </View>

      <PhotoPicker photos={photos} onChange={setPhotos} helper={copy.photosHelper} />

      {/* Stated on the form, not discovered after submitting — nothing here goes live on its own. */}
      <Text style={styles.note}>{copy.note}</Text>
    </CreateNeedScaffold>
  );
}

const styles = StyleSheet.create({
  field: { gap: theme.spacing.sm },
  label: { ...theme.typography.caption, fontWeight: "700", color: theme.color.textPrimary },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  helper: { ...theme.typography.caption, color: theme.color.textTertiary },
  note: { ...theme.typography.caption, color: theme.color.textTertiary, lineHeight: 17 },
});
