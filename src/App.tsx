import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CameraIcon as HeroCameraIcon,
  HomeIcon as HeroHomeIcon,
  MagnifyingGlassIcon as HeroMagnifyingGlassIcon,
  MapPinIcon as HeroMapPinIcon,
  UserIcon as HeroUserIcon,
} from "@heroicons/react/24/outline";
import {
  AlertTriangle,
  Apple,
  Barcode,
  Bell,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock,
  Database,
  DollarSign,
  FileText,
  History,
  Leaf,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  SwitchCamera,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import boulderCanyonChips from "./assets/boulder-canyon-chips.avif";
import burgerKingFries from "./assets/burger-king-fries.jpg";
import foodPhoto from "./assets/onboarding-food-hero.png";
import menuPhoto from "./assets/menu-photo.jpg";
import { MenuCaptureControls } from "./components/MenuCaptureControls";
import { MenuResults } from "./components/MenuResults";
import { analyzeMenuPages, type MenuPageUpload } from "./lib/menuAnalysisApi";
import profilePhoto from "./assets/luis-gonzalez-profile.jpeg";
import recipeBuilderPhoto from "./assets/recipe-builder-photo.jpg";
import huGemsPhoto from "./assets/recommendations/hu-dark-chocolate-gems.webp";
import lesserEvilPopcornPhoto from "./assets/recommendations/lesserevil-pink-salt-popcorn.webp";
import olipopColaPhoto from "./assets/recommendations/olipop-vintage-cola.webp";
import sieteChipsPhoto from "./assets/recommendations/siete-sea-salt-chips.webp";
import sieteCookiesPhoto from "./assets/recommendations/siete-shortbread-cookies.webp";
import "./components/dashboard.css";
import { OnboardingFlow, type OnboardingStep } from "./components/OnboardingFlow";
import { MapScreen } from "./components/MapScreen";
import { DIET_OPTIONS, FOOD_AVOIDANCE_OPTIONS, MAIN_GOAL_OPTIONS, type ChoiceOption } from "./components/onboardingOptions";
import { SearchScreen } from "./components/SearchScreen";
import { getAlternatives } from "./lib/alternatives";
import { buildActivityChart, formatActivityWeekRange, type ActivityChart } from "./lib/activityChart";
import { getBarcodeError, normalizeBarcode } from "./lib/barcode";
import { createBrowserBarcodeDetector, isBrowserCameraPreviewSupported } from "./lib/browserBarcodeScanner";
import { FOOD_RECOGNITION_MIN_SCORE, recognizeFoodInImage, type FoodRecognitionResult } from "./lib/foodRecognition";
import { filterHistoryItems } from "./lib/historyFilters";
import { fetchProductByBarcode } from "./lib/openFoodFacts";
import { scoreProduct } from "./lib/qualityScore";
import { getBarcodeScannerFormats } from "./lib/scannerFormats";
import {
  appendSavedSwapHistory,
  discardLegacyMapLocation,
  LOGIN_ACTIVITY_SESSION_KEY,
  deleteLocalProfileData,
  loadActivityDays,
  loadOnboardingProfile,
  loadSavedSwapHistory,
  loadScanHistory,
  loadSettings,
  recordActivity,
  saveOnboardingProfile,
  saveSettings,
  upsertScanHistory,
} from "./lib/storage";
import { acceptSwap, type AcceptedSwapIds } from "./lib/swapState";
import {
  getAdjacentTab,
  getSwipeProgress,
  getTabDirection,
  resolveSwipeTarget,
  shouldStartHorizontalSwipe,
  type AppTab,
  type TabDirection,
} from "./lib/tabNavigation";
import type {
  ActivityDay,
  AlternativeProduct,
  AppSettings,
  DietPreference,
  FoodAvoidance,
  HistoryFilter,
  IngredientFlag,
  MainGoal,
  MenuAnalysis,
  OnboardingProfile,
  Product,
  QualityScore,
  SavedSwapHistoryItem,
  ScanHistoryItem,
} from "./types";

type VisibleOnboardingStep = Exclude<OnboardingStep, "app">;
type ScanCameraMode = "barcode" | "food" | "menu";
type CameraFacingMode = "environment" | "user";
type ProfileView = "overview" | "history";
type SwapDetailSide = "original" | "alternative";
type SwapDetail = {
  barcode: string;
  side: SwapDetailSide;
  alternativeId?: string;
};
type SavedSwapHistoryGroup = {
  barcode: string;
  scannedProduct: SavedSwapHistoryItem["scannedProduct"];
  latestSavedAt: string;
  swaps: SavedSwapHistoryItem[];
};
let didRecordLoginThisRuntimeDate: string | null = null;

const FALLBACK_SWAP: AlternativeProduct = {
  id: "fallback-boulder-canyon-chips",
  brand: "Boulder Canyon",
  name: "Avocado Oil Classic Sea Salt Kettle Chips",
  category: "Snack",
  reason: "A cleaner chip option made with potatoes, avocado oil, and sea salt.",
  scoreHint: "Simple ingredients",
  similarityReason: "Keeps the salty potato crunch of fries while moving to a simpler chip made with avocado oil.",
};

const ESTIMATED_SWAP_PRICES: Record<string, string> = {
  "fallback-boulder-canyon-chips": "$5.49",
  "simple-mills-pancake-waffle": "$7.99",
  "birch-benders-protein-pancake": "$6.99",
  "bobs-red-mill-whole-grain-pancake": "$5.99",
  "sparkling-water": "$4.99",
  olipop: "$2.49",
  "unsweetened-tea": "$2.29",
  "boulder-canyon-avocado-oil": "$5.49",
  "jacksons-potato-chips": "$4.99",
  "lesser-evil-potato-puffs": "$4.49",
  "siete-chips": "$5.99",
  "late-july-sea-salt": "$4.49",
  "food-should-taste-good": "$4.29",
  jacksons: "$4.99",
  "homemade-popcorn": "$1.25",
  "seven-sundays": "$6.99",
  oatmeal: "$0.55",
  "sprouted-granola": "$6.49",
  "purely-elizabeth-granola": "$7.99",
  "seven-sundays-muesli": "$6.99",
  "homemade-granola": "$1.10",
  rxbar: "$2.49",
  "aloha-protein-bar": "$2.79",
  "perfect-bar": "$2.99",
  "lara-bar": "$1.49",
  "thats-it-bar": "$1.79",
  "kind-simple-crunch": "$1.69",
  "simple-mills": "$5.99",
  "hu-chocolate": "$5.49",
  "dates-almond-butter": "$1.25",
  "simple-mills-crackers": "$5.49",
  "marys-gone-crackers": "$5.99",
  "wasa-crispbread": "$3.79",
  "lesser-evil-popcorn": "$4.49",
  "skinny-pop-original": "$3.99",
  "air-popped-popcorn": "$0.65",
  "plain-greek": "$1.25",
  "siggis-plain": "$1.99",
  "coconut-yogurt": "$2.49",
  "organic-milk": "$5.99",
  "grassfed-milk": "$6.99",
  "almond-milk": "$3.99",
  "whole-apple": "$0.90",
  "unsweetened-applesauce": "$0.85",
  "no-syrup-fruit-cup": "$1.25",
  "country-archer-beef-stick": "$2.49",
  "chomps-beef-stick": "$2.49",
  "epic-bar": "$2.99",
  nuts: "$1.50",
  jerky: "$2.49",
  fruit: "$0.90",
};

const TEST_BARCODE = "5449000000996";
const ONBOARDING_SEQUENCE: VisibleOnboardingStep[] = ["welcome", "benefits", "main-goal", "diet", "avoid", "account"];
const RECOMMENDED_FOODS = [
  {
    name: "Siete Sea Salt Chips",
    detail: "Tortilla chip craving",
    score: "9.1",
    price: "$4.99",
    serving: "1 oz serving",
    calories: 130,
    macros: { protein: "1g", carbs: "19g", fat: "7g", fiber: "2g", sugar: "1g" },
    ingredients: ["Cassava flour", "Avocado oil", "Coconut flour", "Chia seed", "Sea salt"],
    stores: [
      { name: "Whole Foods Market", distance: "0.8 mi", aisle: "Snack aisle", stock: "In stock" },
      { name: "Target", distance: "1.6 mi", aisle: "Better-for-you snacks", stock: "Low stock" },
      { name: "Walmart", distance: "2.3 mi", aisle: "Chips", stock: "In stock" },
    ],
    imageSrc: sieteChipsPhoto,
  },
  {
    name: "Siete Shortbread Cookies",
    detail: "Cookie craving",
    score: "8.8",
    price: "$5.49",
    serving: "3 cookies",
    calories: 130,
    macros: { protein: "2g", carbs: "18g", fat: "6g", fiber: "1g", sugar: "7g" },
    ingredients: ["Almond flour", "Cassava flour", "Coconut sugar", "Cinnamon", "Sea salt"],
    stores: [
      { name: "Sprouts Farmers Market", distance: "1.1 mi", aisle: "Cookies", stock: "In stock" },
      { name: "Whole Foods Market", distance: "1.9 mi", aisle: "Gluten-free snacks", stock: "In stock" },
      { name: "Target", distance: "3.0 mi", aisle: "Natural grocery", stock: "Check app" },
    ],
    imageSrc: sieteCookiesPhoto,
  },
  {
    name: "OLIPOP Vintage Cola",
    detail: "Soda craving",
    score: "8.7",
    price: "$2.49",
    serving: "12 fl oz can",
    calories: 35,
    macros: { protein: "0g", carbs: "16g", fat: "0g", fiber: "9g", sugar: "2g" },
    ingredients: ["Carbonated water", "Cassava root fiber", "Chicory root inulin", "Natural cola flavor", "Stevia"],
    stores: [
      { name: "Target", distance: "0.7 mi", aisle: "Functional drinks", stock: "In stock" },
      { name: "Kroger", distance: "1.4 mi", aisle: "Soda aisle", stock: "In stock" },
      { name: "Whole Foods Market", distance: "2.1 mi", aisle: "Cold drinks", stock: "In stock" },
    ],
    imageSrc: olipopColaPhoto,
  },
  {
    name: "Hu Dark Chocolate Gems",
    detail: "Chocolate craving",
    score: "8.9",
    price: "$6.99",
    serving: "1 oz serving",
    calories: 160,
    macros: { protein: "2g", carbs: "14g", fat: "12g", fiber: "3g", sugar: "8g" },
    ingredients: ["Organic cacao", "Coconut sugar", "Cocoa butter"],
    stores: [
      { name: "Whole Foods Market", distance: "0.9 mi", aisle: "Chocolate", stock: "In stock" },
      { name: "Sprouts Farmers Market", distance: "2.2 mi", aisle: "Candy alternatives", stock: "Low stock" },
      { name: "Fresh Market", distance: "3.4 mi", aisle: "Snacks", stock: "Check app" },
    ],
    imageSrc: huGemsPhoto,
  },
  {
    name: "LesserEvil Pink Salt Popcorn",
    detail: "Popcorn craving",
    score: "8.6",
    price: "$4.49",
    serving: "3 cups",
    calories: 120,
    macros: { protein: "2g", carbs: "15g", fat: "6g", fiber: "4g", sugar: "0g" },
    ingredients: ["Organic popcorn", "Coconut oil", "Himalayan pink salt"],
    stores: [
      { name: "Whole Foods Market", distance: "0.8 mi", aisle: "Popcorn", stock: "In stock" },
      { name: "Target", distance: "1.8 mi", aisle: "Snack aisle", stock: "In stock" },
      { name: "Walmart", distance: "2.6 mi", aisle: "Popcorn", stock: "Check app" },
    ],
    imageSrc: lesserEvilPopcornPhoto,
  },
];
type RecommendedFood = (typeof RECOMMENDED_FOODS)[number];


function canContinueOnboardingStep(step: OnboardingStep, profile: OnboardingProfile): boolean {
  switch (step) {
    case "welcome":
    case "benefits":
      return true;
    case "main-goal":
      return profile.mainGoals.length > 0;
    case "diet":
      return profile.dietPreferences.length > 0;
    case "avoid":
      return profile.foodsToAvoid.length > 0;
    case "account":
      return true;
    case "app":
      return false;
  }
}

function toggleMultiSelect<T extends string>(currentValues: T[], value: T, exclusiveValue?: T): T[] {
  if (currentValues.includes(value)) {
    return currentValues.filter((item) => item !== value);
  }

  if (exclusiveValue && value === exclusiveValue) {
    return [value];
  }

  const nextValues = exclusiveValue ? currentValues.filter((item) => item !== exclusiveValue) : currentValues;
  return [...nextValues, value];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [profileView, setProfileView] = useState<ProfileView>("overview");
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile>(() => loadOnboardingProfile());
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(() => (loadOnboardingProfile().completed ? "app" : "welcome"));
  const [barcode, setBarcode] = useState(TEST_BARCODE);
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ strictSeedOilPenalty: true });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanEntry, setShowScanEntry] = useState(false);
  const [showBrowserScanner, setShowBrowserScanner] = useState(false);
  const [browserCameraStream, setBrowserCameraStream] = useState<MediaStream | null>(null);
  const [browserCameraError, setBrowserCameraError] = useState<string | null>(null);
  const [browserCameraStatus, setBrowserCameraStatus] = useState("Starting camera...");
  const [scanCameraMode, setScanCameraMode] = useState<ScanCameraMode>("barcode");
  const [cameraFacingMode, setCameraFacingMode] = useState<CameraFacingMode>("environment");
  const [isNativeCameraPreview, setIsNativeCameraPreview] = useState(false);
  const [foodScanResult, setFoodScanResult] = useState<FoodRecognitionResult | null>(null);
  const [menuAnalysis, setMenuAnalysis] = useState<MenuAnalysis | null>(null);
  const [menuRestaurantName, setMenuRestaurantName] = useState<string>();
  const [swapDetail, setSwapDetail] = useState<SwapDetail | null>(null);
  const [acceptedSwapIds, setAcceptedSwapIds] = useState<AcceptedSwapIds>({});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [savedSwapHistory, setSavedSwapHistory] = useState<SavedSwapHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ScanHistoryItem | null>(null);
  const [selectedSavedSwap, setSelectedSavedSwap] = useState<SavedSwapHistoryItem | null>(null);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<Product | null>(null);
  const [selectedHistoryScore, setSelectedHistoryScore] = useState<QualityScore | null>(null);
  const [historyDetailError, setHistoryDetailError] = useState<string | null>(null);
  const [isHistoryDetailLoading, setIsHistoryDetailLoading] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const historyDetailRequestRef = useRef(0);
  const browserCameraStreamRef = useRef<MediaStream | null>(null);
  const browserCameraRequestRef = useRef(0);
  const nativeCameraRequestRef = useRef(0);
  const nativeScanActiveRef = useRef(false);
  const nativeCancelRef = useRef<Promise<void>>(Promise.resolve());
  const cameraSessionRef = useRef(0);
  const lookupRequestRef = useRef(0);

  const qualityScore = useMemo(() => (product ? scoreProduct(product, settings) : null), [product, settings]);
  const alternatives = useMemo(() => (product ? getAlternatives(product) : []), [product]);
  const activityChart = useMemo(() => buildActivityChart(activityDays), [activityDays]);
  const savedSwapKeys = useMemo(
    () => new Set(savedSwapHistory.map((item) => createSavedSwapStateKey(item.scannedProduct.barcode, item.swap.id))),
    [savedSwapHistory],
  );

  useEffect(() => {
    discardLegacyMapLocation();
    setHistory(loadScanHistory());
    setSavedSwapHistory(loadSavedSwapHistory());
    setSettings(loadSettings());
    setActivityDays(loadActivityDays());
  }, []);

  useEffect(() => {
    return () => {
      cameraSessionRef.current += 1;
      browserCameraRequestRef.current += 1;
      stopMediaStream(browserCameraStreamRef.current);
      void cancelNativeCameraScanner();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "scan" || !product) {
      return;
    }

    scrollScanScreenToTop();
  }, [activeTab, product]);

  useEffect(() => {
    document.documentElement.classList.toggle("native-camera-active", isNativeCameraPreview);
    document.body.classList.toggle("native-camera-active", isNativeCameraPreview);

    return () => {
      document.documentElement.classList.remove("native-camera-active");
      document.body.classList.remove("native-camera-active");
    };
  }, [isNativeCameraPreview]);

  useEffect(() => {
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0 });
    });
  }, [activeTab, profileView, selectedHistoryItem, selectedSavedSwap]);

  function scrollScanScreenToTop(): void {
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0 });
      window.setTimeout(() => {
        contentScrollRef.current?.scrollTo({ top: 0, left: 0 });
      }, 80);
    });
  }

  async function handleLookup(input = barcode) {
    const lookupId = ++lookupRequestRef.current;
    const validationError = getBarcodeError(input);

    if (validationError) {
      setIsLoading(false);
      setProduct(null);
      setError(validationError);
      setShowScanEntry(true);
      return;
    }

    const normalized = normalizeBarcode(input);
    setMenuAnalysis(null);

    setIsLoading(true);
    setError(null);
    setProduct(null);
    setFoodScanResult(null);

    try {
      const nextProduct = await fetchProductByBarcode(normalized);
      if (lookupId !== lookupRequestRef.current) return;
      const nextScore = scoreProduct(nextProduct, settings);
      setProduct(nextProduct);
      setShowScanEntry(false);
      setBarcode(normalized);
      setSwapDetail(null);
      setActiveTab("scan");
      setHistory(
        upsertScanHistory({
          barcode: nextProduct.barcode,
          productName: nextProduct.name,
          brand: nextProduct.brand,
          score: nextScore.value,
          imageUrl: nextProduct.imageUrl,
          scannedAt: new Date().toISOString(),
        }),
      );
      setActivityDays(recordActivity("barcode_scan"));
      scrollScanScreenToTop();
    } catch (lookupError) {
      if (lookupId !== lookupRequestRef.current) return;
      const message = lookupError instanceof Error ? lookupError.message : "Could not fetch this product.";
      setError(message);
      setShowScanEntry(true);
    } finally {
      if (lookupId === lookupRequestRef.current) setIsLoading(false);
    }
  }

  async function handleScanWithCamera(facingMode: CameraFacingMode = cameraFacingMode) {
    if (!isTauriRuntime()) {
      showManualBarcodeFallback("Open the local dev URL in Chrome or Safari to test the camera, or type the barcode below.");
      return;
    }

    const requestId = nativeCameraRequestRef.current + 1;
    nativeCameraRequestRef.current = requestId;
    setShowBrowserScanner(true);
    setIsNativeCameraPreview(true);
    setBrowserCameraError(null);
    setBrowserCameraStatus("Point the camera at a barcode.");

    try {
      const scanner = await import("@tauri-apps/plugin-barcode-scanner");
      if (nativeCameraRequestRef.current !== requestId) return;
      const permission = await scanner.requestPermissions();

      if (nativeCameraRequestRef.current !== requestId) {
        return;
      }

      if (permission !== "granted") {
        nativeScanActiveRef.current = false;
        const message = "Camera permission is required to scan a barcode.";
        setIsNativeCameraPreview(false);
        setBrowserCameraError(message);
        setBrowserCameraStatus("Camera permission is blocked.");
        showManualBarcodeFallback(message);
        return;
      }

      nativeScanActiveRef.current = true;
      const scanned = await scanner.scan({
        cameraDirection: facingMode === "environment" ? "back" : "front",
        formats: getBarcodeScannerFormats(scanner.Format),
        windowed: true,
      });

      if (nativeCameraRequestRef.current !== requestId) {
        return;
      }

      nativeScanActiveRef.current = false;
      setIsNativeCameraPreview(false);
      setShowBrowserScanner(false);
      setBarcode(scanned.content);
      await handleLookup(scanned.content);
    } catch (scanError) {
      if (nativeCameraRequestRef.current !== requestId) {
        return;
      }

      nativeScanActiveRef.current = false;
      setIsNativeCameraPreview(false);

      if (isScannerDismissalError(scanError)) {
        closeCamera();
        return;
      }

      const message = scanError instanceof Error ? scanError.message : "Barcode scanner is unavailable on this target.";
      setBrowserCameraError(message);
      setBrowserCameraStatus("Camera access did not start.");
      showManualBarcodeFallback(message);
    }
  }

  function cancelNativeCameraScanner(): Promise<void> {
    nativeCameraRequestRef.current += 1;
    if (nativeScanActiveRef.current) {
      nativeScanActiveRef.current = false;
      nativeCancelRef.current = import("@tauri-apps/plugin-barcode-scanner")
        .then((scanner) => scanner.cancel())
        .catch(() => { /* The native scan may already have completed. */ });
    }
    return nativeCancelRef.current;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleLookup();
  }

  function startScanSession(mode: ScanCameraMode = "barcode", restaurantName?: string) {
    lookupRequestRef.current += 1;
    setIsLoading(false);
    setShowScanEntry(false);
    setError(null);
    setMenuRestaurantName(restaurantName);
    setScanCameraMode(mode);
    const initialFacing = mode === "menu" ? "environment" : cameraFacingMode;
    setCameraFacingMode(initialFacing);
    void openCamera(mode, initialFacing);
  }

  async function openCamera(mode: ScanCameraMode, facing: CameraFacingMode) {
    const session = ++cameraSessionRef.current;
    stopBrowserCameraStream();
    setBrowserCameraError(null);
    setIsNativeCameraPreview(false);
    setShowBrowserScanner(true);
    await cancelNativeCameraScanner();
    if (session !== cameraSessionRef.current) return;
    if (mode === "barcode" && isTauriRuntime() && isLikelyMobileRuntime()) {
      await handleScanWithCamera(facing);
    } else {
      await startBrowserCameraScanner(facing);
    }
  }

  function showManualBarcodeFallback(message: string) {
    setShowScanEntry(true);
    setError(message);
  }

  function handleScanTabPress() {
    handleTabChange("scan");
    startScanSession();
  }

  function stopBrowserCameraStream() {
    browserCameraRequestRef.current += 1;
    stopMediaStream(browserCameraStreamRef.current);
    browserCameraStreamRef.current = null;
    setBrowserCameraStream(null);
  }

  async function startBrowserCameraScanner(facingMode: CameraFacingMode = cameraFacingMode) {
    const requestId = browserCameraRequestRef.current + 1;
    browserCameraRequestRef.current = requestId;

    setIsNativeCameraPreview(false);
    stopMediaStream(browserCameraStreamRef.current);
    browserCameraStreamRef.current = null;
    setBrowserCameraStream(null);
    setBrowserCameraError(null);
    setShowScanEntry(false);
    setError(null);
    setBrowserCameraStatus("Starting camera...");
    setShowBrowserScanner(true);

    try {
      if (!isBrowserCameraPreviewSupported()) {
        setBrowserCameraError("Camera access is unavailable on this device.");
        return;
      }
      const permissionState = await getBrowserCameraPermissionState();

      if (browserCameraRequestRef.current !== requestId) {
        return;
      }

      if (permissionState === "denied") {
        const message = getBrowserCameraBlockedMessage();
        setBrowserCameraError(message);
        showManualBarcodeFallback(message);
        setBrowserCameraStatus("Camera permission is blocked.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (browserCameraRequestRef.current !== requestId) {
        stopMediaStream(stream);
        return;
      }

      browserCameraStreamRef.current = stream;
      setBrowserCameraStream(stream);
      setBrowserCameraStatus("Camera preview is active.");
    } catch (cameraError) {
      if (browserCameraRequestRef.current !== requestId) {
        return;
      }

      const message = getBrowserCameraErrorMessage(cameraError);
      setBrowserCameraError(message);
      showManualBarcodeFallback(message);
      setBrowserCameraStatus("Camera access did not start.");
    }
  }

  function dismissBrowserScanner() {
    cameraSessionRef.current += 1;
    stopBrowserCameraStream();
    void cancelNativeCameraScanner();
    setIsNativeCameraPreview(false);
    setShowBrowserScanner(false);
    setBrowserCameraError(null);
    setBrowserCameraStatus("Starting camera...");
  }

  function handleCameraModeChange(nextMode: ScanCameraMode) {
    if (nextMode === scanCameraMode) return;
    setScanCameraMode(nextMode);
    if (!browserCameraStreamRef.current || (nextMode === "barcode" && isTauriRuntime() && isLikelyMobileRuntime())) {
      void openCamera(nextMode, cameraFacingMode);
    }
  }

  function handleCameraFlip() {
    const facing = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(facing);
    void openCamera(scanCameraMode, facing);
  }

  function closeCamera() {
    dismissBrowserScanner();
    setShowScanEntry(!foodScanResult && !menuAnalysis);
  }

  function handleBrowserBarcodeDetected(scannedBarcode: string) {
    stopBrowserCameraStream();
    setIsNativeCameraPreview(false);
    setShowBrowserScanner(false);
    setShowScanEntry(false);
    setFoodScanResult(null);
    setBarcode(scannedBarcode);
    void handleLookup(scannedBarcode);
  }

  function handleBrowserFoodDetected(result: FoodRecognitionResult) {
    lookupRequestRef.current += 1;
    setIsLoading(false);
    setMenuAnalysis(null);
    setShowScanEntry(false);
    setProduct(null);
    setError(null);
    setActiveTab("scan");
    setFoodScanResult(result);
  }

  async function handleMenuAnalyze(pages: MenuPageUpload[], signal: AbortSignal) {
    const analysis = await analyzeMenuPages({ pages, restaurantName: menuRestaurantName, signal });
    if (signal.aborted) return;
    lookupRequestRef.current += 1;
    setIsLoading(false);
    setMenuAnalysis(analysis);
    setFoodScanResult(null);
    setError(null);
    setProduct(null);
    setShowScanEntry(false);
    dismissBrowserScanner();
    setActiveTab("scan");
  }

  function updateStrictSetting(value: boolean) {
    const next = { ...settings, strictSeedOilPenalty: value };
    setSettings(next);
    saveSettings(next);
  }

  function handleTabChange(nextTab: AppTab) {
    if (nextTab === activeTab) {
      return;
    }

    if (nextTab === "profile" && activeTab !== "profile") {
      setActivityDays(recordActivity("profile_view"));
    }

    if (nextTab !== "scan") {
      setSwapDetail(null);
    }

    if (nextTab !== "profile") {
      setProfileView("overview");
      clearHistoryDetail();
    }

    setActiveTab(nextTab);
  }

  function handleProfileHistoryOpen() {
    setProfileView("history");
    clearHistoryDetail();
  }

  function handleProfileHistoryBack() {
    setProfileView("overview");
    clearHistoryDetail();
  }

  function handleHistoryFilterChange(nextFilter: HistoryFilter) {
    setHistoryFilter(nextFilter);
    clearHistoryDetail();
  }

  function handleOnboardingBack() {
    if (onboardingStep === "app") {
      return;
    }

    const currentIndex = ONBOARDING_SEQUENCE.indexOf(onboardingStep);
    if (currentIndex <= 0) {
      return;
    }

    setOnboardingStep(ONBOARDING_SEQUENCE[currentIndex - 1]);
  }

  function handleOnboardingContinue() {
    if (onboardingStep === "app" || !canContinueOnboardingStep(onboardingStep, onboardingProfile)) {
      return;
    }

    if (onboardingStep === "account") {
      const completedProfile = saveOnboardingProfile({ ...onboardingProfile, completed: true });
      const loginActivity = recordLoginActivityOnce();
      setOnboardingProfile(completedProfile);
      if (loginActivity) {
        setActivityDays(loginActivity);
      }
      setOnboardingStep("app");
      setActiveTab("home");
      window.scrollTo({ top: 0, left: 0 });
      return;
    }

    const currentIndex = ONBOARDING_SEQUENCE.indexOf(onboardingStep);
    const nextStep = ONBOARDING_SEQUENCE[currentIndex + 1];
    setOnboardingProfile(saveOnboardingProfile({ ...onboardingProfile, completed: false }));
    if (nextStep) {
      setOnboardingStep(nextStep);
    }
  }

  function handleOnboardingSkip() {
    if (onboardingStep !== "main-goal" && onboardingStep !== "diet" && onboardingStep !== "avoid") {
      return;
    }

    const currentIndex = ONBOARDING_SEQUENCE.indexOf(onboardingStep);
    const nextStep = ONBOARDING_SEQUENCE[currentIndex + 1];
    setOnboardingProfile(saveOnboardingProfile({ ...onboardingProfile, completed: false }));
    if (nextStep) {
      setOnboardingStep(nextStep);
    }
  }

  function handleMainGoalToggle(goal: MainGoal) {
    updateOnboardingProfile((current) => ({
      ...current,
      mainGoals: toggleMultiSelect(current.mainGoals, goal),
    }));
  }

  function handleDietPreferenceToggle(preference: DietPreference) {
    updateOnboardingProfile((current) => ({
      ...current,
      dietPreferences: toggleMultiSelect(current.dietPreferences, preference, "no-preference"),
    }));
  }

  function handleFoodAvoidanceToggle(avoidance: FoodAvoidance) {
    updateOnboardingProfile((current) => ({
      ...current,
      foodsToAvoid: toggleMultiSelect(current.foodsToAvoid, avoidance, "none"),
    }));
  }

  function handleAccountNameChange(displayName: string) {
    updateOnboardingProfile((current) => ({
      ...current,
      displayName,
    }));
  }

  function handleAccountEmailChange(email: string) {
    updateOnboardingProfile((current) => ({
      ...current,
      email,
    }));
  }

  function updateOnboardingProfile(updater: (current: OnboardingProfile) => OnboardingProfile) {
    setOnboardingProfile((current) => saveOnboardingProfile({ ...updater(current), completed: false }));
  }

  function reviewProfileSetup() {
    setOnboardingProfile(saveOnboardingProfile({ ...onboardingProfile, completed: false }));
    setOnboardingStep("welcome");
    setProfileView("overview");
    clearHistoryDetail();
  }

  function handleAlternativeAccept(product: Product, alternative: AlternativeProduct) {
    const savedSwapItem = createSavedSwapHistoryItem({
      product,
      score: scoreProduct(product, settings),
      alternative,
      scanHistoryItem: history.find((item) => item.barcode === product.barcode),
    });

    setSavedSwapHistory(appendSavedSwapHistory(savedSwapItem));
    setAcceptedSwapIds((existing) => acceptSwap(existing, product.barcode, alternative));
  }

  async function handleHistoryItemSelect(item: ScanHistoryItem) {
    const requestId = historyDetailRequestRef.current + 1;
    historyDetailRequestRef.current = requestId;

    setSelectedHistoryItem(item);
    setSelectedHistoryProduct(null);
    setSelectedHistoryScore(null);
    setHistoryDetailError(null);
    setIsHistoryDetailLoading(true);

    try {
      const nextProduct = await fetchProductByBarcode(item.barcode);
      if (historyDetailRequestRef.current !== requestId) {
        return;
      }

      setSelectedHistoryProduct(nextProduct);
      setSelectedHistoryScore(scoreProduct(nextProduct, settings));
    } catch (detailError) {
      if (historyDetailRequestRef.current !== requestId) {
        return;
      }

      const message = detailError instanceof Error ? detailError.message : "Could not load full product details.";
      setHistoryDetailError(message);
    } finally {
      if (historyDetailRequestRef.current === requestId) {
        setIsHistoryDetailLoading(false);
      }
    }
  }

  function clearHistoryDetail() {
    historyDetailRequestRef.current += 1;
    setSelectedHistoryItem(null);
    setSelectedSavedSwap(null);
    setSelectedHistoryProduct(null);
    setSelectedHistoryScore(null);
    setHistoryDetailError(null);
    setIsHistoryDetailLoading(false);
  }

  if (onboardingStep !== "app") {
    return (
      <>
        <OnboardingFlow
          step={onboardingStep}
          profile={onboardingProfile}
          onBack={handleOnboardingBack}
          onContinue={handleOnboardingContinue}
          onSkipOptionalQuestion={handleOnboardingSkip}
          onAccountNameChange={handleAccountNameChange}
          onAccountEmailChange={handleAccountEmailChange}
          onMainGoalToggle={handleMainGoalToggle}
          onDietPreferenceToggle={handleDietPreferenceToggle}
          onFoodAvoidanceToggle={handleFoodAvoidanceToggle}
        />
      </>
    );
  }

  function renderHistoryContent(onBack?: () => void): ReactNode {
    return selectedHistoryItem ? (
      <HistoryFoodDetail
        item={selectedHistoryItem}
        product={selectedHistoryProduct}
        score={selectedHistoryScore}
        isLoading={isHistoryDetailLoading}
        error={historyDetailError}
        onBack={clearHistoryDetail}
      />
    ) : selectedSavedSwap ? (
      <SavedSwapHistoryDetail item={selectedSavedSwap} onBack={clearHistoryDetail} />
    ) : (
      <HistoryScreen
        history={history}
        savedSwapHistory={savedSwapHistory}
        filter={historyFilter}
        onFilterChange={handleHistoryFilterChange}
        onItemSelect={(item) => void handleHistoryItemSelect(item)}
        onSavedSwapSelect={setSelectedSavedSwap}
        onBack={onBack}
      />
    );
  }

  function renderTabContent(tab: AppTab): ReactNode {
    if (tab === "home" || tab === "scan") {
      const showDashboardContent = tab === "home" || !product || showScanEntry || foodScanResult || menuAnalysis;

      return (
        <>
          {showDashboardContent && (
            <DashboardScanScreen
              mode={tab === "scan" ? "scan" : "home"}
              barcode={barcode}
              error={error}
              isLoading={isLoading}
              showBarcodeEntry={showScanEntry || (!showBrowserScanner && !foodScanResult && !menuAnalysis && !product)}
              menuAnalysis={menuAnalysis}
              foodsToAvoid={onboardingProfile.foodsToAvoid}
              onScanFoodPress={() => startScanSession("food")}
              onScanMenuPress={() => startScanSession("menu")}
              foodScanResult={foodScanResult}
              onBarcodeChange={setBarcode}
              onSubmit={handleSubmit}
              onReviewSetup={reviewProfileSetup}
            />
          )}

          {tab === "scan" && product && qualityScore && (
            <div className="scan-results">
              <ProductResult product={product} score={qualityScore} alternatives={alternatives} showAlternatives={false} />
              <div className="mt-5">
                <SwapScreen
                  products={[product]}
                  settings={settings}
                  detail={swapDetail}
                  acceptedSwapIds={acceptedSwapIds}
                  savedSwapKeys={savedSwapKeys}
                  onDetailChange={setSwapDetail}
                  onAlternativeAccept={handleAlternativeAccept}
                />
              </div>
            </div>
          )}
        </>
      );
    }

    if (tab === "search") {
      return <SearchScreen />;
    }

    if (tab === "map") {
      return <MapScreen onScanMenu={(restaurant) => startScanSession("menu", restaurant)} />;
    }

    if (profileView === "history") {
      return renderHistoryContent(handleProfileHistoryBack);
    }

    return (
      <ProfileScreen
        profile={onboardingProfile}
        chart={activityChart}
        history={history}
        onHistoryOpen={handleProfileHistoryOpen}
        onProfileSave={(nextProfile) => {
          setOnboardingProfile(saveOnboardingProfile(nextProfile));
        }}
        onReviewSetup={reviewProfileSetup}
      />
    );
  }

  const isMapTab = activeTab === "map";

  return (
    <div className="app-shell">
      <header className="app-masthead">
        <button type="button" className="app-wordmark" aria-label="BetterBite home" onClick={() => handleTabChange("home")}>
          <img src="/apple-touch-icon.png" width="38" height="38" alt="" />
          BetterBite
        </button>
      </header>
      <nav className="app-nav" aria-label="Primary">
        <div className="app-nav-items">
          <NavButton
            testId="nav-home"
            active={activeTab === "home"}
            icon={<HeroHomeIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
            label="Home"
            onClick={() => handleTabChange("home")}
          />
          <NavButton
            testId="nav-search"
            active={activeTab === "search"}
            icon={<HeroMagnifyingGlassIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
            label="Search"
            onClick={() => handleTabChange("search")}
          />
          <NavButton
            testId="nav-scan"
            active={activeTab === "scan"}
            icon={<HeroCameraIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
            label="Scan"
            onClick={handleScanTabPress}
          />
          <NavButton
            testId="nav-map"
            active={activeTab === "map"}
            icon={<HeroMapPinIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
            label="Map"
            onClick={() => handleTabChange("map")}
          />
          <NavButton
            testId="nav-profile"
            active={activeTab === "profile"}
            icon={<HeroUserIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
            label="Profile"
            onClick={() => handleTabChange("profile")}
          />
        </div>
      </nav>

      <main className="app-content">
        <SwipeableTabViewport
          activeTab={activeTab}
          currentPanelRef={contentScrollRef}
          disabled={showBrowserScanner || isMapTab}
          onTabChange={handleTabChange}
          renderTab={renderTabContent}
        />
      </main>

      {showBrowserScanner && (
        <BrowserScannerPanel
          mode={scanCameraMode}
          stream={browserCameraStream}
          nativePreview={isNativeCameraPreview}
          status={browserCameraStatus}
          error={browserCameraError}
          onModeChange={handleCameraModeChange}
          onClose={closeCamera}
          onManualEntry={() => {
            dismissBrowserScanner();
            setActiveTab("scan");
            setShowScanEntry(true);
            setError(null);
          }}
          onFlipCamera={handleCameraFlip}
          onDetected={handleBrowserBarcodeDetected}
          onFoodDetected={handleBrowserFoodDetected}
          restaurantName={menuRestaurantName}
          onMenuAnalyze={handleMenuAnalyze}
          onRetry={() => void openCamera(scanCameraMode, cameraFacingMode)}
        />
      )}
    </div>
  );
}

type SwipeTransition = {
  direction: TabDirection;
  offsetX: number;
  settling: boolean;
  target: AppTab | null;
};

type SwipeGesture = {
  axis: "pending" | "horizontal";
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  tab: AppTab;
  velocityX: number;
  width: number;
};

const TAB_SWIPE_SETTLE_MS = 280;
const TAB_SWIPE_REDUCED_MOTION_MS = 120;
const TAB_SWIPE_SCALE_DELTA = 0.015;
const TAB_SWIPE_BOUNDARY_RESISTANCE = 0.28;
const TAB_SWIPE_IGNORE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[role='button']",
  "[role='dialog']",
  "[aria-modal='true']",
  "[data-swipe-ignore='true']",
].join(",");

function SwipeableTabViewport({
  activeTab,
  currentPanelRef,
  disabled,
  onTabChange,
  renderTab,
}: {
  activeTab: AppTab;
  currentPanelRef: RefObject<HTMLDivElement>;
  disabled: boolean;
  onTabChange: (tab: AppTab) => void;
  renderTab: (tab: AppTab) => ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<SwipeGesture | null>(null);
  const transitionRef = useRef<SwipeTransition | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [displayTab, setDisplayTab] = useState(activeTab);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [transition, setTransition] = useState<SwipeTransition | null>(null);
  const settleDuration = prefersReducedMotion ? TAB_SWIPE_REDUCED_MOTION_MS : TAB_SWIPE_SETTLE_MS;
  const width = viewportWidth || viewportRef.current?.getBoundingClientRect().width || 1;
  const progress = transition ? getSwipeProgress({ offsetX: transition.offsetX, width }) : 0;
  const currentScale = prefersReducedMotion ? 1 : 1 - TAB_SWIPE_SCALE_DELTA * progress;
  const incomingScale = prefersReducedMotion ? 1 : 1 - TAB_SWIPE_SCALE_DELTA + TAB_SWIPE_SCALE_DELTA * progress;
  const currentOpacity = transition?.target ? (prefersReducedMotion ? 1 - progress : 1 - 0.08 * progress) : 1;
  const incomingOpacity = prefersReducedMotion ? progress : 0.9 + 0.1 * progress;
  const transitionCss = transition?.settling
    ? prefersReducedMotion
      ? `opacity ${settleDuration}ms ease-out`
      : `transform ${settleDuration}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out`
    : "none";
  const renderedTab = displayTab;
  const isTransitioning = transition !== null;

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => setViewportWidth(node.getBoundingClientRect().width);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);

  useEffect(() => {
    return () => {
      clearSettleTimer();
      clearAnimationFrame();
    };
  }, []);

  useEffect(() => {
    if (activeTab === displayTab || transitionRef.current) {
      return;
    }

    gestureRef.current = null;
    const direction = getTabDirection(displayTab, activeTab);
    if (!direction) {
      setDisplayTab(activeTab);
      return;
    }

    clearSettleTimer();
    clearAnimationFrame();
    setSwipeTransition({ direction, offsetX: 0, settling: false, target: activeTab });
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      settleTransition({
        direction,
        target: activeTab,
        offsetX: -direction * width,
        notify: false,
      });
    });
  }, [activeTab, displayTab, isTransitioning, width]);

  function clearSettleTimer() {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }

  function clearAnimationFrame() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function setSwipeTransition(nextTransition: SwipeTransition | null) {
    transitionRef.current = nextTransition;
    setTransition(nextTransition);
  }

  function settleTransition({
    direction,
    target,
    offsetX,
    notify,
  }: {
    direction: TabDirection;
    target: AppTab;
    offsetX: number;
    notify: boolean;
  }) {
    clearSettleTimer();
    clearAnimationFrame();
    setSwipeTransition({ direction, offsetX, settling: true, target });
    settleTimerRef.current = window.setTimeout(() => {
      setDisplayTab(target);
      setSwipeTransition(null);
      if (notify) {
        onTabChange(target);
      }
    }, settleDuration);
  }

  function snapBackTransition(direction: TabDirection, target: AppTab | null) {
    clearSettleTimer();
    clearAnimationFrame();
    setSwipeTransition({ direction, offsetX: 0, settling: true, target });
    settleTimerRef.current = window.setTimeout(() => {
      setSwipeTransition(null);
    }, settleDuration);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || transitionRef.current || !event.isPrimary || event.button !== 0 || shouldIgnoreSwipeStart(event.target)) {
      return;
    }

    const nodeWidth = viewportRef.current?.getBoundingClientRect().width ?? 0;
    if (nodeWidth <= 0) {
      return;
    }

    gestureRef.current = {
      axis: "pending",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      tab: renderedTab,
      velocityX: 0,
      width: nodeWidth,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (gesture.axis === "pending") {
      if (!shouldStartHorizontalSwipe({ deltaX, deltaY })) {
        if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
          gestureRef.current = null;
        }
        return;
      }

      gesture.axis = "horizontal";
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();

    const direction: TabDirection = deltaX < 0 ? 1 : -1;
    const target = getAdjacentTab(gesture.tab, direction);
    const constrainedOffset = target ? clamp(deltaX, -gesture.width, gesture.width) : deltaX * TAB_SWIPE_BOUNDARY_RESISTANCE;
    const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
    gesture.velocityX = ((event.clientX - gesture.lastX) / elapsed) * 1000;
    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;

    setSwipeTransition({
      direction,
      offsetX: constrainedOffset,
      settling: false,
      target,
    });
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    gestureRef.current = null;

    const activeTransition = transitionRef.current;
    if (!activeTransition || gesture.axis !== "horizontal") {
      return;
    }

    const resolution = resolveSwipeTarget({
      tab: gesture.tab,
      offsetX: activeTransition.offsetX,
      velocityX: gesture.velocityX,
      width: gesture.width,
    });

    if (resolution.shouldCommit && resolution.target) {
      settleTransition({
        direction: resolution.direction,
        target: resolution.target,
        offsetX: -resolution.direction * gesture.width,
        notify: true,
      });
      return;
    }

    snapBackTransition(activeTransition.direction, activeTransition.target);
  }

  const currentTransform = prefersReducedMotion
    ? "none"
    : `translate3d(${transition?.offsetX ?? 0}px, 0, 0) scale(${currentScale})`;
  const incomingTransform =
    transition && transition.target
      ? prefersReducedMotion
        ? "none"
        : `translate3d(${transition.offsetX + transition.direction * width}px, 0, 0) scale(${incomingScale})`
      : undefined;

  return (
    <div
      ref={viewportRef}
      data-testid="swipe-tab-viewport"
      className="relative h-full min-h-0 overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerCancel={(event) => {
        const gesture = gestureRef.current;
        if (gesture?.pointerId !== event.pointerId) return;
        gestureRef.current = null;
        const current = transitionRef.current;
        if (current) snapBackTransition(current.direction, current.target);
      }}
      onPointerUp={handlePointerEnd}
    >
      <motion.div
        ref={currentPanelRef}
        key={renderedTab}
        data-swipe-panel="current"
        data-tab={renderedTab}
        aria-hidden={renderedTab !== activeTab}
        {...(renderedTab !== activeTab ? { inert: "" } : {})}
        className={getSwipePanelClassName(renderedTab)}
        style={{
          opacity: currentOpacity,
          transform: currentTransform,
          transition: transitionCss,
        }}
      >
        {renderTab(renderedTab)}
      </motion.div>

      {transition?.target && (
        <motion.div
          key={transition.target}
          aria-hidden={transition.target !== activeTab}
          {...(transition.target !== activeTab ? { inert: "" } : {})}
          data-swipe-panel="incoming"
          data-tab={transition.target}
          className={`absolute inset-x-0 top-0 ${getSwipePanelClassName(transition.target)}`}
          style={{
            opacity: incomingOpacity,
            pointerEvents: "none",
            transform: incomingTransform,
            transition: transitionCss,
          }}
        >
          {renderTab(transition.target)}
        </motion.div>
      )}
    </div>
  );
}

