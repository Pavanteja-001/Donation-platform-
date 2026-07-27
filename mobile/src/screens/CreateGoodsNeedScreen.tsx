import { useState } from "react";
import { postGoodsNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { CreateNeedScaffold } from "../components/CreateNeedScaffold";
import { Input } from "../components/ui";

// PRD §11.1/§11.2 — post a GOODS need. No partial state: an item is claimed or it isn't (§11.3).
export function CreateGoodsNeedScreen({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [item, setItem] = useState("");
  const [condition, setCondition] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!item.trim()) return setError("Describe the item you need");
    if (!condition.trim()) return setError("Describe an acceptable condition (e.g. new, gently used)");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postGoodsNeed(token, {
        title: title.trim(),
        description: description.trim(),
        item: item.trim(),
        condition: condition.trim(),
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
      type="GOODS"
      title="Request an item"
      subtitle="Someone who has this item can claim your request and arrange handover."
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <Input
        label="Title"
        placeholder="e.g. Wheelchair needed for senior citizen centre"
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label="Description"
        placeholder="Describe what this item will be used for"
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      <Input
        label="Item required"
        placeholder="e.g. Manual wheelchair (adult size)"
        icon="box"
        value={item}
        onChangeText={(txt) => {
          setItem(txt);
          setError(null);
        }}
      />

      <Input
        label="Acceptable condition"
        placeholder="e.g. New or gently used"
        icon="check-square"
        helper="Be specific so donors know what will actually help"
        value={condition}
        onChangeText={(txt) => {
          setCondition(txt);
          setError(null);
        }}
      />

      <PhotoPicker photos={photos} onChange={setPhotos} helper="Optional — a reference photo helps donors match the item" />
    </CreateNeedScaffold>
  );
}
