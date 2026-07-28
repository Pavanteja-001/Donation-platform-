import { useRef } from "react";

// Needs are capped at 5 photos server-side (`photos: z.array(...).max(5)`), so that stays the
// default — raising it here would only produce a 400 on submit. The orphanage gallery has no
// server cap and passes `max={Infinity}`.
const DEFAULT_MAX_PHOTOS = 5;

// Reused by CreateMoneyNeedPage and CreateKitNeedPage — mirrors mobile's PhotoPicker. Holds
// File objects (not yet uploaded) until submit, when the caller uploads them via
// lib/api.ts's uploadPhotos.
export function PhotoPicker({
  files,
  onChange,
  max = DEFAULT_MAX_PHOTOS,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    onChange(Number.isFinite(max) ? [...files, ...picked].slice(0, max) : [...files, ...picked]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="photo-picker">
      <label className="photo-picker-label">
        {Number.isFinite(max) ? `Photos (optional, up to ${max})` : "Photos (optional)"}
      </label>
      <div className="photo-picker-row">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="photo-thumb-wrap">
            <img src={URL.createObjectURL(file)} alt="" className="photo-thumb" />
            <button type="button" className="photo-remove-badge" onClick={() => handleRemove(index)}>
              ×
            </button>
          </div>
        ))}
        {files.length < max && (
          <button type="button" className="photo-add-tile" onClick={() => inputRef.current?.click()}>
            + Add
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handlePick} />
    </div>
  );
}
