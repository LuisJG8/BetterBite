import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { ChangeEvent, RefObject, useEffect, useRef, useState } from "react";
import { MENU_PAGE_LIMIT, type MenuPageUpload, validatePages } from "../lib/menuAnalysisApi";

type CapturedMenuPage = MenuPageUpload & {
  id: string;
  previewUrl: string;
};

export function MenuCaptureControls({
  videoRef,
  cameraReady,
  cameraError,
  onRetry,
  onAnalyze,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  cameraError: string | null;
  onRetry: () => void;
  onAnalyze: (pages: MenuPageUpload[], signal: AbortSignal) => Promise<void>;
}) {
  const [pages, setPages] = useState<CapturedMenuPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const pagesRef = useRef(pages);

  const analysisRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      analysisRequest.current?.abort();
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    };
  }, []);

  async function capturePage() {
    if (pages.length >= MENU_PAGE_LIMIT) {
      return;
    }

    setError(null);
    setIsCapturing(true);
    try {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
        throw new Error("Wait for the camera preview before capturing the menu.");
      }

      const blob = await captureVideoFrame(video);
      if (!mounted.current) return;
      addPage({ blob, filename: `menu-page-${pages.length + 1}.jpg` });
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Could not capture this menu page.");
    } finally {
      setIsCapturing(false);
    }
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setError(null);
    try {
      const additions = files.map((file) => ({ blob: file, filename: file.name }));
      validatePages([...pages.map(toUpload), ...additions]);
      additions.forEach(addPage);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Could not add these menu pages.");
    }
  }

  function addPage(upload: MenuPageUpload) {
    const currentPages = pagesRef.current;
    validatePages([...currentPages.map(toUpload), upload]);
    const nextPage = {
      ...upload,
      id: globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(upload.blob),
    };
    const nextPages = [...currentPages, nextPage];
    pagesRef.current = nextPages;
    setPages(nextPages);
  }

  function removePage(id: string) {
    const removed = pagesRef.current.find((page) => page.id === id);
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    const nextPages = pagesRef.current.filter((page) => page.id !== id);
    pagesRef.current = nextPages;
    setPages(nextPages);
  }

  async function analyzePages() {
    setError(null);
    if (analysisRequest.current) return;
    const request = new AbortController();
    analysisRequest.current = request;
    setIsAnalyzing(true);
    try {
      await onAnalyze(pages.map(toUpload), request.signal);
    } catch (analysisError) {
      if (request.signal.aborted) return;
      setError(analysisError instanceof Error ? analysisError.message : "Could not analyze these menu pages.");
    } finally {
      analysisRequest.current = null;
      if (!request.signal.aborted) setIsAnalyzing(false);
    }
  }

  return (
    <div className="relative z-20 mt-auto min-h-0 overflow-y-auto bg-gradient-to-t from-black via-black/84 to-transparent px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3">
      {cameraError && (
        <div className="mb-2 rounded-xl bg-black/75 px-3 py-2 text-sm">
          <p role="status">{cameraError} You can still add a photo.</p>
          <button type="button" className="min-h-10 font-bold underline" onClick={onRetry}>Try camera again</button>
        </div>
      )}
      <div className="mb-3 flex min-h-[68px] gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Captured menu pages">
        {pages.map((page, index) => (
          <div key={page.id} className="relative h-[68px] w-[54px] shrink-0 overflow-hidden rounded-lg border border-white/50 bg-black/50">
            <img src={page.previewUrl} alt={`Captured menu page ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => removePage(page.id)}
              disabled={isAnalyzing || isCapturing}
              aria-label={`Remove menu page ${index + 1}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {pages.length === 0 && <p className="self-center text-sm font-semibold text-white/78">Capture every page before analyzing.</p>}
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl bg-[#FFD9D4] px-3 py-2 text-sm font-semibold text-[#7A1F13]">{error}</p>}

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 text-xs font-black text-white backdrop-blur focus-within:ring-2 focus-within:ring-white/70">
          <ImagePlus size={17} />
          Add photo
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            disabled={pages.length >= MENU_PAGE_LIMIT || isAnalyzing || isCapturing}
          />
        </label>

        <button
          type="button"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-45"
          onClick={() => void capturePage()}
          disabled={!cameraReady || pages.length >= MENU_PAGE_LIMIT || isCapturing || isAnalyzing}
          aria-label="Capture menu page"
        >
          {isCapturing ? <Loader2 className="animate-spin" size={25} /> : <Camera size={25} />}
        </button>

        <button
          type="button"
          className="flex min-h-11 items-center justify-center rounded-xl bg-[#12C8CA] px-3 text-xs font-black text-[#063F41] transition active:scale-[0.98] disabled:bg-white/18 disabled:text-white/45"
          onClick={() => void analyzePages()}
          disabled={pages.length === 0 || isCapturing || isAnalyzing}
          aria-label={isAnalyzing ? "Analyzing menu" : undefined}
        >
          {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : `Analyze ${pages.length || ""}`}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-white/65">{pages.length}/{MENU_PAGE_LIMIT} pages · Avoid glare and keep prices visible</p>
    </div>
  );
}

function toUpload(page: CapturedMenuPage): MenuPageUpload {
  return { blob: page.blob, filename: page.filename };
}

function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const maxDimension = 2_000;
  const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("This device cannot capture menu images."));
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the menu image."))), "image/jpeg", 0.88);
  });
}
