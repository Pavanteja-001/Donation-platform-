import { useCallback, useEffect, useRef, useState } from "react";
import { uploadCommunityImage } from "../lib/api";

/**
 * Crop-before-upload for the community panel's artwork.
 *
 * WHY THIS EXISTS: the app renders these images at fixed shapes — a 16:9 event banner, a square
 * helpline icon, a 4:3 story cover. Uploading a raw phone photo means the app has to `cover`-fit
 * it, and cover-fitting a 3:4 portrait into a 16:9 slot silently cuts the head off whoever is in
 * it. Choosing the visible area here, once, is what makes those cards render cleanly instead of
 * hoping the middle of the photo happens to be the subject.
 *
 * The exported file is WebP (D-011: never send a full-res JPEG to a list) at a fixed pixel size,
 * so what lands in the bucket is already the size the app needs.
 */

export type CropShape = "cover" | "banner" | "square";

/**
 * Output geometry per shape. The aspect must match how the app lays the image out — if these
 * drift, the crop preview stops predicting what a donor actually sees.
 *
 *   cover  — SuccessStory.coverImageUrl / images[]: story list card + detail hero
 *   banner — PlatformEvent.bannerUrl: event card banner + detail hero
 *   square — PlatformEvent.iconUrl and Helpline.iconUrl: the small tile on a row
 */
export const CROP_SHAPES: Record<CropShape, { aspect: number; width: number; height: number; label: string }> = {
  cover: { aspect: 4 / 3, width: 1200, height: 900, label: "4:3 — story cover" },
  banner: { aspect: 16 / 9, width: 1280, height: 720, label: "16:9 — event banner" },
  square: { aspect: 1, width: 256, height: 256, label: "1:1 — icon" },
};

/** Frame width in the editor. Height follows from the shape's aspect. */
const FRAME_WIDTH = 420;

interface Point {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Canvas → WebP, falling back to JPEG.
 *
 * Every browser this console supports encodes WebP, but `toBlob` returns null rather than
 * throwing when a type is unsupported — so an unchecked call would upload nothing and look like
 * a network failure.
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolve(webp);
        canvas.toBlob(
          (jpeg) => (jpeg ? resolve(jpeg) : reject(new Error("Could not encode the cropped image"))),
          "image/jpeg",
          0.9
        );
      },
      "image/webp",
      0.9
    );
  });
}

function CropperModal({
  file,
  shape,
  onCancel,
  onDone,
}: {
  file: File;
  shape: CropShape;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const { aspect, width: outWidth, height: outHeight } = CROP_SHAPES[shape];
  const frameHeight = Math.round(FRAME_WIDTH / aspect);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragFrom = useRef<{ pointer: Point; offset: Point } | null>(null);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /** Scale at which the image exactly covers the frame — the floor for zoom. */
  const baseScale = natural ? Math.max(FRAME_WIDTH / natural.w, frameHeight / natural.h) : 1;
  const drawnWidth = natural ? natural.w * baseScale * zoom : 0;
  const drawnHeight = natural ? natural.h * baseScale * zoom : 0;

  /** Keep the frame fully covered: the image may never be dragged past its own edges. */
  const clampOffset = useCallback(
    (next: Point): Point => ({
      x: clamp(next.x, FRAME_WIDTH - drawnWidth, 0),
      y: clamp(next.y, frameHeight - drawnHeight, 0),
    }),
    [drawnWidth, drawnHeight, frameHeight]
  );

  // Re-centre whenever the geometry changes (image loaded, zoom changed) so the subject stays
  // put instead of drifting to a corner.
  useEffect(() => {
    if (!natural) return;
    setOffset((current) =>
      clampOffset(
        // First layout: centre. Afterwards: keep the frame's centre pinned through the zoom.
        current.x === 0 && current.y === 0
          ? { x: (FRAME_WIDTH - drawnWidth) / 2, y: (frameHeight - drawnHeight) / 2 }
          : current
      )
    );
  }, [natural, drawnWidth, drawnHeight, frameHeight, clampOffset]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragFrom.current = { pointer: { x: e.clientX, y: e.clientY }, offset };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragFrom.current;
    if (!start) return;
    setOffset(
      clampOffset({
        x: start.offset.x + (e.clientX - start.pointer.x),
        y: start.offset.y + (e.clientY - start.pointer.y),
      })
    );
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragFrom.current = null;
  }

  async function handleApply() {
    const img = imgRef.current;
    if (!img || !natural) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser");

      // Map the frame back onto the source image: whatever is visible inside the frame, in the
      // image's own pixels, is exactly the region to draw.
      const scale = baseScale * zoom;
      ctx.drawImage(
        img,
        -offset.x / scale,
        -offset.y / scale,
        FRAME_WIDTH / scale,
        frameHeight / scale,
        0,
        0,
        outWidth,
        outHeight
      );
      onDone(await canvasToBlob(canvas));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop this image");
    }
  }

  return (
    <div className="cropper-backdrop" role="dialog" aria-modal="true">
      <div className="cropper-panel">
        <header className="cropper-head">
          <div>
            <h3>Crop image</h3>
            <p className="cropper-hint">
              Drag to reposition, zoom to fill. Saved as {outWidth}×{outHeight} WebP.
            </p>
          </div>
          <button type="button" className="link" onClick={onCancel}>
            Cancel
          </button>
        </header>

        <div
          className="cropper-frame"
          style={{ width: FRAME_WIDTH, height: frameHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {objectUrl ? (
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{
                width: drawnWidth || undefined,
                height: drawnHeight || undefined,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          ) : null}
        </div>

        <label className="cropper-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>

        {error ? <p className="field-error">{error}</p> : null}

        <div className="cropper-actions">
          <button type="button" className="btn-action-danger" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-action-success" onClick={handleApply} disabled={!natural}>
            Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A labelled image field: pick → crop → upload, and hand the caller back a public URL.
 *
 * The caller only ever deals in URLs. Cropping and uploading both happen before `onChange` fires,
 * so a form can save the moment the field reports a value — there is no half-uploaded state for
 * a submit handler to trip over.
 */
export function ImageCropField({
  label,
  hint,
  shape,
  value,
  onChange,
  token,
  disabled,
}: {
  label: string;
  hint?: string;
  shape: CropShape;
  value: string | null;
  onChange: (url: string | null) => void;
  token: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCropped(blob: Blob) {
    setPending(null);
    setIsUploading(true);
    setError(null);
    try {
      onChange(await uploadCommunityImage(token, blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="crop-field">
      <label className="photo-picker-label">{label}</label>
      {hint ? <p className="crop-field-hint">{hint}</p> : null}

      <div className="crop-field-row">
        <div className={`crop-preview crop-preview-${shape}`}>
          {value ? <img src={value} alt="" /> : <span>No image</span>}
        </div>

        <div className="crop-field-actions">
          <button
            type="button"
            className="chip"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? "Uploading…" : value ? "Replace" : "Choose image"}
          </button>
          {value ? (
            <button type="button" className="link" disabled={disabled || isUploading} onClick={() => onChange(null)}>
              Remove
            </button>
          ) : null}
          <span className="crop-field-shape">{CROP_SHAPES[shape].label}</span>
        </div>
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset the input so re-picking the same file still fires a change event.
          e.target.value = "";
          if (file) setPending(file);
        }}
      />

      {pending ? (
        <CropperModal file={pending} shape={shape} onCancel={() => setPending(null)} onDone={handleCropped} />
      ) : null}
    </div>
  );
}
