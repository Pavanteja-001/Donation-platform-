import { useRef } from "react";

const MAX_PHOTOS = 5;

// Reused by CreateMoneyNeedPage and CreateKitNeedPage — mirrors mobile's PhotoPicker. Holds
// File objects (not yet uploaded) until submit, when the caller uploads them via
// lib/api.ts's uploadPhotos.
export function PhotoPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    onChange([...files, ...picked].slice(0, MAX_PHOTOS));
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="photo-picker">
      <label className="photo-picker-label">Photos (optional, up to {MAX_PHOTOS})</label>
      <div className="photo-picker-row">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="photo-thumb-wrap">
            <img src={URL.createObjectURL(file)} alt="" className="photo-thumb" />
            <button type="button" className="photo-remove-badge" onClick={() => handleRemove(index)}>
              ×
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button type="button" className="photo-add-tile" onClick={() => inputRef.current?.click()}>
            + Add
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handlePick} />
    </div>
  );
}
