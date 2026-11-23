export type BrowserDetectedBarcode = {
  rawValue?: string;
};

export type BrowserBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<BrowserDetectedBarcode[]>;
};

type BrowserBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BrowserBarcodeDetector;

const BROWSER_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;

let zxingDetectorPromise: Promise<BrowserBarcodeDetector> | null = null;

class LazyZxingBrowserBarcodeDetector implements BrowserBarcodeDetector {
  async detect(source: ImageBitmapSource): Promise<BrowserDetectedBarcode[]> {
    if (!isVideoElement(source)) {
      return [];
    }

    const detector = await getZxingBarcodeDetector();
    return detector.detect(source);
  }
}

async function getZxingBarcodeDetector(): Promise<BrowserBarcodeDetector> {
  zxingDetectorPromise ??= createZxingBarcodeDetector().catch((error: unknown) => {
    zxingDetectorPromise = null;
    throw error;
  });
  return zxingDetectorPromise;
}

async function createZxingBarcodeDetector(): Promise<BrowserBarcodeDetector> {
  const { BarcodeFormat, BrowserMultiFormatReader } = await import("@zxing/browser");
  const reader = new BrowserMultiFormatReader();
  reader.possibleFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128];

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return {
    async detect(source: ImageBitmapSource): Promise<BrowserDetectedBarcode[]> {
      if (!isVideoElement(source)) {
        return [];
      }

      try {
        const { videoWidth, videoHeight } = source;
        if (!videoWidth || !videoHeight || !context) {
          return [];
        }

        if (canvas.width !== videoWidth) canvas.width = videoWidth;
        if (canvas.height !== videoHeight) canvas.height = videoHeight;
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const result = await reader.decodeFromCanvas(canvas);
        const rawValue = result.getText().trim();

        return rawValue ? [{ rawValue }] : [];
      } catch {
        return [];
      }
    },
  };
}

function barcodeDetectorConstructor(): BrowserBarcodeDetectorConstructor | null {
  const detector = (globalThis as typeof globalThis & {
    BarcodeDetector?: BrowserBarcodeDetectorConstructor;
  }).BarcodeDetector;

  return detector ?? null;
}

export function createBrowserBarcodeDetector(): BrowserBarcodeDetector {
  const Detector = barcodeDetectorConstructor();

  if (!Detector) {
    return new LazyZxingBrowserBarcodeDetector();
  }

  try {
    return new Detector({ formats: [...BROWSER_BARCODE_FORMATS] });
  } catch {
    return new LazyZxingBrowserBarcodeDetector();
  }
}

export function isBrowserCameraPreviewSupported(): boolean {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

export function isBrowserCameraScanSupported(): boolean {
  return isBrowserCameraPreviewSupported();
}

function isVideoElement(source: ImageBitmapSource): source is HTMLVideoElement {
  return typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement;
}