function getSwipePanelClassName(tab: AppTab): string {
  const baseClassName = "h-full min-h-0 origin-center will-change-transform";
  return tab === "map"
    ? `${baseClassName} overflow-hidden bg-[#DDE8E9]`
    : `${baseClassName} app-scroll-area app-page`;
}

function shouldIgnoreSwipeStart(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest(TAB_SWIPE_IGNORE_SELECTOR));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function DashboardScanScreen({
  mode,
  barcode,
  error,
  isLoading,
  showBarcodeEntry,
  foodScanResult,
  onBarcodeChange,
  onSubmit,
  onReviewSetup,
  menuAnalysis,
  foodsToAvoid,
  onScanFoodPress,
  onScanMenuPress,
}: {
  mode: "home" | "scan";
  barcode: string;
  error: string | null;
  isLoading: boolean;
  showBarcodeEntry: boolean;
  foodScanResult: FoodRecognitionResult | null;
  onBarcodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReviewSetup: () => void;
  menuAnalysis: MenuAnalysis | null;
  foodsToAvoid: FoodAvoidance[];
  onScanFoodPress: () => void;
  onScanMenuPress: () => void;
}) {
  const isScanMode = mode === "scan";
  const [selectedRecommendedFood, setSelectedRecommendedFood] = useState<RecommendedFood | null>(null);
  const [showAllFoods, setShowAllFoods] = useState(false);

  const modalRoot = typeof document === "undefined" ? null : document.body;

  function handleRecommendedFoodSelect(food: RecommendedFood) {
    setSelectedRecommendedFood(food);
  }

  function handleRecommendedFoodClose() {
    setSelectedRecommendedFood(null);
  }

  return (
    <div className={isScanMode ? "py-2" : "food-dashboard"}>
      {!isScanMode && (
        <section aria-label="Recommended for You">
          <div className="food-dashboard__heading">
            <h2>Recommended for You</h2>
            <button className="food-dashboard__view" type="button" aria-expanded={showAllFoods} onClick={() => setShowAllFoods(!showAllFoods)}>
              {showAllFoods ? "Show less" : "View all"}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="food-catalog" data-expanded={showAllFoods} data-swipe-ignore="true">
            {RECOMMENDED_FOODS.map((item) => (
              <RecommendedFoodCard key={item.name} item={item} onSelect={handleRecommendedFoodSelect} />
            ))}
          </div>
        </section>
      )}

      {isScanMode && showBarcodeEntry && (
        <DashboardLookupPanel
          barcode={barcode}
          error={error}
          isLoading={isLoading}
          onBarcodeChange={onBarcodeChange}
          onSubmit={onSubmit}
        />
      )}

      {isScanMode && menuAnalysis && <MenuResults analysis={menuAnalysis} foodsToAvoid={foodsToAvoid} onRescan={onScanMenuPress} />}
      {isScanMode && foodScanResult && <FoodScanResultCard result={foodScanResult} />}

      {!isScanMode && (
        <section className="food-dashboard__recipe">
          <HomeActionButton imageSrc={menuPhoto} label="Scan Menu" icon={<Camera size={19} />} onClick={onScanMenuPress} />
          <HomeActionButton imageSrc={foodPhoto} label="Scan Food" icon={<Apple size={19} />} onClick={onScanFoodPress} />
          <HomeActionButton imageSrc={recipeBuilderPhoto} label="Recipe Builder" icon={<FileText size={19} strokeWidth={2.5} />} />
        </section>
      )}

      {modalRoot &&
        selectedRecommendedFood &&
        createPortal(
          <RecommendedFoodDetailSheet
            item={selectedRecommendedFood}
            onClose={handleRecommendedFoodClose}
          />,
          modalRoot,
        )}

      {!isScanMode && (
        <section className="food-dashboard__tools">
          <button
            type="button"
            className="food-dashboard__reset"
            onClick={onReviewSetup}
          >
            <RefreshCw size={14} strokeWidth={2.6} />
            Review setup
          </button>
        </section>
      )}
    </div>
  );
}

