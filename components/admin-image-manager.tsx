"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Cropper from "react-easy-crop";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crop, FlipHorizontal, FlipVertical, ImagePlus, LoaderCircle, RotateCcw, Save, Star, Trash2, X } from "lucide-react";

type ImageRecord = { id: string; storage_path: string; thumb_path: string; original_path: string | null; alt: string; sort_order: number; is_cover: boolean; edit_params: EditParams; url: string; thumbUrl: string };
type CropArea = { x: number; y: number; width: number; height: number };
type EditParams = { crop: CropArea | null; rotation: number; flipX: boolean; flipY: boolean; brightness: number; contrast: number; saturation: number };
const initialEdits: EditParams = { crop: null, rotation: 0, flipX: false, flipY: false, brightness: 1, contrast: 1, saturation: 1 };

export function AdminImageManager({ propertyId }: { propertyId: string }) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [editing, setEditing] = useState<ImageRecord | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [edits, setEdits] = useState<EditParams>(initialEdits);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!propertyId) return;
    const response = await fetch(`/api/admin/images?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setImages(result.images ?? []);
    else setError(result.error ?? "Images could not be loaded.");
  }, [propertyId]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setNotice(""); setError("");
    const form = new FormData(); form.set("propertyId", propertyId); Array.from(files).forEach((file) => form.append("files", file));
    const response = await fetch("/api/admin/images", { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setNotice(`${result.uploaded} photo${result.uploaded === 1 ? "" : "s"} added as PNG.`); await refresh(); }
    else setError(result.error ?? "Upload failed.");
    setBusy(false);
  }

  async function update(body: Record<string, unknown>, success = "Saved.") {
    setBusy(true); setError("");
    const response = await fetch("/api/admin/images", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setNotice(success); await refresh(); }
    else setError(result.error ?? "Changes could not be saved.");
    setBusy(false);
  }

  function dragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((image) => image.id === active.id);
    const newIndex = images.findIndex((image) => image.id === over.id);
    const reordered = arrayMove(images, oldIndex, newIndex);
    setImages(reordered);
    void update({ imageIds: reordered.map((image) => image.id) }, "Gallery order saved.");
  }

  function openEditor(image: ImageRecord) {
    setEditing(image); setCrop({ x: 0, y: 0 }); setZoom(1);
    setEdits({ ...initialEdits, ...(image.edit_params ?? {}) });
  }

  const cropComplete = useCallback((_pixels: CropArea, percent: CropArea) => setEdits((state) => ({ ...state, crop: percent })), []);
  const cropImage = useMemo(() => editing?.url ?? "", [editing]);

  async function saveEdits() {
    if (!editing) return;
    await update({ imageId: editing.id, editParams: edits }, "Photo edits rendered. The original is unchanged.");
    setEditing(null);
  }

  async function remove(image: ImageRecord) {
    if (!window.confirm(`Delete ${image.alt || "this photo"}? The original and PNG versions will be removed.`)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/images?imageId=${encodeURIComponent(image.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setNotice("Photo deleted."); await refresh(); }
    else setError(result.error ?? "Photo could not be deleted.");
    setBusy(false);
  }

  return <div>
    <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-end"><div><p className="eyebrow text-laterite">Property photographs</p><h3 className="mt-1 font-display text-3xl">Image manager</h3><p className="mt-2 max-w-xl text-xs leading-5 text-ink/55">Upload JPG, WebP, HEIC or PNG. The untouched original stays in Storage; display and thumbnail files are re-rendered as PNG.</p></div><label className="button-ink w-fit cursor-pointer !min-h-11">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add photographs<input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /></label></div>
    {(notice || error) && <p role={error ? "alert" : "status"} className={`mt-4 text-xs ${error ? "text-laterite" : "text-lagoon"}`}>{error || notice}</p>}
    {images.length ? <DndContext collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{images.map((image) => <SortableImage key={image.id} image={image} busy={busy} onEdit={openEditor} onCover={() => void update({ imageId: image.id, isCover: true }, "Cover photo updated.")} onDelete={() => void remove(image)} onAlt={(alt) => void update({ imageId: image.id, alt }, "Alt text saved.")} />)}</div></SortableContext></DndContext> : <div className="mt-5 border border-dashed border-ink/20 p-10 text-center"><p className="font-display text-2xl">A clean slate.</p><p className="mt-2 text-xs text-ink/50">Add your first property photograph.</p></div>}
    {editing && <div className="fixed inset-0 z-[120] grid place-items-center bg-ink/65 p-3 md:p-8"><section role="dialog" aria-modal="true" aria-label="Edit property photo" className="grid max-h-[94svh] w-full max-w-5xl overflow-y-auto bg-paper shadow-2xl lg:grid-cols-[1.3fr_.7fr]"><div className="relative min-h-[320px] bg-ink md:min-h-[520px]"><Cropper image={cropImage} crop={crop} zoom={zoom} rotation={edits.rotation} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={cropComplete} aspect={4 / 3} showGrid={false} /></div><div className="p-5 md:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow text-laterite">Non-destructive edits</p><h3 className="mt-1 font-display text-3xl">Tune the light.</h3></div><button className="p-2" aria-label="Close editor" onClick={() => setEditing(null)}><X size={18} /></button></div><label className="mt-5 grid gap-2 text-xs">Zoom <input type="range" min="1" max="3" step=".05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label className="mt-4 grid gap-2 text-xs">Rotate · {edits.rotation}° <input type="range" min="-180" max="180" step="1" value={edits.rotation} onChange={(event) => setEdits((state) => ({ ...state, rotation: Number(event.target.value) }))} /></label><div className="mt-4 flex gap-2"><button className="button-outline !min-h-9 !px-3 !text-xs" onClick={() => setEdits((state) => ({ ...state, flipX: !state.flipX }))}><FlipHorizontal size={14} /> Flip horizontal</button><button className="button-outline !min-h-9 !px-3 !text-xs" onClick={() => setEdits((state) => ({ ...state, flipY: !state.flipY }))}><FlipVertical size={14} /> Flip vertical</button></div>{(["brightness", "contrast", "saturation"] as const).map((key) => <label key={key} className="mt-4 grid gap-2 text-xs capitalize">{key} · {edits[key].toFixed(2)}<input type="range" min={key === "saturation" ? 0 : .5} max={key === "saturation" ? 2 : 1.5} step=".01" value={edits[key]} onChange={(event) => setEdits((state) => ({ ...state, [key]: Number(event.target.value) }))} /></label>)}<p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-ink/45"><Crop size={13} className="mt-0.5 shrink-0" />Drag the frame to crop. Save stores these edit settings and creates new PNG display files.</p><div className="mt-6 flex gap-2"><button className="button-outline flex-1" onClick={() => { setEdits(initialEdits); setCrop({ x: 0, y: 0 }); setZoom(1); }}><RotateCcw size={14} /> Reset</button><button disabled={busy} className="button-ink flex-1 disabled:opacity-45" onClick={() => void saveEdits()}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Save photo</button></div></div></section></div>}
  </div>;
}

function SortableImage({ image, busy, onEdit, onCover, onDelete, onAlt }: { image: ImageRecord; busy: boolean; onEdit: (image: ImageRecord) => void; onCover: () => void; onDelete: () => void; onAlt: (alt: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  const [alt, setAlt] = useState(image.alt);
  useEffect(() => setAlt(image.alt), [image.alt]);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .5 : 1 };
  return <article ref={setNodeRef} style={style} className="overflow-hidden border border-ink/10 bg-paper"><div {...attributes} {...listeners} className="relative aspect-[1.25] touch-none cursor-grab bg-[#ddd0ba] active:cursor-grabbing"><Image src={image.thumbUrl} alt={image.alt} fill sizes="(max-width: 640px) 100vw, 33vw" unoptimized className="object-cover" /><span className="absolute left-2 top-2 bg-paper/90 px-2 py-1 text-[9px] uppercase tracking-widest">{image.is_cover ? "Cover" : `Photo 0${image.sort_order + 1}`}</span></div><div className="p-3"><label className="grid gap-1 text-[10px] font-semibold">Alt text<input value={alt} onChange={(event) => setAlt(event.target.value)} onBlur={() => { if (alt !== image.alt) onAlt(alt); }} className="h-9 border border-ink/15 bg-[#fbf8f1] px-2 text-xs font-normal outline-none focus:border-laterite" /></label><div className="mt-3 flex justify-between gap-2"><button disabled={busy} className="button-outline !min-h-9 !px-2 !text-[10px]" onClick={() => onEdit(image)}><Crop size={13} /> Edit</button><button disabled={busy || image.is_cover} className="button-outline !min-h-9 !px-2 !text-[10px]" onClick={onCover}><Star size={13} /> Set cover</button><button disabled={busy} onClick={onDelete} aria-label="Delete photo" className="grid h-9 w-9 place-items-center border border-ink/15 text-laterite hover:bg-[#f0e0d8]"><Trash2 size={14} /></button></div></div></article>;
}
