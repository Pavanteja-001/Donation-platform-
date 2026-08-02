import type { NeedCategory } from "../lib/needCategory";
import { useState } from "react";
import { postMoneyNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { CreateNeedScaffold } from "../components/CreateNeedScaffold";
import { Input } from "../components/ui";

// PRD §7.1/§7.2 — post a MONEY need.
export function CreateMoneyNeedScreen({ onDone, category }: { onDone: () => void; category?: NeedCategory }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    const amount = Number(targetAmount);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!amount || amount <= 0) return setError("Enter a valid target amount");
    if (!upiId.trim()) return setError("Enter your UPI ID");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postMoneyNeed(token, {
        category,
        title: title.trim(),
        description: description.trim(),
        targetAmount: amount,
        upiId: upiId.trim(),
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
      type="MONEY"
      title="Raise funds"
      subtitle="Donors pay you directly over UPI and upload proof of payment."
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <Input
        label="Title"
        placeholder="e.g. Medical treatment funds"
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label="Description"
        placeholder="Describe what this request is for"
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      <Input
        label="Target amount"
        placeholder="50000"
        prefix="₹"
        keyboardType="number-pad"
        value={targetAmount}
        onChangeText={(txt) => {
          setTargetAmount(txt);
          setError(null);
        }}
      />

      {/* D-001 — no gateway in v1, so the donor pays this UPI ID directly. */}
      <Input
        label="Your UPI ID"
        placeholder="name@upi"
        icon="credit-card"
        helper="Donors pay this directly — double-check it"
        autoCapitalize="none"
        value={upiId}
        onChangeText={(txt) => {
          setUpiId(txt);
          setError(null);
        }}
      />

      <PhotoPicker photos={photos} onChange={setPhotos} />
    </CreateNeedScaffold>
  );
}
