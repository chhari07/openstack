"use client";

// pdf.js is large and browser-only, so it's loaded on first use.
// The worker is served from /public (copied there by `npm run postinstall`).
// The "legacy" build carries polyfills for newer JS (Map.getOrInsertComputed,
// Math.sumPrecise) that older Android WebViews (e.g. Chrome 133) don't have.
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let lib: Promise<PdfJs> | null = null;

export function pdfjs() {
  lib ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return m;
  });
  return lib;
}

export async function openPdf(data: ArrayBuffer) {
  const { getDocument } = await pdfjs();
  return getDocument({ data }).promise;
}

// Reads the title, page count and a cover thumbnail for a newly added PDF.
export async function inspectPdf(file: File) {
  const doc = await openPdf(await file.arrayBuffer());
  const info = (await doc.getMetadata().catch(() => null))?.info as { Title?: string } | undefined;
  const fromFile = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  // Many PDFs carry junk titles ("about:blank", "Microsoft Word - x.docx").
  const meta = info?.Title?.trim() ?? "";
  const junk = meta.length < 3 || /^(about:|untitled|microsoft |slide ?\d)|:\/\/|\.(docx?|pptx?|tex|indd)$/i.test(meta);
  const title = junk ? fromFile : meta;

  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 240 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const cover = canvas.toDataURL("image/jpeg", 0.8);

  const pages = doc.numPages;
  await doc.loadingTask.destroy();
  return { title, pages, cover };
}
