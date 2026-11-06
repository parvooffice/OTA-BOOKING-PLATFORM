import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const cropSchema = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), width: z.number().min(1).max(100), height: z.number().min(1).max(100) });
const editSchema = z.object({ crop: cropSchema.nullable().optional(), rotation: z.number().min(-180).max(180).default(0), flipX: z.boolean().default(false), flipY: z.boolean().default(false), brightness: z.number().min(.5).max(1.5).default(1), contrast: z.number().min(.5).max(1.5).default(1), saturation: z.number().min(0).max(2).default(1) });
const patchSchema = z.object({ imageId: z.string().uuid().optional(), alt: z.string().max(300).optional(), isCover: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10000).optional(), editParams: editSchema.optional(), imageIds: z.array(z.string().uuid()).optional() });

export async function GET(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const propertyId = new URL(request.url).searchParams.get("propertyId");
  if (!propertyId) return NextResponse.json({ error: "Choose a property." }, { status: 400 });
  const { data, error } = await service.from("property_images").select("id,property_id,storage_path,thumb_path,original_path,alt,sort_order,is_cover,edit_params,created_at").eq("property_id", propertyId).order("sort_order");
  if (error) return NextResponse.json({ error: "Images could not be loaded." }, { status: 500 });
  const images = await Promise.all((data ?? []).map(async (image) => {
    const [display, thumb] = await Promise.all([
      service.storage.from("property-images").createSignedUrl(image.storage_path, 3600),
      service.storage.from("property-images").createSignedUrl(image.thumb_path, 3600)
    ]);
    return { ...image, url: display.data?.signedUrl ?? "", thumbUrl: thumb.data?.signedUrl ?? "" };
  }));
  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const form = await request.formData();
  const propertyId = form.get("propertyId");
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (typeof propertyId !== "string" || !files.length || files.length > 12) return NextResponse.json({ error: "Choose a property and up to 12 images." }, { status: 400 });
  const { data: property } = await service.from("properties").select("id,slug").eq("id", propertyId).maybeSingle();
  if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  const { data: existing } = await service.from("property_images").select("sort_order").eq("property_id", property.id).order("sort_order", { ascending: false }).limit(1);
  let order = (existing?.[0]?.sort_order ?? -1) + 1;
  const inserted = [];
  for (const file of files) {
    if (file.type !== "image/png" || !file.name.toLowerCase().endsWith(".png") || file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Property images must be PNG files under 12 MiB." }, { status: 400 });
    const original = Buffer.from(await file.arrayBuffer());
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (original.length < pngSignature.length || !original.subarray(0, pngSignature.length).equals(pngSignature)) return NextResponse.json({ error: `${file.name} is not a PNG image.` }, { status: 415 });
    const originalPath = `${property.slug}/originals/${randomUUID()}.png`;
    const { error: originalError } = await service.storage.from("property-images").upload(originalPath, original, { contentType: "image/png", upsert: false });
    if (originalError) return NextResponse.json({ error: "The original image could not be stored." }, { status: 500 });
    let display: Buffer; let thumb: Buffer;
    try {
      display = await sharp(original, { failOn: "error" }).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      thumb = await sharp(display).resize(640, 360, { fit: "cover", position: "attention" }).png({ compressionLevel: 9 }).toBuffer();
    } catch { await service.storage.from("property-images").remove([originalPath]); return NextResponse.json({ error: `${file.name} is not a supported image.` }, { status: 415 }); }
    const coverPath = `${property.slug}/gallery/${String(order + 1).padStart(2, "0")}.png`;
    const thumbPath = `${property.slug}/thumbs/${String(order + 1).padStart(2, "0")}.png`;
    const [{ error: displayError }, { error: thumbError }] = await Promise.all([
      service.storage.from("property-images").upload(coverPath, display, { contentType: "image/png", upsert: true }),
      service.storage.from("property-images").upload(thumbPath, thumb, { contentType: "image/png", upsert: true })
    ]);
    if (displayError || thumbError) return NextResponse.json({ error: "The PNG versions could not be stored." }, { status: 500 });
    const { data: row, error } = await service.from("property_images").insert({ property_id: property.id, storage_path: coverPath, thumb_path: thumbPath, original_path: originalPath, alt: `${property.slug} stay`, sort_order: order, is_cover: false, edit_params: {} }).select("id").single();
    if (error) return NextResponse.json({ error: "Image record could not be saved." }, { status: 500 });
    inserted.push(row.id); order += 1;
  }
  return NextResponse.json({ uploaded: inserted.length, imageIds: inserted }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Image update is invalid." }, { status: 400 });
  const input = parsed.data;
  if (input.imageIds) {
    if (input.imageIds.length > 200) return NextResponse.json({ error: "Too many images." }, { status: 400 });
    const { data: first } = input.imageIds.length ? await service.from("property_images").select("property_id").eq("id", input.imageIds[0]).maybeSingle() : { data: null };
    if (!first) return NextResponse.json({ error: "Images not found." }, { status: 404 });
    const { data: rows } = await service.from("property_images").select("id").eq("property_id", first.property_id);
    if (rows?.length !== input.imageIds.length || new Set(input.imageIds).size !== input.imageIds.length) return NextResponse.json({ error: "The sort order does not match this property." }, { status: 400 });
    for (const [index, imageId] of input.imageIds.entries()) {
      await service.from("property_images").update({ sort_order: 10000 + index }).eq("id", imageId);
    }
    for (const [index, imageId] of input.imageIds.entries()) {
      const { error } = await service.from("property_images").update({ sort_order: index }).eq("id", imageId);
      if (error) return NextResponse.json({ error: "Image order could not be saved." }, { status: 500 });
    }
    return NextResponse.json({ saved: true });
  }
  if (!input.imageId) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  const { data: image } = await service.from("property_images").select("id,property_id,storage_path,thumb_path,original_path,sort_order,is_cover,edit_params,properties(slug)").eq("id", input.imageId).maybeSingle();
  if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const updates: Record<string, unknown> = {};
  if (input.alt !== undefined) updates.alt = input.alt;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
  if (input.isCover === true) {
    await service.from("property_images").update({ is_cover: false }).eq("property_id", image.property_id);
    updates.is_cover = true;
  } else if (input.isCover === false) updates.is_cover = false;
  if (input.editParams && image.original_path) {
    const { data: originalBlob, error: downloadError } = await service.storage.from("property-images").download(image.original_path);
    if (downloadError || !originalBlob) return NextResponse.json({ error: "The untouched original could not be loaded." }, { status: 500 });
    const originalBuffer = Buffer.from(await originalBlob.arrayBuffer());
    const metadata = await sharp(originalBuffer).metadata();
    let pipeline = sharp(originalBuffer, { failOn: "error" });
    const crop = input.editParams.crop;
    if (crop && metadata.width && metadata.height) {
      const left = Math.max(0, Math.min(metadata.width - 1, Math.round(metadata.width * crop.x / 100)));
      const top = Math.max(0, Math.min(metadata.height - 1, Math.round(metadata.height * crop.y / 100)));
      const width = Math.max(1, Math.min(metadata.width - left, Math.round(metadata.width * crop.width / 100)));
      const height = Math.max(1, Math.min(metadata.height - top, Math.round(metadata.height * crop.height / 100)));
      pipeline = pipeline.extract({ left, top, width, height });
    }
    if (input.editParams.flipY) pipeline = pipeline.flip();
    if (input.editParams.flipX) pipeline = pipeline.flop();
    if (input.editParams.rotation) pipeline = pipeline.rotate(input.editParams.rotation, { background: { r: 245, g: 240, b: 231, alpha: 1 } });
    const contrast = input.editParams.contrast;
    pipeline = pipeline.modulate({ brightness: input.editParams.brightness, saturation: input.editParams.saturation }).linear(contrast, 128 * (1 - contrast));
    const property = Array.isArray(image.properties) ? image.properties[0] : image.properties;
    const renderAsCover = input.isCover === true || image.is_cover;
    const targetStoragePath = renderAsCover && property?.slug ? `${property.slug}/hero.png` : image.storage_path;
    const targetThumbPath = renderAsCover && property?.slug ? `${property.slug}/thumbs/cover.png` : image.thumb_path;
    const display = await pipeline.resize(renderAsCover ? { width: 1600, height: 900, fit: "cover", position: "attention" } : { width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
    const thumb = await sharp(display).resize(renderAsCover ? 640 : 600, renderAsCover ? 360 : 450, { fit: "cover", position: "attention" }).png({ compressionLevel: 9 }).toBuffer();
    const [{ error: displayError }, { error: thumbError }] = await Promise.all([
      service.storage.from("property-images").upload(targetStoragePath, display, { contentType: "image/png", upsert: true }),
      service.storage.from("property-images").upload(targetThumbPath, thumb, { contentType: "image/png", upsert: true })
    ]);
    if (displayError || thumbError) return NextResponse.json({ error: "Edited PNGs could not be saved." }, { status: 500 });
    updates.edit_params = input.editParams;
    updates.storage_path = targetStoragePath;
    updates.thumb_path = targetThumbPath;
    if (targetStoragePath !== image.storage_path || targetThumbPath !== image.thumb_path) await service.storage.from("property-images").remove([image.storage_path, image.thumb_path]);
  }
  if (Object.keys(updates).length) {
    const { error } = await service.from("property_images").update(updates).eq("id", image.id);
    if (error) return NextResponse.json({ error: "Image details could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const imageId = new URL(request.url).searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  const { data: image } = await service.from("property_images").select("id,property_id,storage_path,thumb_path,original_path,is_cover").eq("id", imageId).maybeSingle();
  if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const { error } = await service.from("property_images").delete().eq("id", image.id);
  if (error) return NextResponse.json({ error: "Image record could not be deleted." }, { status: 500 });
  const paths = [image.storage_path, image.thumb_path, image.original_path].filter((path): path is string => Boolean(path));
  await service.storage.from("property-images").remove(paths);
  if (image.is_cover) {
    const { data: nextImage } = await service.from("property_images").select("id").eq("property_id", image.property_id).order("sort_order").limit(1).maybeSingle();
    if (nextImage) await service.from("property_images").update({ is_cover: true }).eq("id", nextImage.id);
  }
  return NextResponse.json({ deleted: true });
}