function BrowserScannerPanel({
  mode,
  stream,
  status,
  error,
  onModeChange,
  onClose,
  onDetected,
  onFoodDetected,
  onMenuAnalyze,
  restaurantName,
  nativePreview,
  onManualEntry,
  onFlipCamera,
  onRetry,
}: {
  mode: ScanCameraMode;
  stream: MediaStream | null;
  status: string;
  error: string | null;
  onModeChange: (mode: ScanCameraMode) => void;
  onClose: () => void;
  onDetected: (value: string) => void;
  onFoodDetected: (result: FoodRecognitionResult) => void;
  onMenuAnalyze: (pages: MenuPageUpload[], signal: AbortSignal) => Promise<void>;
  restaurantName?: string;
  nativePreview: boolean;
  onManualEntry: () => void;
  onFlipCamera: () => void;
  onRetry: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const shutterOverlayRef = useRef<HTMLDivElement>(null);
  const scanTimerRef = useRef(0);
  const scanNowRef = useRef<(() => void) | null>(null);
  const [barcodeHelp, setBarcodeHelp] = useState(false);
  useEffect(() => {
    setBarcodeHelp(false);
    if (mode !== "barcode" || error || (!stream && !nativePreview)) return;
    const timer = window.setTimeout(() => setBarcodeHelp(true), 5_000);
    return () => window.clearTimeout(timer);
  }, [mode, error, stream, nativePreview]);
  const [shareFrames, setShareFrames] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const onFoodDetectedRef = useRef(onFoodDetected);
  const lastFoodDetectionKeyRef = useRef<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [foodRecognitionStatus, setFoodRecognitionStatus] = useState("Point the camera at a food.");

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onFoodDetectedRef.current = onFoodDetected;
  }, [onFoodDetected]);

  const stopDetection = useCallback(() => {
    window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = 0;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;

    void video.play().catch((playError: unknown) => {
      if (video.srcObject !== stream) return;
      setLocalError(getBrowserCameraErrorMessage(playError));
      stopDetection();
    });

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stopDetection, stream]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) setShareFrames(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    stopDetection();
    setLocalError(null);
    lastFoodDetectionKeyRef.current = null;
    const isBarcodeMode = mode === "barcode";
    const video = videoRef.current;
    setFoodRecognitionStatus(stream ? "Point the camera at a food." : "Starting camera preview…");
    if (!stream || !video || mode === "menu" || (mode === "food" && !shareFrames)) return;
    const detector = isBarcodeMode ? createBrowserBarcodeDetector() : null;

    let scanning = false;
    const scheduleNextScan = (delay: number) => {
      if (requestIdRef.current === requestId) {
        scanTimerRef.current = window.setTimeout(scanLoop, delay);
      }
    };

    const scanLoop = async () => {
      if (requestIdRef.current !== requestId || scanning) return;
      stopDetection();

      if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        scheduleNextScan(180);
        return;
      }

      scanning = true;
      try {
        if (isBarcodeMode) {
          if (!detector) {
            return;
          }

          const detections = await detector.detect(videoRef.current);
          if (requestIdRef.current !== requestId) return;
          const match = detections.find((item) => item.rawValue?.trim());

          if (match?.rawValue) {
            requestIdRef.current += 1;
            stopDetection();
            onDetectedRef.current(match.rawValue.trim());
            return;
          }
        } else {
          setFoodRecognitionStatus("Checking this frame for food...");
          const frame = captureVideoFrameAsDataUrl(videoRef.current);
          const foodResult = await recognizeFoodInImage(frame, controller.signal);

          if (requestIdRef.current !== requestId) {
            return;
          }

          if (foodResult) {
            const resultKey = `${foodResult.label}:${Math.round(foodResult.score * 1000)}`;
            setFoodRecognitionStatus(`Found ${foodResult.label}.`);
            if (lastFoodDetectionKeyRef.current !== resultKey) {
              lastFoodDetectionKeyRef.current = resultKey;
              onFoodDetectedRef.current(foodResult);
            }
          } else {
            lastFoodDetectionKeyRef.current = null;
            setFoodRecognitionStatus(`No confident food match yet. Need ${Math.round(FOOD_RECOGNITION_MIN_SCORE * 100)}% confidence.`);
          }
        }
      } catch (detectError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        if (!isBarcodeMode) {
          lastFoodDetectionKeyRef.current = null;
          setRecognitionError(getFoodRecognitionErrorMessage(detectError));
          setShareFrames(false);
          return;
        } else {
          setLocalError(getBrowserCameraErrorMessage(detectError));
          stopDetection();
          return;
        }
      } finally {
        scanning = false;
      }

      scheduleNextScan(isBarcodeMode ? 180 : 1400);
    };

    scanNowRef.current = scanLoop;
    scheduleNextScan(isBarcodeMode ? 180 : 700);

    return () => {
      requestIdRef.current += 1;
      scanNowRef.current = null;
      controller.abort();
      stopDetection();
    };
  }, [mode, shareFrames, stopDetection, stream]);

  function switchMode(next: ScanCameraMode) {
    if (next === mode) return;
    setShareFrames(false);
    setRecognitionError(null);
    onModeChange(next);
  }

  const displayError = error ?? localError;
  const isBarcodeMode = mode === "barcode";
  const isMenuMode = mode === "menu";
  const panelTitle = isBarcodeMode ? "Scan a barcode" : isMenuMode ? `Scan ${restaurantName ? `${restaurantName} ` : "a "}menu` : "Scan food";
  const panelStatus = isBarcodeMode ? status : recognitionError ?? (shareFrames || !stream
    ? foodRecognitionStatus
    : "Food recognition sends camera frames to Hugging Face while it is on.");

  return (
    <dialog ref={dialogRef} className={`camera-screen fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 text-white ${nativePreview ? "bg-transparent" : "bg-[#101b18]"}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }} aria-label={panelTitle}>
      <header className="camera-toolbar">
        <h1 className="camera-title">{panelTitle}</h1>
        <div className="flex flex-wrap justify-center gap-1" aria-label="Scan mode" role="group">
          <ScanModeButton active={isBarcodeMode} label="Barcode" onClick={() => switchMode("barcode")} />
          <ScanModeButton active={mode === "food"} label="Food" onClick={() => switchMode("food")} />
          <ScanModeButton active={isMenuMode} label="Menu" onClick={() => switchMode("menu")} />
        </div>
        <button type="button" aria-label="Switch camera" className="grid h-11 w-11 place-items-center rounded-full border border-white/35" onClick={onFlipCamera}>
          <SwitchCamera size={22} />
        </button>
      </header>
      <div className={`camera-viewfinder flex flex-col ${nativePreview ? "bg-transparent shadow-[0_0_0_9999px_#101b18]" : "bg-[#101010]"}`} data-testid="custom-camera-preview">
        {!nativePreview && <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" autoPlay muted playsInline />}
        {!nativePreview && !stream && !displayError && <Loader2 aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -ml-3 -mt-3 motion-safe:animate-spin" />}
        {isBarcodeMode && <div aria-hidden="true" ref={shutterOverlayRef} className="pointer-events-none absolute inset-0 z-30 bg-white opacity-0 motion-reduce:hidden" />}
        {isMenuMode ? (
          <>
            <button type="button" aria-label="Close camera" className="relative z-10 m-2 h-11 w-11 shrink-0 rounded-full bg-black/70" onClick={onClose}><ChevronLeft className="mx-auto" /></button>
            <MenuCaptureControls videoRef={videoRef} cameraReady={Boolean(stream) && !displayError} cameraError={displayError} onRetry={onRetry} onAnalyze={onMenuAnalyze} />
          </>
        ) : (
          <>
            {!displayError && <div className="absolute inset-x-3 top-3 z-10 text-center">
              <p className="mx-auto max-w-sm rounded-xl bg-black/75 px-3 py-2 text-sm" role="status">{panelStatus}</p>
              {isBarcodeMode && barcodeHelp && <button type="button" className="mt-2 min-h-10 rounded-full bg-white px-4 font-semibold text-black" onClick={() => switchMode("food")}>Scan food instead</button>}
            </div>}
            {isBarcodeMode && !displayError && <div className="pointer-events-none absolute left-1/2 top-1/2 h-[24%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/65" aria-hidden="true" />}
            {displayError && <div className="camera-error" role="alert">
              <p>{displayError}</p>
              <button type="button" className="min-h-11 px-2 underline" onClick={onRetry}>Try camera again</button>
              <button type="button" className="min-h-11 px-2 underline" onClick={onManualEntry}>Enter barcode</button>
            </div>}
            <div className="camera-actions">
              <button type="button" aria-label="Close camera" className="grid h-11 w-11 place-items-center rounded-full border border-white/35 bg-black/70" onClick={onClose}><ChevronLeft /></button>
              {isBarcodeMode ? (
                <button type="button" aria-label="Scan barcode now" className="mx-auto h-16 w-16 rounded-full border-4 border-gray-400 bg-white active:scale-95" onClick={() => {
                  shutterOverlayRef.current?.animate?.([{ opacity: 0.45 }, { opacity: 0 }], 120);
                  if (displayError) onRetry();
                  else if (nativePreview) setBarcodeHelp(true);
                  else scanNowRef.current?.();
                }} />
              ) : (
                <button type="button" className="mx-auto min-h-12 rounded-full bg-white px-4 py-2 text-sm font-bold text-black" disabled={!stream || !!displayError} onClick={() => { setRecognitionError(null); setShareFrames(!shareFrames); }}>
                  {shareFrames ? "Stop food recognition" : "Start food recognition"}
                </button>
              )}
              {isBarcodeMode && <button type="button" aria-label="Enter barcode manually" className="grid h-11 w-11 place-items-center rounded-full bg-black/70" onClick={onManualEntry}><Barcode size={22} /></button>}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

function ScanModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`h-10 rounded-full px-4 text-[12px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active ? "bg-white text-[#063F41] shadow-[0_8px_20px_rgba(0,0,0,0.24)]" : "text-white/74 hover:bg-white/10 hover:text-white"
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function FoodScanResultCard({ result }: { result: FoodRecognitionResult }) {
  return (
    <section className="mx-auto max-w-2xl pt-5">
      <div className="bento-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oat text-leaf">
            <CheckCircle2 size={22} strokeWidth={2.7} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#00696B]">Food recognized</p>
            <h3 className="mt-1 record-subtitle capitalize">{result.label}</h3>
            <p className="mt-1 text-[13px] font-semibold leading-5 text-[#566164]">
              Matched with {Math.round(result.score * 100)}% confidence using {result.model}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RecommendedFoodPhoto({ item }: { item: RecommendedFood }) {
  return (
    <div className="food-packshot" data-scene={item.imageSrc === olipopColaPhoto || item.imageSrc === lesserEvilPopcornPhoto}>
      <img src={item.imageSrc} alt="" />
      <span className="food-packshot__score"><span className="sr-only">BetterBite score </span>{item.score}</span>
    </div>
  );
}

function RecommendedFoodCard({ item, onSelect }: { item: RecommendedFood; onSelect: (item: RecommendedFood) => void }) {
  return (
    <button type="button" className="food-catalog__card" onClick={() => onSelect(item)}>
      <RecommendedFoodPhoto item={item} />
      <div className="food-catalog__caption">
        <p>{item.detail}</p>
        <h3>{item.name}</h3>
      </div>
    </button>
  );
}

function RecommendedFoodDetailSheet({
  item,
  onClose,
}: {
  item: RecommendedFood;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showStores, setShowStores] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="food-detail" aria-labelledby="recommendation-title" onClose={onClose}>
      <header className="food-detail__heading">
        <div>
          <p className="food-detail__label">Recommended pick</p>
          <h2 id="recommendation-title">{item.name}</h2>
        </div>
        <button type="button" className="food-detail__close" aria-label="Close recommendation details" onClick={() => dialogRef.current?.close()}>
          <CircleX size={22} />
        </button>
      </header>
      <div className="food-detail__body">
        <div className="food-detail__product">
          <RecommendedFoodPhoto item={item} />
          <div className="flex items-start justify-between gap-2 border-t border-[#dce2d9] p-4">
            <div>
              <p className="text-sm font-semibold">{item.detail}</p>
              <p className="mt-1 text-xs text-[#52645e]">{item.serving}</p>
            </div>
            <span className="text-sm font-bold text-[#075a53]">Est. {item.price}</span>
          </div>
        </div>
        <section>
          <h3 className="food-detail__label">Nutrition</h3>
          <dl className="food-detail__nutrition">
            <NutritionStat label="Calories" value={String(item.calories)} />
            <NutritionStat label="Protein" value={item.macros.protein} />
            <NutritionStat label="Carbs" value={item.macros.carbs} />
            <NutritionStat label="Fat" value={item.macros.fat} />
            <NutritionStat label="Fiber" value={item.macros.fiber} />
            <NutritionStat label="Sugar" value={item.macros.sugar} />
          </dl>
        </section>
        <section>
          <h3 className="food-detail__label">Ingredients</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {item.ingredients.map((ingredient) => (
              <li key={ingredient} className="rounded-full bg-[#e9eee4] px-3 py-1.5 text-xs font-medium">{ingredient}</li>
            ))}
          </ul>
        </section>
        <section className="food-detail__stores">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 shrink-0 text-[#075a53]" size={20} />
            <div>
              <h3 className="text-lg font-semibold">Nearby stores</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#52645e]">Sample stores, distances and stock for this product.</p>
            </div>
          </div>
          <button className="food-detail__location" type="button" aria-expanded={showStores} onClick={() => setShowStores(!showStores)}>
            <Navigation size={17} />{showStores ? "Hide sample stores" : "Show sample stores"}
          </button>
          {showStores && (
            <ul className="mt-4 divide-y divide-[#dce2d9]">
              {item.stores.map((store) => (
                <li key={store.name} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{store.name}</p>
                    <p className="mt-1 text-xs text-[#52645e]">{store.distance} · {store.aisle}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#e9eee4] px-2.5 py-1 text-xs font-semibold text-[#075a53]">{store.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}

function NutritionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-1 py-2">
      <dt className="text-xs text-[#52645e]">{label}</dt>
      <dd className="text-lg font-semibold text-[#172f29]">{value}</dd>
    </div>
  );
}

function HomeActionButton({ imageSrc, label, icon, onClick }: { imageSrc: string; label: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="food-recipe" disabled={!onClick} onClick={onClick}>
      <span className="food-recipe__caption">
        <span className="food-recipe__icon">{icon}</span>
        <span>{label}</span>
      </span>
      <img className="food-recipe__image" src={imageSrc} alt="" />
    </button>
  );
}

function DashboardLookupPanel({
  barcode,
  error,
  isLoading,
  onBarcodeChange,
  onSubmit,
}: {
  barcode: string;
  error: string | null;
  isLoading: boolean;
  onBarcodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="bento-card mx-auto mt-6 max-w-2xl p-5" onSubmit={onSubmit}>
      {error && <p className="mb-2 text-[15px] font-black leading-5 text-[#063F41]">Barcode not found</p>}
      <label className="text-[11px] font-black uppercase leading-4 tracking-[0.18em] text-[#00696B]" htmlFor="dashboard-barcode">
        UPC or EAN
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="dashboard-barcode"
          inputMode="numeric"
          className="min-w-0 flex-1 rounded-[14px] border border-[#D9E4E5] bg-cream px-4 py-3 text-base font-bold text-[#1F2629] outline-none transition placeholder:text-[#667080] focus:border-[#00C5C8] focus:ring-2 focus:ring-[#00C5C8]/20"
          placeholder="5449000000996"
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
        />
        <button
          type="submit"
          className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-leaf text-white shadow-[0_12px_24px_rgba(0,128,128,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 disabled:opacity-60"
          disabled={isLoading}
          aria-label="Search barcode"
        >
          {isLoading ? <Loader2 className="animate-spin" size={21} /> : <Search size={21} />}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-[#fff0eb] px-3 py-2 text-sm font-medium text-[#823920]">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}

function DashboardStatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "blue" | "green" }) {
  const iconColor = tone === "blue" ? "bg-[#e5eef0] text-[#315c64]" : "bg-oat text-leaf";

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className={`mb-4 grid h-10 w-10 place-items-center rounded-full ${iconColor}`}>{icon}</div>
      <p className="text-xs font-medium leading-5 text-muted">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold leading-6 tracking-tight text-ink">{value}</p>
    </div>
  );
}

function formatLastScanSummary(history: ScanHistoryItem[]): string {
  const latest = history[0];
  if (!latest) {
    return "No scans yet";
  }

  const timestamp = new Date(latest.scannedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? "Just now" : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function HistoryScreen({
  history,
  savedSwapHistory,
  filter,
  onFilterChange,
  onItemSelect,
  onSavedSwapSelect,
  onBack,
}: {
  history: ScanHistoryItem[];
  savedSwapHistory: SavedSwapHistoryItem[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onItemSelect: (item: ScanHistoryItem) => void;
  onSavedSwapSelect: (item: SavedSwapHistoryItem) => void;
  onBack?: () => void;
}) {
  const filteredHistory = filterHistoryItems(history, filter);
  const savedSwapGroups = groupSavedSwapHistory(savedSwapHistory);
  const isSwapFilter = filter === "swaps";

  return (
    <div className="record-page">
      <div className="pb-2">
        {onBack && (
          <button
            type="button"
            className="record-back"
            aria-label="Back to profile"
            onClick={onBack}
          >
            <ChevronLeft size={17} strokeWidth={2.6} />
            Profile
          </button>
        )}
        <h2 className="record-title">My Scans</h2>
        <p className="mt-2 text-base leading-6 text-muted">Review your nutritional history</p>
      </div>

      <div className="sticky top-0 z-10 border-b border-line bg-cream py-2">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-1">
            <HistoryFilterButton active={filter === "all"} label="All" onClick={() => onFilterChange("all")} />
            <HistoryFilterButton active={filter === "saved"} label="Saved" onClick={() => onFilterChange("saved")} />
            <HistoryFilterButton active={filter === "this-week"} label="This Week" onClick={() => onFilterChange("this-week")} />
            <HistoryFilterButton active={filter === "swaps"} label="Swaps" onClick={() => onFilterChange("swaps")} />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {isSwapFilter ? (
          savedSwapGroups.length > 0 ? (
            <HistorySwapsList groups={savedSwapGroups} onSavedSwapSelect={onSavedSwapSelect} />
          ) : (
            <HistoryEmptyState
              icon={<Sparkles size={34} />}
              title="No saved swaps yet"
              copy="Scan a food and tap Save Swap to build your saved swap history here."
            />
          )
        ) : filteredHistory.length > 0 ? (
          filteredHistory.map((item) => <HistoryScanCard key={`${item.barcode}-${item.scannedAt}`} item={item} onSelect={() => onItemSelect(item)} />)
        ) : (
          <HistoryEmptyState
            icon={<History size={34} />}
            title="No scans yet"
            copy="Start by scanning a food product to see your history and insights here."
          />
        )}
      </div>
    </div>
  );
}

function HistoryEmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="bento-card flex flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-oat text-leaf">{icon}</div>
      <h3 className="mt-5 record-subtitle">{title}</h3>
      <p className="mt-2 max-w-[280px] text-sm leading-6 text-muted">{copy}</p>
    </div>
  );
}

function HistorySwapsList({
  groups,
  onSavedSwapSelect,
}: {
  groups: SavedSwapHistoryGroup[];
  onSavedSwapSelect: (item: SavedSwapHistoryItem) => void;
}) {
  return (
    <div className="record-list">
      {groups.map((group) => (
        <section key={group.barcode} className="bento-card overflow-hidden">
          <div className="flex items-center gap-3 bg-oat p-3">
            <HistoryThumb imageUrl={group.scannedProduct.imageUrl} name={group.scannedProduct.name} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00696B]">Scanned item</p>
              <h3 className="mt-1 truncate text-[17px] font-semibold leading-6 text-[#191C1D]">{group.scannedProduct.name}</h3>
              <p className="truncate text-[13px] font-semibold leading-5 text-[#3B4949]">
                {group.scannedProduct.brand ? `${group.scannedProduct.brand} - ` : ""}
                {formatCompactHistoryDateTime(group.scannedProduct.scannedAt)}
              </p>
            </div>
            <HistoryScoreRing score={group.scannedProduct.score} />
          </div>

          <div className="grid gap-3 p-3">
            {group.swaps.map((item) => (
              <SavedSwapHistoryRow key={item.id} item={item} onSelect={() => onSavedSwapSelect(item)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SavedSwapHistoryRow({ item, onSelect }: { item: SavedSwapHistoryItem; onSelect: () => void }) {
  const photo = alternativeImageFor(item.swap);
  const swapName = item.swap.brand ? `${item.swap.brand} ${item.swap.name}` : item.swap.name;
  const meta = item.swap.brand ? `${item.swap.brand} - ${item.swap.category}` : item.swap.category;

  return (
    <button
      type="button"
      className="grid w-full grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-[10px] border border-[#DDE8E9] bg-white p-3 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      aria-label={`View saved swap ${swapName}`}
    >
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] bg-oat text-leaf">
        {photo ? <img className="h-full w-full rounded-[10px] object-contain" src={photo} alt="" /> : <Apple size={24} strokeWidth={1.9} />}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-leaf">{meta}</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#DDE8E9] bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink">
            <DollarSign size={11} />
            Est. {item.swap.estimatedPrice}
          </span>
        </div>
        <h4 className="mt-1 line-clamp-2 text-[16px] font-semibold leading-5 text-ink">{swapName}</h4>
        <p className="mt-1 text-xs font-medium leading-4 text-muted">{item.swap.scoreHint}</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-muted">{item.swap.reason}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-leaf">Saved {formatCompactHistoryDateTime(item.savedAt)}</p>
      </div>
    </button>
  );
}

function ProfileScreen({
  profile,
  chart,
  history,
  onHistoryOpen,
  onProfileSave,
  onReviewSetup,
}: {
  profile: OnboardingProfile;
  chart: ActivityChart;
  history: ScanHistoryItem[];
  onHistoryOpen: () => void;
  onProfileSave: (profile: OnboardingProfile) => void;
  onReviewSetup: () => void;
}) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [draftProfile, setDraftProfile] = useState<OnboardingProfile>(profile);
  const streakLabel = chart.currentStreak === 1 ? "1 Day" : `${chart.currentStreak} Days`;
  const profileDisplayName = profile.displayName || "Add your name";
  const profileEmail = profile.email || "Add your email";
  const settingsItems = [
    { label: "Notifications", icon: <Bell size={21} strokeWidth={1.9} />, danger: false },
    { label: "Privacy Policy", icon: <Shield size={21} strokeWidth={1.9} />, danger: false },
    { label: "Terms of Service", icon: <FileText size={21} strokeWidth={1.9} />, danger: false },
    { label: "Data & Storage", icon: <Database size={21} strokeWidth={1.9} />, danger: false },
  ];

  useEffect(() => {
    document.querySelector<HTMLElement>(".app-scroll-area")?.scrollTo({ top: 0 });
  }, [isEditingProfile]);

  function deleteProfile() {
    if (!window.confirm("Delete your profile, scan history, saved swaps, favorite places and settings from this device?")) return;
    try {
      deleteLocalProfileData();
      window.location.reload();
    } catch {
      setDeleteError("Some profile data could not be removed. Allow access to device storage and try again.");
    }
  }

  function openEditProfile() {
    setDraftProfile(profile);
    setIsEditingProfile(true);
  }

  function closeEditProfile() {
    setDraftProfile(profile);
    setIsEditingProfile(false);
  }

  function requestCloseEditProfile() {
    const hasChanges = JSON.stringify(draftProfile) !== JSON.stringify(profile);
    if (!hasChanges || window.confirm("Discard unsaved changes?")) {
      closeEditProfile();
    }
  }

  function saveProfileDraft() {
    const nextProfile = {
      ...draftProfile,
      displayName: draftProfile.displayName.trim(),
      email: draftProfile.email.trim().toLowerCase(),
      completed: profile.completed,
    };

    onProfileSave(nextProfile);
    setIsEditingProfile(false);
  }

  function updateDraftProfile(updater: (current: OnboardingProfile) => OnboardingProfile) {
    setDraftProfile((current) => updater(current));
  }

  const sectionTitle = "mb-3 font-serif text-2xl font-normal leading-tight tracking-[-0.03em] text-ink";
  const rowGroup = "overflow-hidden rounded-2xl border border-line bg-white";

  return (
    <AnimatePresence initial={false} mode="wait">
      {isEditingProfile ? (
        <EditProfileSheet
          key="edit-profile-sheet"
          draftProfile={draftProfile}
          onDraftChange={updateDraftProfile}
          onClose={requestCloseEditProfile}
          onSave={saveProfileDraft}
        />
      ) : (
        <motion.div
          key="profile-overview"
          className="pb-8 pt-3 text-ink"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <section className="flex flex-wrap items-center gap-x-5 gap-y-4 border-b border-line pb-6 sm:flex-nowrap md:gap-x-6 md:pb-8">
            <div className="relative shrink-0">
              <img
                className="h-20 w-20 rounded-full border border-line bg-white object-cover md:h-24 md:w-24"
                src={profilePhoto}
                alt={profileDisplayName}
              />
              <button
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-[3px] border-cream bg-leaf text-white transition hover:bg-[#103e34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf"
                type="button"
                aria-label="Edit profile"
                onClick={openEditProfile}
              >
                <Pencil size={14} strokeWidth={2.3} />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="break-words font-serif text-[clamp(1.9rem,4.5vw,3.3rem)] font-normal leading-[1.05] tracking-[-0.04em]">{profileDisplayName}</h2>
              <p className="mt-2 break-words text-sm leading-5 text-muted">{profileEmail}</p>
            </div>
            <button
              className="min-h-11 shrink-0 rounded-full border border-leaf bg-white px-5 text-sm font-semibold text-leaf transition hover:bg-oat focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf max-sm:basis-full"
              type="button"
              onClick={openEditProfile}
            >
              Edit Profile
            </button>
          </section>

          <div className="grid gap-7 pt-6 md:grid-cols-2 md:gap-x-9 md:gap-y-8 md:pt-8">
            <section className="min-w-0">
              <h3 className={sectionTitle}>Activity</h3>
              <ActivityCard chart={chart} />
              <div className="grid grid-cols-2 gap-3">
                <DashboardStatCard icon={<Clock size={21} />} label="Last Scan" value={formatLastScanSummary(history)} tone="green" />
                <DashboardStatCard icon={<Leaf size={21} />} label="Health Streak" value={streakLabel} tone="green" />
              </div>
              <div className={`mt-3 ${rowGroup}`}>
                <ProfileSettingsRow label="Food Scan History" icon={<History size={21} strokeWidth={1.9} />} onClick={onHistoryOpen} />
              </div>
            </section>

            <section className="min-w-0">
              <h3 className={sectionTitle}>Account Settings</h3>
              <div className={rowGroup}>
                {settingsItems.map((item) => (
                  <ProfileSettingsRow key={item.label} label={item.label} icon={item.icon} />
                ))}
              </div>
            </section>

            <section className="min-w-0">
              <h3 className={sectionTitle}>Support</h3>
              <a
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left transition hover:bg-oat focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf"
                href="mailto:support@betterbite.app?subject=BetterBite%20Support%20Request"
                aria-label="Email tech support"
              >
                <Mail className="shrink-0 text-leaf" size={20} strokeWidth={1.9} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium leading-5">Email tech support</span>
                  <span className="mt-0.5 block break-words text-xs leading-4 text-muted">support@betterbite.app</span>
                </span>
                <ChevronRight className="shrink-0 text-muted" size={17} />
              </a>
            </section>

            <section className="min-w-0">
              <h3 className={sectionTitle}>Other</h3>
              <div className={rowGroup}>
                <ProfileSettingsRow label="Review setup" icon={<RefreshCw size={21} strokeWidth={1.9} />} onClick={onReviewSetup} />
                <ProfileSettingsRow label="Delete local profile" icon={<Trash2 size={21} strokeWidth={1.9} />} danger onClick={deleteProfile} />
                {deleteError && <p role="alert" className="px-4 pb-3 text-sm text-[#a33c32]">{deleteError}</p>}
              </div>
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EditProfileSheet({
  draftProfile,
  onDraftChange,
  onClose,
  onSave,
}: {
  draftProfile: OnboardingProfile;
  onDraftChange: (updater: (current: OnboardingProfile) => OnboardingProfile) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const nameError = getProfileNameError(draftProfile.displayName);
  const emailError = getProfileEmailError(draftProfile.email);
  const canSave = !nameError && !emailError;

  function handleMainGoalToggle(goal: MainGoal) {
    onDraftChange((current) => ({
      ...current,
      mainGoals: toggleMultiSelect(current.mainGoals, goal),
    }));
  }

  function handleDietPreferenceToggle(preference: DietPreference) {
    onDraftChange((current) => ({
      ...current,
      dietPreferences: toggleMultiSelect(current.dietPreferences, preference, "no-preference"),
    }));
  }

  function handleFoodAvoidanceToggle(avoidance: FoodAvoidance) {
    onDraftChange((current) => ({
      ...current,
      foodsToAvoid: toggleMultiSelect(current.foodsToAvoid, avoidance, "none"),
    }));
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) onSave();
  }

  return (
    <motion.div
      className="mx-auto w-full max-w-5xl pb-8 pt-3 text-ink"
      role="region"
      aria-labelledby="edit-profile-title"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="flex items-center gap-4 border-b border-line pb-5 md:pb-6">
        <button
          type="button"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-white text-leaf transition hover:border-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          aria-label="Back to profile"
          onClick={onClose}
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-leaf">Profile</p>
          <h2 id="edit-profile-title" className="mt-1 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.08] tracking-[-0.04em]">
            Edit Profile
          </h2>
        </div>
      </header>

      <form className="space-y-8 pt-6 md:space-y-9 md:pt-8" aria-labelledby="edit-profile-title" onSubmit={submitProfile} noValidate>
        <fieldset className="min-w-0">
          <legend className="font-serif text-2xl leading-tight tracking-[-0.03em]">Account</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ProfileTextField
              label="Name (optional)"
              value={draftProfile.displayName}
              autoComplete="name"
              maxLength={80}
              error={nameError}
              onChange={(value) => onDraftChange((current) => ({ ...current, displayName: value }))}
            />
            <ProfileTextField
              label="Email (optional)"
              value={draftProfile.email}
              type="email"
              autoComplete="email"
              maxLength={160}
              error={emailError}
              onChange={(value) => onDraftChange((current) => ({ ...current, email: value }))}
            />
          </div>
        </fieldset>

        <EditProfileChoiceSection
          title="Goals"
          emptyMessage="No goals selected."
          options={MAIN_GOAL_OPTIONS}
          values={draftProfile.mainGoals}
          onToggle={handleMainGoalToggle}
        />

        <EditProfileChoiceSection
          title="Diet"
          emptyMessage="No diet preferences selected."
          options={DIET_OPTIONS}
          values={draftProfile.dietPreferences}
          onToggle={handleDietPreferenceToggle}
        />

        <EditProfileChoiceSection
          title="Avoid"
          emptyMessage="No ingredients selected."
          options={FOOD_AVOIDANCE_OPTIONS}
          values={draftProfile.foodsToAvoid}
          onToggle={handleFoodAvoidanceToggle}
        />

        <div className="flex justify-end border-t border-line pt-5">
          <button
            type="submit"
            className="min-h-12 w-full rounded-full bg-leaf px-8 text-base font-semibold text-white transition hover:bg-[#104c3e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:bg-[#dfe6de] disabled:text-[#53635a] sm:w-auto"
            disabled={!canSave}
          >
            Save Changes
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function ProfileTextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  maxLength,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "email" | "text";
  autoComplete: string;
  maxLength: number;
  error: string;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <div className="min-w-0">
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold leading-5 text-ink">{label}</label>
      <input
        id={fieldId}
        name={autoComplete}
        type={type}
        className={`min-h-12 w-full rounded-xl border bg-white px-3.5 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf ${
          error ? "border-[#a33c32]" : "border-[#728579]"
        }`}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <span id={errorId} className={`mt-1 block text-xs font-medium leading-4 ${error ? "text-[#a33c32]" : "sr-only"}`}>
        {error || "Valid"}
      </span>
    </div>
  );
}

function EditProfileChoiceSection<T extends string>({
  title,
  emptyMessage,
  options,
  values,
  onToggle,
}: {
  title: string;
  emptyMessage: string;
  options: Array<ChoiceOption<T>>;
  values: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-serif text-2xl leading-tight tracking-[-0.03em] text-ink">{title}</legend>
      {values.length === 0 && <p className="mt-1 text-sm font-medium text-muted">{emptyMessage}</p>}
      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2 sm:gap-3">
        {options.map((option) => {
          const isSelected = values.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              className={`flex min-h-[54px] min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf ${
                isSelected
                  ? "border-leaf bg-oat"
                  : "border-line bg-white hover:border-leaf"
              }`}
              onClick={() => onToggle(option.value)}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${option.tint}`}>{option.icon}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-ink">{option.label}</span>
              {isSelected && <CheckCircle2 className="shrink-0 text-leaf" size={17} strokeWidth={2.6} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function getProfileNameError(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.length > 80) {
    return "Name must be 80 characters or less.";
  }

  return "";
}

function getProfileEmailError(value: string): string {
  const email = value.trim().toLowerCase();

  if (!email) {
    return "";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email.";
  }

  return "";
}

function ProfileSettingsRow({
  label,
  icon,
  danger = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-[54px] w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf ${
        danger ? "text-[#a43935] hover:bg-[#fcf2ef]" : "text-ink hover:bg-oat"
      }`}
      disabled={!onClick}
      onClick={onClick}
    >
      <span className={danger ? "shrink-0" : "shrink-0 text-leaf"}>{icon}</span>
      <span className="min-w-0 flex-1 text-[15px] font-medium leading-5">{label}</span>
      <ChevronRight className="shrink-0 text-muted" size={17} />
    </button>
  );
}

function HistoryFilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="history-filter"
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
      {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-leaf" />}
    </button>
  );
}

function HistoryScanCard({ item, onSelect }: { item: ScanHistoryItem; onSelect: () => void }) {
  const tags = historyItemTags(item);

  return (
    <button
      type="button"
      className="bento-card flex w-full items-center gap-3 p-3 text-left transition hover:border-leaf/50 sm:p-4"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <HistoryThumb imageUrl={item.imageUrl} name={item.productName} />
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-[17px] font-semibold leading-6 text-black">{item.productName}</h3>
        <p className="truncate text-[14px] font-semibold leading-5 text-[#3B4949]">{formatCompactHistoryDateTime(item.scannedAt)}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag.label} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold leading-4 ${tag.className}`}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>
      <HistoryScoreRing score={item.score} />
    </button>
  );
}

function HistoryThumb({ imageUrl, name }: { imageUrl?: string; name: string }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-oat">
      {imageUrl ? (
        <img className="h-full w-full object-contain" src={imageUrl} alt={name} />
      ) : (
        <Apple className="text-[#00696B]" size={34} strokeWidth={1.9} />
      )}
    </div>
  );
}

function HistoryScoreRing({ score }: { score: number }) {
  const displayScore = Math.min(10, Math.max(1, Math.round(score)));
  const progressScore = displayScore * 10;
  const accentColor = scoreAccentColor(displayScore);

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${accentColor} ${progressScore}%, #E1E3E4 ${progressScore}% 100%)` }}
      aria-label={`Score ${displayScore} out of 10`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[16px] font-black" style={{ color: accentColor }}>
        {displayScore}
      </div>
    </div>
  );
}

function groupSavedSwapHistory(items: SavedSwapHistoryItem[]): SavedSwapHistoryGroup[] {
  const groups = new Map<string, SavedSwapHistoryGroup>();

  for (const item of items) {
    const barcode = item.scannedProduct.barcode;
    const existing = groups.get(barcode);

    if (existing) {
      existing.swaps.push(item);
      if (Date.parse(item.savedAt) > Date.parse(existing.latestSavedAt)) {
        existing.latestSavedAt = item.savedAt;
        existing.scannedProduct = item.scannedProduct;
      }
      continue;
    }

    groups.set(barcode, {
      barcode,
      scannedProduct: item.scannedProduct,
      latestSavedAt: item.savedAt,
      swaps: [item],
    });
  }

  return Array.from(groups.values()).sort((left, right) => Date.parse(right.latestSavedAt) - Date.parse(left.latestSavedAt));
}

function formatCompactHistoryDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const itemDay = new Date(date);
  itemDay.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((today.getTime() - itemDay.getTime()) / 86_400_000);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);

  if (dayDiff === 0) {
    return `Today, ${time}`;
  }

  if (dayDiff === 1) {
    return `Yesterday, ${time}`;
  }

  return `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}, ${time}`;
}

function historyItemTags(item: ScanHistoryItem): Array<{ label: string; className: string }> {
  if (item.score >= 8) {
    return [
      { label: "High Score", className: "bg-[#AEEED8] text-[#0D503F]" },
      { label: "Safe", className: "bg-[#E1E3E4] text-[#3B4949]" },
    ];
  }

  if (item.score >= 6) {
    return [
      { label: "Review", className: "bg-[#B3ECF3] text-[#0D4E54]" },
      { label: "Moderate", className: "bg-[#E1E3E4] text-[#3B4949]" },
    ];
  }

  return [
    { label: "Flagged", className: "bg-[#FFDAD6] text-[#93000A]" },
    { label: "Check label", className: "bg-[#E1E3E4] text-[#3B4949]" },
  ];
}

function SavedSwapHistoryDetail({ item, onBack }: { item: SavedSwapHistoryItem; onBack: () => void }) {
  const photo = alternativeImageFor(item.swap);
  const swapName = item.swap.brand ? `${item.swap.brand} ${item.swap.name}` : item.swap.name;
  const meta = item.swap.brand ? `${item.swap.brand} - ${item.swap.category}` : item.swap.category;

  return (
    <div className="record-detail space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oat text-ink outline-none transition hover:bg-line focus-visible:ring-2 focus-visible:ring-leaf/35"
          onClick={onBack}
          aria-label="Back to saved swaps"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-leaf">Saved swap</p>
          <h2 className="record-subtitle mt-1 break-words">{swapName}</h2>
        </div>
      </div>

      <div className="bento-card record-feature overflow-hidden">
        <div className="bg-oat p-5">
          <div className="mx-auto flex aspect-square max-h-[190px] w-full max-w-[190px] items-center justify-center overflow-hidden rounded-[8px] bg-cream/80 text-leaf">
            {photo ? <img className="h-full w-full object-contain" src={photo} alt={swapName} /> : <Apple size={64} strokeWidth={1.9} />}
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{meta}</p>
            <h3 className="mt-1 record-subtitle">{swapName}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#DDF7EF] px-3 py-1 text-xs font-black text-[#00696B]">{item.swap.scoreHint}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-cream px-3 py-1 text-xs font-black text-ink">
                <DollarSign size={13} />
                Est. {item.swap.estimatedPrice}
              </span>
            </div>
          </div>

          <p className="text-sm leading-6 text-muted">{item.swap.reason}</p>
          {item.swap.similarityReason && <p className="rounded-[8px] bg-oat px-3 py-2 text-sm font-semibold leading-5 text-ink">{item.swap.similarityReason}</p>}
        </div>
      </div>

      <HistoryDetailSection title="Scanned from">
        <div className="flex items-center gap-3">
          <HistoryThumb imageUrl={item.scannedProduct.imageUrl} name={item.scannedProduct.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{item.scannedProduct.brand ?? "Scanned food"}</p>
            <h3 className="mt-1 line-clamp-2 text-base font-black leading-tight">{item.scannedProduct.name}</h3>
            <p className="mt-1 text-xs font-bold text-muted">{formatHistoryDateTime(item.scannedProduct.scannedAt)}</p>
          </div>
          <ScoreBadge value={item.scannedProduct.score} size="sm" />
        </div>
        <HistoryDataRow label="Barcode" value={item.scannedProduct.barcode} />
        <HistoryDataRow label="Saved" value={formatHistoryDateTime(item.savedAt)} />
      </HistoryDetailSection>
    </div>
  );
}

function HistoryFoodDetail({
  item,
  product,
  score,
  isLoading,
  error,
  onBack,
}: {
  item: ScanHistoryItem;
  product: Product | null;
  score: QualityScore | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const detailName = product?.name ?? item.productName;
  const detailBrand = product?.brand ?? item.brand;
  const ingredients = product ? splitIngredients(product.ingredientsText) : [];
  const nutrimentRows = product ? productDataRows(product.nutriments) : [];
  const ingredientPreview = ingredients.slice(0, 3);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [showAllNutritionData, setShowAllNutritionData] = useState(false);

  useEffect(() => {
    setShowAllIngredients(false);
    setShowAllNutritionData(false);
  }, [item.barcode]);

  return (
    <div className="record-detail space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oat text-ink outline-none transition hover:bg-line focus-visible:ring-2 focus-visible:ring-leaf/35"
          onClick={onBack}
          aria-label="Back to scan history"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-leaf">History detail</p>
          <h2 className="record-subtitle mt-1 break-words">{detailName}</h2>
        </div>
      </div>

      <div className="bento-card p-4">
        <div className="flex items-center gap-3">
          <ProductThumb imageUrl={product?.imageUrl ?? item.imageUrl} name={detailName} large />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{detailBrand ?? product?.source ?? "Saved scan"}</p>
            <h3 className="mt-1 line-clamp-2 text-xl font-black leading-tight">{detailName}</h3>
            <p className="mt-1 text-xs font-bold text-muted">{formatHistoryDateTime(item.scannedAt)}</p>
          </div>
          <ScoreBadge value={score?.value ?? item.score} />
        </div>
      </div>

      {isLoading && (
        <div className="bento-card flex items-center gap-3 p-4 text-sm font-bold text-muted">
          <Loader2 className="animate-spin text-leaf" size={18} />
          Loading full product details...
        </div>
      )}

      {error && (
        <div className="bento-card flex items-start gap-3 p-4 text-sm font-semibold text-ink">
          <AlertTriangle className="mt-0.5 shrink-0 text-leaf" size={18} />
          <div>
            <p className="font-black">Full product details unavailable</p>
            <p className="mt-1 leading-5 text-muted">{error}</p>
            <p className="mt-2 leading-5 text-muted">Saved history still includes the barcode, score, scan date, and product name below.</p>
          </div>
        </div>
      )}

      <HistoryDetailSection title="Saved scan">
        <HistoryDataRow label="Product" value={item.productName} />
        <HistoryDataRow label="Brand" value={item.brand ?? "Not saved"} />
        <HistoryDataRow label="Barcode" value={item.barcode} />
        <HistoryDataRow label="Saved score" value={`${item.score}/10`} />
        <HistoryDataRow label="Scanned" value={formatHistoryDateTime(item.scannedAt)} />
      </HistoryDetailSection>

      {product && score && (
        <HistoryDetailSection title="Score data">
          <HistoryDataRow label="Score" value={`${score.value}/10`} />
          <HistoryDataRow label="Label" value={score.label} />
          <HistoryDataRow label="Confidence" value={score.confidence} />
          <p className="rounded-[8px] bg-oat px-3 py-2 text-sm font-semibold leading-5 text-muted">{score.summary}</p>
        </HistoryDetailSection>
      )}

      {product && (
        <>
          <HistoryDetailSection title="Product data">
            <HistoryDataRow label="Name" value={product.name} />
            <HistoryDataRow label="Brand" value={product.brand ?? "Unknown"} />
            <HistoryDataRow label="Barcode" value={product.barcode} />
            <HistoryDataRow label="Source" value={formatProductSource(product.source)} />
            <HistoryDataRow label="Categories" value={product.categoriesText ?? formatList(product.categories)} />
            <HistoryDataRow label="NOVA group" value={product.novaGroup?.toString() ?? "Not available"} />
            <HistoryDataRow label="Nutri-Score" value={product.nutriscoreGrade?.toUpperCase() ?? "Not available"} />
            <HistoryDataRow label="Eco-Score" value={product.ecoscoreGrade?.toUpperCase() ?? "Not available"} />
          </HistoryDetailSection>

          <HistoryDetailSection
            title="Ingredients"
            action={
              <HistorySectionExpandButton
                expanded={showAllIngredients}
                onClick={() => setShowAllIngredients((value) => !value)}
                label={showAllIngredients ? "Hide full ingredient list" : "Show full ingredient list"}
              />
            }
          >
            {product.ingredientsText ? (
              <>
                <p className="text-sm font-semibold leading-5 text-muted">
                  {ingredients.length > 0 ? `${ingredients.length} ingredient${ingredients.length === 1 ? "" : "s"} available.` : "Ingredient text available."}
                </p>
                {!showAllIngredients && ingredientPreview.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ingredientPreview.map((ingredient) => (
                      <span key={ingredient} className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-black text-muted">
                        {ingredient}
                      </span>
                    ))}
                    {ingredients.length > ingredientPreview.length && (
                      <span className="rounded-full border border-line bg-oat px-3 py-1 text-xs font-black text-muted">
                        +{ingredients.length - ingredientPreview.length} more
                      </span>
                    )}
                  </div>
                )}
                {showAllIngredients && (
                  <>
                    <p className="rounded-[8px] bg-oat px-3 py-2 text-sm font-semibold leading-5 text-muted">{product.ingredientsText}</p>
                    {ingredients.length > 0 && (
                      <div className="grid gap-2">
                        {ingredients.map((ingredient) => (
                          <div key={ingredient} className="flex items-start gap-2 rounded-[8px] border border-line bg-cream px-3 py-2">
                            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-leaf" />
                            <p className="text-sm font-semibold leading-5">{ingredient}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-muted">No ingredient text was provided for this product.</p>
            )}
          </HistoryDetailSection>

          <HistoryDetailSection title="Tags and labels">
            <HistoryChipGroup label="Ingredient tags" values={product.ingredientsTags} />
            <HistoryChipGroup label="Additives" values={product.additivesTags} />
            <HistoryChipGroup label="Allergens" values={product.allergensTags} />
            <HistoryChipGroup label="Labels" values={product.labelsTags} />
          </HistoryDetailSection>

          <HistoryDetailSection
            title="Nutrition data"
            action={
              <HistorySectionExpandButton
                expanded={showAllNutritionData}
                onClick={() => setShowAllNutritionData((value) => !value)}
                label={showAllNutritionData ? "Hide full nutrition data" : "Show full nutrition data"}
              />
            }
          >
            {nutrimentRows.length > 0 ? (
              <>
                <p className="text-sm font-semibold leading-5 text-muted">
                  {nutrimentRows.length} nutrition field{nutrimentRows.length === 1 ? "" : "s"} available.
                </p>
                {showAllNutritionData && (
                  <div className="grid gap-2">
                    {nutrimentRows.map(([key, value]) => (
                      <HistoryDataRow key={key} label={formatDataKey(key)} value={formatDataValue(value)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-muted">No nutrition data was provided for this product.</p>
            )}
          </HistoryDetailSection>

          {score && (score.flags.length > 0 || score.positives.length > 0) && (
            <HistoryDetailSection title="Score signals">
              {[...score.flags, ...score.positives].map((flag) => (
                <div key={flag.id} className="flex items-start gap-2 rounded-[8px] border border-line bg-cream px-3 py-2">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${flagColor(flag.severity)}`} />
                  <div>
                    <p className="text-sm font-black">{flag.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-muted">{flag.description}</p>
                  </div>
                </div>
              ))}
            </HistoryDetailSection>
          )}
        </>
      )}
    </div>
  );
}

function HistoryDetailSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="bento-card space-y-3 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="record-subtitle">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function HistorySectionExpandButton({ expanded, onClick, label }: { expanded: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-oat hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/35"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
    >
      <ChevronRight className={`transition-transform duration-300 ease-out ${expanded ? "rotate-90" : ""}`} size={22} />
    </button>
  );
}

function HistoryDataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="record-data-row">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="min-w-0 break-words text-sm font-medium leading-5">{value}</p>
    </div>
  );
}

function HistoryChipGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-black text-muted">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-muted">Not available</p>
      )}
    </div>
  );
}

function formatHistoryDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function splitIngredients(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Not available";
}

function formatProductSource(source: Product["source"]): string {
  return source === "open-food-facts" ? "Open Food Facts" : "Demo product";
}

function productDataRows(data?: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(data ?? {}).sort(([left], [right]) => left.localeCompare(right));
}

function formatDataKey(key: string): string {
  return key.replace(/_/g, " ").replace(/-/g, " ");
}

function formatDataValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function SwapScreen({
  products,
  settings,
  detail,
  acceptedSwapIds,
  savedSwapKeys,
  onDetailChange,
  onAlternativeAccept,
}: {
  products: Product[];
  settings: AppSettings;
  detail: SwapDetail | null;
  acceptedSwapIds: AcceptedSwapIds;
  savedSwapKeys: ReadonlySet<string>;
  onDetailChange: (detail: SwapDetail | null) => void;
  onAlternativeAccept: (product: Product, alternative: AlternativeProduct) => void;
}) {
  const currentProduct = products[0] ?? null;
  const currentScore = currentProduct ? scoreProduct(currentProduct, settings) : null;
  const currentAlternatives = currentProduct ? getAlternatives(currentProduct) : [FALLBACK_SWAP];
  const visibleAlternatives = currentAlternatives.length > 0 ? currentAlternatives : [FALLBACK_SWAP];
  const hasStarterDetail = detail?.barcode === "starter";
  const selectedProduct = detail && currentProduct?.barcode === detail.barcode ? currentProduct : null;
  const selectedScore = selectedProduct ? scoreProduct(selectedProduct, settings) : null;
  const selectedAlternatives = selectedProduct ? getAlternatives(selectedProduct) : [FALLBACK_SWAP];
  const selectedAlternative =
    detail?.alternativeId && selectedAlternatives.length > 0
      ? selectedAlternatives.find((entry) => entry.id === detail.alternativeId) ?? selectedAlternatives[0]
      : selectedAlternatives[0] ?? FALLBACK_SWAP;
  const selectedProductIsBetterPick = Boolean(selectedProduct && selectedScore && selectedScore.value >= 8);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {detail && (selectedProduct || hasStarterDetail) ? (
        <motion.div
          key={`${detail.barcode}-${detail.side}-${selectedAlternative.id}`}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.22 }}
        >
          <SwapFoodDetailScreen
            detail={detail.side}
            product={selectedProduct}
            score={selectedScore}
            alternative={selectedAlternative}
            scannedProductIsBetterPick={selectedProductIsBetterPick}
            originalImageUrl={selectedProduct?.imageUrl ?? burgerKingFries}
            alternativeImageUrl={alternativeImageFor(selectedAlternative)}
            onBack={() => onDetailChange(null)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="swap-overview"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.22 }}
          className="space-y-4"
        >
          <SectionTitle eyebrow="Swap" title={currentProduct ? "Recommended swaps" : "Interchangeable picks"} />

          {currentProduct ? (
            <div className="swap-grid">
              {visibleAlternatives.map((alternative) => (
                <SwapRecommendationCard
                  key={alternative.id}
                  product={currentProduct}
                  alternative={alternative}
                  isSaved={
                    acceptedSwapIds[currentProduct.barcode] === alternative.id ||
                    savedSwapKeys.has(createSavedSwapStateKey(currentProduct.barcode, alternative.id))
                  }
                  scannedProductIsBetterPick={Boolean(currentScore && currentScore.value >= 8)}
                  onOpenDetail={() =>
                    onDetailChange({
                      barcode: currentProduct.barcode,
                      side: "alternative",
                      alternativeId: alternative.id,
                    })
                  }
                  onSave={() => onAlternativeAccept(currentProduct, alternative)}
                />
              ))}
            </div>
          ) : (
            <SwapRecommendationCard
              product={null}
              alternative={FALLBACK_SWAP}
              isSaved={false}
              scannedProductIsBetterPick={false}
              onOpenDetail={() => onDetailChange({ barcode: "starter", side: "alternative", alternativeId: FALLBACK_SWAP.id })}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SwapRecommendationCard({
  product,
  alternative,
  isSaved,
  scannedProductIsBetterPick,
  onOpenDetail,
  onSave,
}: {
  product: Product | null;
  alternative: AlternativeProduct;
  isSaved: boolean;
  scannedProductIsBetterPick: boolean;
  onOpenDetail: () => void;
  onSave?: () => void;
}) {
  const alternativeName = alternative.brand ? `${alternative.brand} ${alternative.name}` : alternative.name;
  const meta = alternative.brand ? `${alternative.brand} - ${alternative.category}` : alternative.category;
  const scoreHint = scannedProductIsBetterPick ? `Similar or better - ${alternative.scoreHint}` : alternative.scoreHint;
  const similarity = alternative.similarityReason ?? "Keeps the same eating occasion while moving toward a cleaner ingredient profile.";
  const estimatedPrice = estimatedSwapPrice(alternative);
  const imageUrl = alternativeImageFor(alternative);

  return (
    <article className={`bento-card flex min-w-0 flex-col overflow-hidden border ${isSaved ? "border-leaf/50" : "border-line"}`}>
      <button
        type="button"
        className="grid w-full flex-1 content-start grid-cols-[clamp(3rem,12vw,5rem)_minmax(0,1fr)] gap-3 p-4 text-left outline-none transition hover:bg-oat/45 focus-visible:ring-2 focus-visible:ring-leaf/35"
        onClick={onOpenDetail}
        aria-label={`View details for ${alternativeName}`}
      >
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[8px] bg-oat text-leaf">
          {imageUrl ? <img className="h-full w-full object-contain p-2" src={imageUrl} alt={alternativeName} /> : <Apple size={36} />}
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-black uppercase leading-4 tracking-[0.16em] text-leaf">{meta}</p>
            {isSaved && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-leaf/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-leaf">
                <CheckCircle2 size={12} />
                Saved
              </span>
            )}
          </div>
          <h3 className="mt-1 break-words text-lg font-semibold leading-5 text-ink">{alternativeName}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-black text-muted">{scoreHint}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-cream px-2.5 py-1 text-xs font-black text-ink">
              <DollarSign size={13} />
              Est. {estimatedPrice}
            </span>
          </div>
          <p className="mt-2 text-sm leading-5 text-muted">{alternative.reason}</p>
          <p className="mt-2 text-sm font-medium leading-5 text-ink">{similarity}</p>
        </div>
      </button>

      <div className="border-t border-line bg-cream px-4 py-3">
        <button
          type="button"
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-leaf/35 ${
            isSaved
              ? "bg-oat text-leaf"
              : "bg-ink text-white hover:-translate-y-0.5 hover:bg-leaf disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-muted"
          }`}
          onClick={onSave}
          disabled={!product || !onSave}
          aria-pressed={product ? isSaved : undefined}
        >
          {isSaved ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
          {isSaved ? "Saved Swap" : "Save Swap"}
        </button>
      </div>
    </article>
  );
}

function SwapFoodDetailScreen({
  detail,
  product,
  score,
  alternative,
  scannedProductIsBetterPick,
  originalImageUrl,
  alternativeImageUrl,
  onBack,
}: {
  detail: SwapDetailSide;
  product: Product | null;
  score: QualityScore | null;
  alternative: AlternativeProduct;
  scannedProductIsBetterPick: boolean;
  originalImageUrl?: string;
  alternativeImageUrl?: string;
  onBack: () => void;
}) {
  const isOriginal = detail === "original";
  const originalIsLowerQuality = isOriginal && !scannedProductIsBetterPick;
  const alternativeName = alternative.brand ? `${alternative.brand} ${alternative.name}` : alternative.name;
  const originalName = product ? product.name : "Burger King fries";
  const betterName = alternativeName;
  const name = isOriginal ? originalName : betterName;
  const meta = isOriginal ? (product ? scannedProductDetail(product, score) : "Fast-food fries") : alternative.category;
  const imageUrl = isOriginal ? originalImageUrl : alternativeImageUrl;
  const reason = isOriginal
    ? scannedProductIsBetterPick
      ? currentPickReason(score)
      : originalSwapReason(score)
    : scannedProductIsBetterPick
      ? similarOrBetterSwapReason(alternative, score)
      : betterSwapReason(alternative);
  const supportingReasons = isOriginal
    ? scannedProductIsBetterPick
      ? currentPickSupportingReasons(score)
      : originalSupportingReasons(score)
    : scannedProductIsBetterPick
      ? similarOrBetterSupportingReasons(alternative, score)
      : betterSupportingReasons(alternative);
  const detailLabel = isOriginal ? (scannedProductIsBetterPick ? "Current pick" : product ? "Scanned food" : "Less ideal") : scannedProductIsBetterPick ? "Similar or better" : "Better swap";
  const detailTitle = isOriginal
    ? scannedProductIsBetterPick
      ? "Why this is solid"
      : "Why it scores lower"
    : scannedProductIsBetterPick
      ? "Why this also fits"
      : "Why this is closer";

  return (
    <div className="record-detail space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oat text-ink transition hover:bg-line"
          onClick={onBack}
          aria-label="Back to swap comparison"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className={`text-xs font-black uppercase tracking-[0.2em] ${originalIsLowerQuality ? "text-ink" : "text-leaf"}`}>
            {detailLabel}
          </p>
          <h2 className="record-subtitle mt-1 break-words">{detailTitle}</h2>
        </div>
      </div>

      <div className="bento-card record-feature overflow-hidden">
        <div className={`${originalIsLowerQuality ? "bg-sky" : "bg-oat"} p-5`}>
          <div className="mx-auto flex aspect-square max-h-[220px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[8px] bg-cream/70">
            {imageUrl ? <img className="h-full w-full object-contain p-4" src={imageUrl} alt={name} /> : <Apple className="text-leaf" size={64} />}
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{meta}</p>
            <h3 className="mt-1 record-subtitle">{name}</h3>
          </div>

          <p className="text-sm leading-6 text-muted">{reason}</p>

          <div className="grid gap-2">
            {supportingReasons.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-[8px] bg-oat px-3 py-2">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${originalIsLowerQuality ? "bg-ink" : "bg-leaf"}`} />
                <p className="text-sm font-semibold leading-5 text-ink">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function originalSwapReason(score: QualityScore | null): string {
  if (score) {
    return score.summary;
  }

  return "This still satisfies a salty potato craving, but fast-food fries are usually a more processed option with frying oils and sodium that BetterBite treats as lower-quality signals.";
}

function originalSupportingReasons(score: QualityScore | null): string[] {
  if (score?.flags.length) {
    return score.flags.slice(0, 3).map((flag) => flag.description);
  }

  return [
    "Often built around frying oils rather than a short ingredient list.",
    "Usually higher in sodium for a small side portion.",
    "More processed than a cleaner salty potato snack.",
  ];
}

function scannedProductDetail(product: Product, score: QualityScore | null): string {
  const scoreText = score ? `${score.label} (${score.value}/10)` : "Scanned product";
  return product.brand ? `${product.brand} - ${scoreText}` : scoreText;
}

const SWAP_PRODUCT_PHOTOS = new Map([
  [FALLBACK_SWAP.id, boulderCanyonChips],
  ["boulder-canyon-avocado-oil", boulderCanyonChips],
  ["siete-chips", sieteChipsPhoto],
  ["olipop", olipopColaPhoto],
  ["hu-chocolate", huGemsPhoto],
  ["lesser-evil-popcorn", lesserEvilPopcornPhoto],
]);

function alternativeImageFor(alternative: AlternativeProduct): string | undefined {
  return SWAP_PRODUCT_PHOTOS.get(alternative.id);
}

function estimatedSwapPrice(alternative: AlternativeProduct): string {
  return ESTIMATED_SWAP_PRICES[alternative.id] ?? "$4.99";
}

function createSavedSwapHistoryItem({
  product,
  score,
  alternative,
  scanHistoryItem,
}: {
  product: Product;
  score: QualityScore;
  alternative: AlternativeProduct;
  scanHistoryItem?: ScanHistoryItem;
}): SavedSwapHistoryItem {
  const savedAt = new Date().toISOString();

  return {
    id: createSavedSwapHistoryId(product.barcode, alternative.id),
    savedAt,
    scannedProduct: {
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      score: score.value,
      imageUrl: product.imageUrl,
      scannedAt: scanHistoryItem?.scannedAt ?? savedAt,
    },
    swap: {
      id: alternative.id,
      name: alternative.name,
      brand: alternative.brand,
      category: alternative.category,
      reason: alternative.reason,
      scoreHint: alternative.scoreHint,
      similarityReason: alternative.similarityReason,
      estimatedPrice: estimatedSwapPrice(alternative),
    },
  };
}

function createSavedSwapHistoryId(barcode: string, alternativeId: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${barcode}-${alternativeId}-${Date.now()}`;
}

function createSavedSwapStateKey(barcode: string, alternativeId: string): string {
  return `${barcode}::${alternativeId}`;
}

function betterSwapReason(alternative: AlternativeProduct): string {
  const similarity = alternative.similarityReason ?? "It keeps the same eating occasion while moving toward a cleaner ingredient profile.";
  return `${alternative.reason} ${similarity}`;
}

function similarOrBetterSwapReason(alternative: AlternativeProduct, score: QualityScore | null): string {
  const scoreText = score ? `Your scanned item already scores ${score.value}/10. ` : "";
  return `${scoreText}${betterSwapReason(alternative)}`;
}

function betterSupportingReasons(alternative: AlternativeProduct): string[] {
  return [
    alternative.scoreHint,
    alternative.similarityReason ?? "Similar enough to satisfy the same craving, but with better ingredient-quality tradeoffs.",
    "Chosen as a closer alternative, not an unrelated healthy food.",
  ];
}

function currentPickReason(score: QualityScore | null): string {
  if (!score) {
    return "This scanned item does not have enough score context yet, so BetterBite should not call it less ideal.";
  }

  return `${score.summary} Because it scores ${score.value}/10, BetterBite treats it as a good starting point and compares it with similar choices instead of replacing it with an unrelated healthy food.`;
}

function currentPickSupportingReasons(score: QualityScore | null): string[] {
  if (!score) {
    return ["Needs confirmed ingredient data before BetterBite makes a stronger claim."];
  }

  const positives = score.positives.slice(0, 2).map((flag) => flag.description);
  return [`Score is ${score.value}/10, which meets the good-pick threshold.`, ...positives, "It stays as the current craving being matched, not as something to punish."];
}

function similarOrBetterSupportingReasons(alternative: AlternativeProduct, score: QualityScore | null): string[] {
  return [
    score ? `Recommended because the scan is already strong at ${score.value}/10, so the swap should be similar or cleaner.` : "Recommended as a similar option while score context is limited.",
    alternative.scoreHint,
    alternative.similarityReason ?? "Keeps the same craving, texture, or eating occasion instead of jumping to an unrelated food.",
  ];
}

function ActivityCard({ chart }: { chart: ActivityChart }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const compactDayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const currentWeekRange = formatActivityWeekRange(chart.currentWeek);
  const activityHistoryTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.2, ease: "easeOut" },
        y: { duration: 0.24, ease: "easeOut" },
      };

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-4">
        {currentWeekRange && <p className="whitespace-nowrap text-[11px] font-black text-leaf">Current week: {currentWeekRange}</p>}
        <button
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-oat hover:text-ink"
          onClick={() => setIsExpanded((value) => !value)}
          aria-label={isExpanded ? "Hide full activity history" : "Show full activity history"}
          aria-expanded={isExpanded}
        >
          <ChevronRight className={`transition-transform duration-300 ease-out ${isExpanded ? "rotate-90" : ""}`} size={22} />
        </button>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-7 gap-1 rounded-full bg-oat p-1">
          {chart.currentWeek.map((day) => {
            const hasActivity = day.count > 0;
            const isMissedLogin = !hasActivity && !day.isFuture;
            return (
              <span
                key={day.date}
                aria-label={`${day.date}: ${day.count} activity point${day.count === 1 ? "" : "s"}`}
                className={`flex aspect-square w-full max-w-9 justify-self-center items-center justify-center rounded-full ${hasActivity ? "bg-[#5E8E45]" : compactActivityColor(day.level, day.isFuture)}`}
                title={`${day.date}: ${day.count} activity point${day.count === 1 ? "" : "s"}`}
              >
                {hasActivity && (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cream">
                    <CheckCircle2 size={16} strokeWidth={3} className="text-[#5E8E45]" />
                  </span>
                )}
                {isMissedLogin && (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cream">
                    <CircleX className="text-[#E92D48]" size={16} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
                {!hasActivity && !isMissedLogin && <span className="h-3 w-3 rounded-full bg-cream/15" />}
              </span>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2 text-center">
          {compactDayLabels.map((label, index) => {
            const day = chart.currentWeek[index];
            const isActive = Boolean(day && day.count > 0);
            return (
              <span key={`${label}-${index}`} className={`text-xs font-black ${isActive ? "text-leaf" : "text-muted"}`}>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="full-activity-history"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={activityHistoryTransition}
            className="overflow-hidden"
          >
            <FullActivityChart chart={chart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FullActivityChart({ chart }: { chart: ActivityChart }) {
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollLeft = scroller.scrollWidth;
    }
  }, [chart.weeks]);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div ref={scrollerRef} role="region" tabIndex={0} data-swipe-ignore="true" className="overflow-x-auto pb-2" aria-label="Daily activity over the last 53 weeks">
        <div className="grid w-max grid-cols-[32px_repeat(53,12px)] gap-x-[3px] gap-y-[3px]">
          <span />
          {chart.weeks.map((week) => (
            <span key={`${week.startDate}-label`} className="h-4 overflow-visible text-[10px] font-bold leading-4 text-muted">
              {week.monthLabel ?? ""}
            </span>
          ))}

          {dayLabels.map((label, dayIndex) => (
            <Fragment key={`row-${dayIndex}`}>
              <span className="h-3 pr-1 text-right text-[10px] font-bold leading-3 text-muted">{label}</span>
              {chart.weeks.map((week) => {
                const cell = week.days[dayIndex];
                return (
                  <span
                    key={cell.date}
                    aria-label={`${cell.date}: ${cell.count} activity point${cell.count === 1 ? "" : "s"}`}
                    className={`h-3 w-3 rounded-[3px] ${activityCellColor(cell.level, cell.isFuture)}`}
                    title={`${cell.date}: ${cell.count} activity point${cell.count === 1 ? "" : "s"}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function activityCellColor(level: number, isFuture: boolean): string {
  if (isFuture) return "bg-[#F7FAFB]";
  if (level <= 0) return "bg-[#EAF4EE]";
  if (level === 1) return "bg-[#0D8F4F]";
  if (level === 2) return "bg-[#31A863]";
  if (level === 3) return "bg-[#5DBB73]";
  return "bg-[#86D695]";
}

function compactActivityColor(level: number, isFuture: boolean): string {
  if (isFuture) return "bg-white";
  if (level <= 0) return "bg-[#EAF4EE]";
  if (level === 1) return "bg-[#0D8F4F]";
  if (level === 2) return "bg-[#31A863]";
  if (level === 3) return "bg-[#5DBB73]";
  return "bg-[#86D695]";
}

function ScannerCard({
  barcode,
  error,
  isLoading,
  onBarcodeChange,
  onSubmit,
  onCameraScan,
}: {
  barcode: string;
  error: string | null;
  isLoading: boolean;
  onBarcodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCameraScan: () => void;
}) {
  return (
    <div className="bento-card overflow-hidden">
      <div className="grid min-h-[190px] grid-cols-[1.05fr_0.95fr]">
        <div className="bg-leaf p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/85">Barcode</p>
          <h2 className="mt-3 font-serif text-2xl leading-tight">Scan an ingredient label fast</h2>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#00696B] shadow-[0_12px_24px_rgba(0,105,107,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-white/70"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onCameraScan}
          >
            <Camera size={17} />
            Camera
          </button>
        </div>
        <div className="flex items-center justify-center bg-oat p-4">
          <div className="rounded-[26px] bg-white p-5 text-[#12C8CA] shadow-[0_14px_32px_rgba(0,180,184,0.12)]">
            <Barcode size={76} strokeWidth={1.8} />
          </div>
        </div>
      </div>

      <form className="space-y-3 p-4" onSubmit={onSubmit}>
        <label className="text-xs font-black uppercase tracking-[0.2em] text-[#00696B]" htmlFor="barcode">
          UPC or EAN
        </label>
        <div className="flex gap-2">
          <input
            id="barcode"
            inputMode="numeric"
            className="min-w-0 flex-1 rounded-[14px] border border-line bg-white px-4 py-3 text-base font-bold text-[#1F2629] outline-none transition placeholder:text-[#667080] focus:border-[#00C5C8] focus:ring-2 focus:ring-[#00C5C8]/20"
            placeholder="5449000000996"
            value={barcode}
            onChange={(event) => onBarcodeChange(event.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-leaf text-white shadow-[0_12px_24px_rgba(0,128,128,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 disabled:opacity-60"
            onMouseDown={(event) => event.preventDefault()}
            disabled={isLoading}
            aria-label="Search barcode"
          >
            {isLoading ? <Loader2 className="animate-spin" size={21} /> : <Search size={21} />}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-[8px] bg-oat px-3 py-2 text-sm font-semibold text-[#00696B]">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="bento-card bg-white p-4">
        <Apple className="mb-5 text-leaf" size={30} />
        <h2 className="record-subtitle">Ingredient-first</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Scores focus on processing and ingredient quality.</p>
      </div>
      <div className="bento-card bg-white p-4">
        <CheckCircle2 className="mb-5 text-coral" size={30} />
        <h2 className="record-subtitle">Clear swaps</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Alternatives are curated by product category.</p>
      </div>
    </div>
  );
}

function ProductResult({
  product,
  score,
  alternatives,
  showAlternatives = true,
}: {
  product: Product;
  score: QualityScore;
  alternatives: AlternativeProduct[];
  showAlternatives?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="scan-report">
      <div className="scan-report-heading bento-card p-4 sm:p-6">
        <div className="flex gap-4">
          <ProductThumb imageUrl={product.imageUrl} name={product.name} large />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-leaf">{product.brand ?? "Open Food Facts"}</p>
            <h2 className="record-subtitle mt-2 break-words">{product.name}</h2>
            <p className="mt-2 break-words text-xs font-medium text-muted">{product.categoriesText ?? product.barcode}</p>
          </div>
          <ScoreBadge value={score.value} />
        </div>
      </div>

      <FlagSection title="Ingredient flags" flags={score.flags} emptyText="No major ingredient-quality flags found." />
      <FlagSection title="Positive signals" flags={score.positives} emptyText="No positive clean-label signals found yet." />

      {showAlternatives && (
        <div className="space-y-3">
          <SectionTitle eyebrow="Curated" title="Cleaner alternatives" />
          <div className="grid gap-3">
            {alternatives.map((alternative) => (
              <div key={alternative.id} className="bento-card flex items-start gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-oat text-leaf">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{alternative.category}</p>
                  <h3 className="mt-1 text-base font-black">
                    {alternative.brand ? `${alternative.brand} ` : ""}
                    {alternative.name}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-muted">{alternative.reason}</p>
                  <p className="mt-2 text-xs font-black text-leaf">{alternative.scoreHint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function FlagSection({ title, flags, emptyText }: { title: string; flags: IngredientFlag[]; emptyText: string }) {
  return (
    <div className="space-y-3">
      <SectionTitle eyebrow="Score" title={title} />
      <div className="grid gap-2">
        {flags.length > 0 ? (
          flags.map((flag) => (
            <div key={flag.id} className="bento-card flex items-start gap-3 p-3">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${flagColor(flag.severity)}`} />
              <div>
                <h3 className="text-sm font-black">{flag.label}</h3>
                <p className="mt-1 text-sm leading-5 text-muted">{flag.description}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="bento-card p-4 text-sm font-semibold text-muted">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-leaf">{eyebrow}</p>
      <h2 className="record-subtitle mt-1">{title}</h2>
    </div>
  );
}

function ProductThumb({ imageUrl, name, large = false }: { imageUrl?: string; name: string; large?: boolean }) {
  const sizeClass = large ? "h-20 w-20" : "h-14 w-14";

  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-oat`}>
      {imageUrl ? <img className="h-full w-full object-contain" src={imageUrl} alt={name} /> : <Apple className="text-leaf" size={large ? 34 : 24} />}
    </div>
  );
}

function ScoreBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const className =
    size === "sm"
      ? "h-10 w-10 text-sm"
      : "h-14 w-14 text-lg";

  return (
    <div className={`${className} flex shrink-0 self-center items-center justify-center rounded-full font-black ${scoreTextColor(value)} ${scoreColor(value)}`}>
      {value}
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      data-testid={testId}
      type="button"
      aria-current={active ? "page" : undefined}
      className="app-nav-item"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function scoreColor(value: number): string {
  if (value <= 2) return "bg-[#df2f46]";
  if (value <= 3) return "bg-[#f17955]";
  if (value <= 5) return "bg-[#f4b65b]";
  if (value <= 6) return "bg-[#f7dc62]";
  if (value <= 8) return "bg-[#b7e55f]";
  return "bg-[#73c84d]";
}

function scoreAccentColor(value: number): string {
  if (value <= 2) return "#df2f46";
  if (value <= 3) return "#f17955";
  if (value <= 5) return "#f4b65b";
  if (value <= 6) return "#f7dc62";
  if (value <= 8) return "#b7e55f";
  return "#73c84d";
}

function scoreTextColor(value: number): string {
  if (value <= 2) return "text-white";
  return "text-ink";
}

function flagColor(severity: IngredientFlag["severity"]): string {
  if (severity === "high") return "bg-berry";
  if (severity === "medium") return "bg-coral";
  if (severity === "positive") return "bg-leaf";
  if (severity === "info") return "bg-sky";
  return "bg-muted";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function isLikelyMobileRuntime(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}


function getFoodRecognitionErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  return error instanceof Error && error.message ? error.message : "Food recognition is unavailable.";
}


function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function isScannerDismissalError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return /\b(cancelled|canceled|cancel|closed|dismissed|aborted)\b/i.test(message);
}

function getBrowserCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return getBrowserCameraBlockedMessage();
    }

    if (error.name === "NotFoundError") {
      return "No camera was found on this laptop.";
    }

    if (error.name === "NotReadableError") {
      return "The camera is already being used by another app.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Camera scanning is unavailable on this target.";
}

async function getBrowserCameraPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return null;
  }

  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return null;
  }
}

function getBrowserCameraBlockedMessage(): string {
  const host = typeof window !== "undefined" ? window.location.host : "";
  const hostCopy = host ? ` for ${host}` : "";

  return `Camera permission is blocked for this site. Allow camera access${hostCopy} in your browser settings, then tap Try camera again.`;
}

function captureVideoFrameAsDataUrl(video: HTMLVideoElement): string {
  const sourceWidth = video.videoWidth || video.clientWidth;
  const sourceHeight = video.videoHeight || video.clientHeight;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Camera frame is not ready yet.");
  }

  const maxEdge = 512;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Camera frame capture is unavailable.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.82);
}

function recordLoginActivityOnce(date = new Date()): ActivityDay[] | null {
  const dateKey = toLocalDateKey(date);

  if (didRecordLoginThisRuntimeDate === dateKey) {
    return null;
  }

  try {
    if (sessionStorage.getItem(LOGIN_ACTIVITY_SESSION_KEY) === dateKey) {
      didRecordLoginThisRuntimeDate = dateKey;
      return null;
    }

    sessionStorage.setItem(LOGIN_ACTIVITY_SESSION_KEY, dateKey);
  } catch {
    // Session storage is only a guard against duplicate launch points.
  }

  didRecordLoginThisRuntimeDate = dateKey;
  return recordActivity("login", date);
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
