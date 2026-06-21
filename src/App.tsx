import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  House,
  Leaf,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { Fragment, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import boulderCanyonChips from "./assets/boulder-canyon-chips.avif";
import burgerKingFries from "./assets/burger-king-fries.jpg";
import menuPhoto from "./assets/menu-photo.jpg";
import profilePhoto from "./assets/luis-gonzalez-profile.jpeg";
import recipeBuilderPhoto from "./assets/recipe-builder-photo.jpg";
import { OnboardingFlow, type OnboardingStep } from "./components/OnboardingFlow";
import { DIET_OPTIONS, FOOD_AVOIDANCE_OPTIONS, MAIN_GOAL_OPTIONS, type ChoiceOption } from "./components/onboardingOptions";
import { SearchScreen } from "./components/SearchScreen";
import { getAlternatives } from "./lib/alternatives";
import { buildActivityChart, formatActivityWeekRange, type ActivityChart } from "./lib/activityChart";
import { getBarcodeError, normalizeBarcode } from "./lib/barcode";
import { createBrowserBarcodeDetector, isBrowserCameraPreviewSupported } from "./lib/browserBarcodeScanner";
import { filterHistoryItems } from "./lib/historyFilters";
import { fetchProductByBarcode } from "./lib/openFoodFacts";
import { scoreProduct } from "./lib/qualityScore";
import { getBarcodeScannerFormats } from "./lib/scannerFormats";
import {
  appendSavedSwapHistory,
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
import type {
  ActivityDay,
  AlternativeProduct,
  AppSettings,
  DietPreference,
  FoodAvoidance,
  HistoryFilter,
  IngredientFlag,
  MainGoal,
  OnboardingProfile,
  Product,
  QualityScore,
  SavedSwapHistoryItem,
  ScanHistoryItem,
} from "./types";

type Tab = "home" | "search" | "scan" | "history" | "profile";
type VisibleOnboardingStep = Exclude<OnboardingStep, "app">;
type ScanCameraMode = "barcode" | "food";
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
const LOGIN_ACTIVITY_SESSION_KEY = "betterbite.loginActivityRecorded.v1";
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
const ONBOARDING_SEQUENCE: VisibleOnboardingStep[] = ["welcome", "benefits", "scan-swap", "main-goal", "diet", "avoid", "account"];
const RECOMMENDED_FOODS = [
  {
    name: "Siete Sea Salt Chips",
    detail: "Tortilla chip craving",
    score: "9.1",
    imageSrc:
      "https://i5.walmartimages.com/seo/Siete-Sea-Salt-Grain-Free-Tortilla-Chips-5-oz-bags-6-Pack_cc895596-1502-466a-9503-e8735e63c75f.78b38d2618f499df8b32bda2ef045c22.jpeg?odnBg=FFFFFF&odnHeight=573&odnWidth=573",
  },
  {
    name: "Siete Shortbread Cookies",
    detail: "Cookie craving",
    score: "8.8",
    imageSrc:
      "https://i5.walmartimages.com/seo/Siete-Family-Foods-Grain-Free-Mexican-Shortbread-Cookies-4-5-oz_c89275e8-ea6c-43c6-9f1d-10e4d9f0f9f3.baf3460c87b4c8b898b9386834c1741f.jpeg?odnBg=FFFFFF&odnHeight=573&odnWidth=573",
  },
  {
    name: "OLIPOP Vintage Cola",
    detail: "Soda craving",
    score: "8.7",
    imageSrc:
      "https://drinkolipop.com/cdn/shop/articles/OLIPOP_SS_12oz_VC_CANGLASS_1x1_b5ab2bbb-0df2-4618-87c7-0c98d82eaec3_300x.jpg?v=1780063814",
  },
  {
    name: "Hu Dark Chocolate Gems",
    detail: "Chocolate craving",
    score: "8.9",
    imageSrc: "https://hukitchen.com/cdn/shop/files/HU_HK.com_FOP_800x.png?v=1766423209",
  },
  {
    name: "LesserEvil Pink Salt Popcorn",
    detail: "Popcorn craving",
    score: "8.6",
    imageSrc:
      "https://www.lesserevil.com/cdn/shop/files/LE_OP_4p6oz_HP_Front_3eee5efe-219f-483b-8c9c-8a90e8062d4d.jpg?v=1746038645&width=2200",
  },
];

function createEmptyOnboardingProfile(): OnboardingProfile {
  return {
    displayName: "Alex Johnson",
    email: "alex.j@example.com",
    mainGoals: [],
    dietPreferences: [],
    foodsToAvoid: [],
    swapStrictness: [],
    completed: false,
  };
}

function canContinueOnboardingStep(step: OnboardingStep, profile: OnboardingProfile): boolean {
  switch (step) {
    case "welcome":
    case "benefits":
    case "scan-swap":
      return true;
    case "main-goal":
      return profile.mainGoals.length > 0;
    case "diet":
      return profile.dietPreferences.length > 0;
    case "avoid":
      return profile.foodsToAvoid.length > 0;
    case "account":
      return isOnboardingProfileReady(profile);
    case "app":
      return false;
  }
}

function isOnboardingProfileReady(profile: OnboardingProfile): boolean {
  return Boolean(profile.mainGoals.length && profile.dietPreferences.length && profile.foodsToAvoid.length);
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
  const [activeTab, setActiveTab] = useState<Tab>("home");
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
  const [browserCameraStatus, setBrowserCameraStatus] = useState("Starting your laptop camera...");
  const [scanCameraMode, setScanCameraMode] = useState<ScanCameraMode>("barcode");
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
  const scanResultRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLElement>(null);
  const historyDetailRequestRef = useRef(0);
  const browserCameraStreamRef = useRef<MediaStream | null>(null);
  const browserCameraRequestRef = useRef(0);

  const qualityScore = useMemo(() => (product ? scoreProduct(product, settings) : null), [product, settings]);
  const alternatives = useMemo(() => (product ? getAlternatives(product) : []), [product]);
  const activityChart = useMemo(() => buildActivityChart(activityDays), [activityDays]);
  const savedSwapKeys = useMemo(
    () => new Set(savedSwapHistory.map((item) => createSavedSwapStateKey(item.scannedProduct.barcode, item.swap.id))),
    [savedSwapHistory],
  );

  useEffect(() => {
    setHistory(loadScanHistory());
    setSavedSwapHistory(loadSavedSwapHistory());
    setSettings(loadSettings());
    setActivityDays(loadActivityDays());
  }, []);

  useEffect(() => {
    return () => {
      stopMediaStream(browserCameraStreamRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "scan" || !product) {
      return;
    }

    scrollScanResultIntoView();
  }, [activeTab, product]);

  useEffect(() => {
    if (activeTab !== "scan") {
      handleBrowserScannerClose();
    }
  }, [activeTab]);

  useEffect(() => {
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0 });
    });
  }, [activeTab, selectedHistoryItem]);

  function scrollScanResultIntoView(): void {
    requestAnimationFrame(() => {
      scanResultRef.current?.scrollIntoView({ block: "start" });
      window.setTimeout(() => {
        scanResultRef.current?.scrollIntoView({ block: "start" });
      }, 80);
    });
  }

  async function handleLookup(input = barcode) {
    const validationError = getBarcodeError(input);

    if (validationError) {
      setProduct(null);
      setError(validationError);
      return;
    }

    const normalized = normalizeBarcode(input);

    setIsLoading(true);
    setError(null);
    setProduct(null);

    try {
      const nextProduct = await fetchProductByBarcode(normalized);
      const nextScore = scoreProduct(nextProduct, settings);
      setProduct(nextProduct);
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
      scrollScanResultIntoView();
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : "Could not fetch this product.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScanWithCamera() {
    if (!isTauriRuntime()) {
      setError("Open the local dev URL in Chrome or Safari to test with your laptop camera, or type the barcode below.");
      return;
    }

    try {
      const scanner = await import("@tauri-apps/plugin-barcode-scanner");
      const permission = await scanner.requestPermissions();

      if (permission !== "granted") {
        setError("Camera permission is required to scan a barcode.");
        return;
      }

      const scanned = await scanner.scan({
        cameraDirection: "back",
        formats: getBarcodeScannerFormats(scanner.Format),
        windowed: false,
      });

      setBarcode(scanned.content);
      await handleLookup(scanned.content);
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Barcode scanner is unavailable on this target.";
      setError(message);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleLookup();
  }

  function startScanSession(mode: ScanCameraMode = "barcode") {
    setShowScanEntry(true);
    setError(null);
    setScanCameraMode(mode);

    if (canUseLaptopCameraPreview()) {
      void startBrowserCameraScanner();
      return;
    }

    setShowBrowserScanner(false);

    if (isTauriRuntime()) {
      void handleScanWithCamera();
      return;
    }

    setError("Camera preview needs browser camera access. Type the barcode below if camera scanning is unavailable.");
  }

  function handleScanFoodPress() {
    startScanSession("food");
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

  async function startBrowserCameraScanner() {
    const requestId = browserCameraRequestRef.current + 1;
    browserCameraRequestRef.current = requestId;

    stopMediaStream(browserCameraStreamRef.current);
    browserCameraStreamRef.current = null;
    setBrowserCameraStream(null);
    setBrowserCameraError(null);
    setBrowserCameraStatus("Starting your laptop camera...");
    setShowBrowserScanner(true);

    try {
      const permissionState = await getBrowserCameraPermissionState();

      if (browserCameraRequestRef.current !== requestId) {
        return;
      }

      if (permissionState === "denied") {
        setBrowserCameraError(getBrowserCameraBlockedMessage());
        setBrowserCameraStatus("Camera permission is blocked.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
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

      setBrowserCameraError(getBrowserCameraErrorMessage(cameraError));
      setBrowserCameraStatus("Camera access did not start.");
    }
  }

  function handleBrowserScannerClose() {
    stopBrowserCameraStream();
    setShowBrowserScanner(false);
    setBrowserCameraError(null);
    setBrowserCameraStatus("Starting your laptop camera...");
  }

  function handleBrowserBarcodeDetected(scannedBarcode: string) {
    stopBrowserCameraStream();
    setShowBrowserScanner(false);
    setShowScanEntry(true);
    setBarcode(scannedBarcode);
    void handleLookup(scannedBarcode);
  }

  function updateStrictSetting(value: boolean) {
    const next = { ...settings, strictSeedOilPenalty: value };
    setSettings(next);
    saveSettings(next);
  }

  function handleTabChange(nextTab: Tab) {
    if (nextTab === "profile" && activeTab !== "profile") {
      setActivityDays(recordActivity("profile_view"));
    }

    if (nextTab !== "scan") {
      setSwapDetail(null);
    }

    if (nextTab !== "history") {
      clearHistoryDetail();
    }

    setActiveTab(nextTab);
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

  function updateOnboardingProfile(updater: (current: OnboardingProfile) => OnboardingProfile) {
    setOnboardingProfile((current) => saveOnboardingProfile({ ...updater(current), completed: false }));
  }

  function handleRestartOnboardingTest() {
    const nextProfile = createEmptyOnboardingProfile();
    setOnboardingProfile(saveOnboardingProfile(nextProfile));
    setOnboardingStep("welcome");
    didRecordLoginThisRuntimeDate = null;
    try {
      sessionStorage.removeItem(LOGIN_ACTIVITY_SESSION_KEY);
    } catch {
      // Session storage is only used to avoid duplicate login activity in a single browser session.
    }
    window.location.reload();
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
      <OnboardingFlow
        step={onboardingStep}
        profile={onboardingProfile}
        onBack={handleOnboardingBack}
        onContinue={handleOnboardingContinue}
        onMainGoalToggle={handleMainGoalToggle}
        onDietPreferenceToggle={handleDietPreferenceToggle}
        onFoodAvoidanceToggle={handleFoodAvoidanceToggle}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] bg-cream text-ink">
      <div className="relative mx-auto flex h-[100dvh] min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-cream shadow-soft md:my-6 md:h-[900px] md:max-h-[calc(100vh-3rem)] md:rounded-[34px]">
        <section ref={contentScrollRef} className="app-scroll-area min-h-0 flex-1 px-5 pb-24 pt-safe-offset">
          <AnimatePresence mode="wait">
            {(activeTab === "home" || activeTab === "scan") && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="min-h-full"
              >
                <DashboardScanScreen
                  mode={activeTab === "scan" ? "scan" : "home"}
                  barcode={barcode}
                  error={error}
                  isLoading={isLoading}
                  showBarcodeEntry={showScanEntry}
                  onBarcodeChange={setBarcode}
                  onSubmit={handleSubmit}
                  onScanMenuPress={handleScanFoodPress}
                  onRestartOnboardingTest={handleRestartOnboardingTest}
                />

                {activeTab === "scan" && product && qualityScore && (
                  <div ref={scanResultRef} className="mt-5">
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
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="min-h-full"
              >
                {selectedHistoryItem ? (
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
                  />
                )}
              </motion.div>
            )}

            {activeTab === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="min-h-full"
              >
                <SearchScreen />
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="min-h-full"
              >
                <ProfileScreen
                  profile={onboardingProfile}
                  chart={activityChart}
                  history={history}
                  onProfileSave={(nextProfile) => {
                    setOnboardingProfile(saveOnboardingProfile(nextProfile));
                  }}
                  onLogOut={() => {
                    const nextProfile = createEmptyOnboardingProfile();
                    setOnboardingProfile(saveOnboardingProfile(nextProfile));
                    setOnboardingStep("welcome");
                    setActiveTab("scan");
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <nav className="shrink-0 border-t border-line bg-white/92 px-4 pb-safe-offset pt-2 shadow-[0_-12px_30px_rgba(0,105,107,0.08)] backdrop-blur">
          <div className="grid grid-cols-5">
            <NavButton
              testId="nav-home"
              active={activeTab === "home"}
              icon={<House size={21} />}
              label="Home"
              onClick={() => handleTabChange("home")}
            />
            <NavButton
              testId="nav-search"
              active={activeTab === "search"}
              icon={<Search size={21} />}
              label="Search"
              onClick={() => handleTabChange("search")}
            />
            <NavButton
              testId="nav-scan"
              active={activeTab === "scan"}
              icon={<Camera size={21} />}
              label="Scan"
              onClick={handleScanTabPress}
            />
            <NavButton
              testId="nav-history"
              active={activeTab === "history"}
              icon={<History size={21} />}
              label="History"
              onClick={() => handleTabChange("history")}
            />
            <NavButton
              testId="nav-profile"
              active={activeTab === "profile"}
              icon={<User size={21} />}
              label="Profile"
              onClick={() => handleTabChange("profile")}
            />
          </div>
        </nav>

        {showBrowserScanner && (
          <BrowserScannerPanel
            mode={scanCameraMode}
            stream={browserCameraStream}
            status={browserCameraStatus}
            error={browserCameraError}
            onModeChange={setScanCameraMode}
            onClose={handleBrowserScannerClose}
            onDetected={handleBrowserBarcodeDetected}
            onRetry={() => void startBrowserCameraScanner()}
          />
        )}
      </div>
    </main>
  );
}

function DashboardScanScreen({
  mode,
  barcode,
  error,
  isLoading,
  showBarcodeEntry,
  onBarcodeChange,
  onSubmit,
  onScanMenuPress,
  onRestartOnboardingTest,
}: {
  mode: "home" | "scan";
  barcode: string;
  error: string | null;
  isLoading: boolean;
  showBarcodeEntry: boolean;
  onBarcodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onScanMenuPress: () => void;
  onRestartOnboardingTest: () => void;
}) {
  const isScanMode = mode === "scan";
  const introTitle = isScanMode ? "Scan a barcode" : "Hello, Alex!";
  const introCopy = isScanMode
    ? "Point your package barcode at the camera to see cleaner swaps."
    : "Ready to make healthy choices today?";

  return (
    <div className="-mx-5 min-h-full bg-[#F8FAFB] pb-6">
      <section className="px-5 pt-5">
        <h2 className="text-[28px] font-black leading-9 text-[#191C1D]">{introTitle}</h2>
        <p className="mt-0.5 text-[16px] font-medium leading-6 text-[#3B4949]">{introCopy}</p>
      </section>

      {!isScanMode && (
        <section className="pt-9">
          <div className="mb-3 flex items-end justify-between px-5">
            <h2 className="text-[24px] font-black leading-8 text-[#191C1D]">Recommended for You</h2>
            <button className="pb-1 text-[14px] font-bold text-[#00696B] transition hover:text-[#004F51]" type="button">
              View all
            </button>
          </div>
          <div className="flex gap-6 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RECOMMENDED_FOODS.map((item) => (
              <RecommendedFoodCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      )}

      {isScanMode && (showBarcodeEntry || error) && (
        <DashboardLookupPanel
          barcode={barcode}
          error={error}
          isLoading={isLoading}
          onBarcodeChange={onBarcodeChange}
          onSubmit={onSubmit}
        />
      )}

      {!isScanMode && (
        <section className="space-y-3 px-5 pt-5">
          <HomeActionButton imageSrc={menuPhoto} label="Scan Menu" icon={<Camera size={19} strokeWidth={2.5} />} onClick={onScanMenuPress} />
          <HomeActionButton imageSrc={recipeBuilderPhoto} label="Recipe Builder" icon={<FileText size={19} strokeWidth={2.5} />} />
        </section>
      )}

      {!isScanMode && (
        <section className="px-5 pt-7">
          <button
            type="button"
            className="mx-auto flex min-h-9 items-center justify-center gap-2 rounded-full border border-[#B7D7D2] bg-white/80 px-4 text-[12px] font-black uppercase tracking-[0.12em] text-[#00696B] shadow-[0_6px_16px_rgba(0,105,107,0.08)] transition hover:bg-[#DDF7EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
            onClick={onRestartOnboardingTest}
          >
            <RefreshCw size={14} strokeWidth={2.6} />
            Test onboarding
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
  onRetry,
}: {
  mode: ScanCameraMode;
  stream: MediaStream | null;
  status: string;
  error: string | null;
  onModeChange: (mode: ScanCameraMode) => void;
  onClose: () => void;
  onDetected: (value: string) => void;
  onRetry: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanTimerRef = useRef(0);
  const isDetectingRef = useRef(false);
  const requestIdRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopDetection = useCallback(() => {
    window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = 0;
    isDetectingRef.current = false;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    stopDetection();
    setLocalError(null);

    if (!stream) {
      return () => {
        requestIdRef.current += 1;
        stopDetection();
      };
    }

    const video = videoRef.current;
    if (!video) {
      return () => {
        requestIdRef.current += 1;
        stopDetection();
      };
    }

    video.srcObject = stream;

    const detector = mode === "barcode" ? createBrowserBarcodeDetector() : null;

    if (mode === "barcode" && !detector) {
      setLocalError("Camera preview is on, but this browser does not expose barcode detection. Try Chrome or Safari with camera permissions enabled.");
    }

    const scanLoop = async () => {
      if (requestIdRef.current !== requestId) {
        return;
      }

      if (isDetectingRef.current) {
        scanTimerRef.current = window.setTimeout(scanLoop, 180);
        return;
      }

      if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        scanTimerRef.current = window.setTimeout(scanLoop, 180);
        return;
      }

      isDetectingRef.current = true;

      try {
        if (!detector) {
          return;
        }

        const detections = await detector.detect(videoRef.current);
        const match = detections.find((item) => item.rawValue?.trim());

        if (match?.rawValue) {
          requestIdRef.current += 1;
          stopDetection();
          onDetectedRef.current(match.rawValue.trim());
          return;
        }
      } catch (detectError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setLocalError(getBrowserCameraErrorMessage(detectError));
        stopDetection();
        return;
      } finally {
        isDetectingRef.current = false;
      }

      scanTimerRef.current = window.setTimeout(scanLoop, 180);
    };

    void video.play().then(
      () => {
        if (requestIdRef.current === requestId) {
          if (mode === "barcode" && detector) {
            scanTimerRef.current = window.setTimeout(scanLoop, 180);
          }
        }
      },
      (playError: unknown) => {
        if (requestIdRef.current === requestId) {
          setLocalError(getBrowserCameraErrorMessage(playError));
          stopDetection();
        }
      },
    );

    return () => {
      requestIdRef.current += 1;
      stopDetection();
    };
  }, [mode, stopDetection, stream]);

  const displayError = error ?? localError;
  const isBarcodeMode = mode === "barcode";
  const panelTitle = isBarcodeMode ? "Scan a barcode" : "Scan food";

  return (
    <section
      className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={panelTitle}
    >
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" autoPlay muted playsInline />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.64)_0%,rgba(0,0,0,0.18)_40%,rgba(0,0,0,0.74)_100%)]" />

      <header className="relative z-10 flex flex-col items-start px-5 pt-[calc(env(safe-area-inset-top)+18px)]">
        <button
          className="shrink-0 rounded-full border border-white/25 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
        <div className="mt-5 min-w-0">
          <div className="inline-flex rounded-full border border-white/18 bg-black/34 p-1 shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur-md">
            <ScanModeButton active={isBarcodeMode} label="Barcode scan" onClick={() => onModeChange("barcode")} />
            <ScanModeButton active={!isBarcodeMode} label="Scan food" onClick={() => onModeChange("food")} />
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
        {isBarcodeMode && (
          <div
            className="h-[132px] w-[min(82vw,340px)] rounded-[24px] border-[3px] border-dashed border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
            aria-hidden="true"
          />
        )}
      </div>

      {displayError && (
        <div className="relative z-10 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <div className="rounded-[14px] bg-[#FFD9D4] px-3 py-2 text-sm font-semibold text-[#7A1F13] shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>{displayError}</span>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#8A1F15] px-4 text-sm font-black text-white transition hover:bg-[#6F170F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A1F15]/35"
              onClick={onRetry}
            >
              Try camera again
            </button>
          </div>
        </div>
      )}
    </section>
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

function RecommendedFoodCard({
  item,
}: {
  item: {
    name: string;
    detail: string;
    score: string;
    imageSrc: string;
  };
}) {
  return (
    <button
      type="button"
      className="w-64 shrink-0 overflow-hidden rounded-xl border border-[#DDE8E9] bg-white text-left shadow-[0_4px_18px_rgba(0,105,107,0.06)] transition active:scale-[0.98]"
    >
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-white">
        <img className="h-full w-full object-contain p-4 transition duration-300 hover:scale-[1.03]" src={item.imageSrc} alt="" />
        <span className="absolute right-3 top-3 rounded-full bg-[#AEEED8] px-3 py-1 text-[12px] font-bold leading-4 text-[#316D5B]">
          {item.score}
        </span>
      </div>
      <div className="px-3 py-3">
        <h3 className="truncate text-[15px] font-semibold leading-5 text-[#191C1D]">{item.name}</h3>
        <p className="truncate text-[13px] font-medium leading-4 text-[#3B4949]">{item.detail}</p>
      </div>
    </button>
  );
}

function HomeActionButton({ imageSrc, label, icon, onClick }: { imageSrc: string; label: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="group flex h-[96px] w-full items-center overflow-hidden rounded-[18px] border border-[#D6E5E4] bg-white text-left shadow-[0_10px_28px_rgba(0,105,107,0.09)] transition hover:border-[#86CFCB] hover:shadow-[0_14px_32px_rgba(0,105,107,0.13)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
      onClick={onClick}
    >
      <span className="h-full w-[122px] shrink-0 overflow-hidden bg-[#EAF4EE]">
        <img className="h-full w-full object-cover transition duration-300 group-hover:scale-105" src={imageSrc} alt="" />
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4">
        <span className="text-[20px] font-black leading-6 text-[#191C1D]">{label}</span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00696B] text-white shadow-[0_10px_20px_rgba(0,105,107,0.22)]">
          {icon}
        </span>
      </span>
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
    <form className="mx-5 mt-4 rounded-2xl border border-[#DDE8E9] bg-white/82 p-4 shadow-[0_8px_24px_rgba(0,105,107,0.08)] backdrop-blur" onSubmit={onSubmit}>
      <label className="text-[11px] font-black uppercase leading-4 tracking-[0.18em] text-[#00696B]" htmlFor="dashboard-barcode">
        UPC or EAN
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="dashboard-barcode"
          inputMode="numeric"
          className="min-w-0 flex-1 rounded-[14px] border border-[#D9E4E5] bg-[#F8FAFB] px-4 py-3 text-base font-bold text-[#1F2629] outline-none transition placeholder:text-[#667080] focus:border-[#00C5C8] focus:ring-2 focus:ring-[#00C5C8]/20"
          placeholder="5449000000996"
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
        />
        <button
          type="submit"
          className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-gradient-to-r from-[#12C8CA] to-[#007A79] text-white shadow-[0_12px_24px_rgba(0,128,128,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 disabled:opacity-60"
          disabled={isLoading}
          aria-label="Search barcode"
        >
          {isLoading ? <Loader2 className="animate-spin" size={21} /> : <Search size={21} />}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-[#DDF7EF] px-3 py-2 text-sm font-semibold text-[#00696B]">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}

function DashboardStatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "blue" | "green" }) {
  const colors =
    tone === "blue"
      ? "border-[#8BC3CA]/45 bg-[#DFF1F4] text-[#2D666D]"
      : "border-[#AEEED8]/55 bg-[#E8F7F2] text-[#2C6956]";

  return (
    <div className={`min-h-[126px] rounded-2xl border p-6 ${colors}`}>
      <div className="mb-5">{icon}</div>
      <p className="text-[12px] font-bold leading-4">{label}</p>
      <p className="mt-0.5 text-[14px] font-black leading-5 text-[#191C1D]">{value}</p>
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
}: {
  history: ScanHistoryItem[];
  savedSwapHistory: SavedSwapHistoryItem[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onItemSelect: (item: ScanHistoryItem) => void;
  onSavedSwapSelect: (item: SavedSwapHistoryItem) => void;
}) {
  const filteredHistory = filterHistoryItems(history, filter);
  const savedSwapGroups = groupSavedSwapHistory(savedSwapHistory);
  const isSwapFilter = filter === "swaps";

  return (
    <div className="-mx-5 min-h-full bg-[#F8FAFB] pb-10">
      <div className="px-5 pb-2 pt-8">
        <h2 className="text-[32px] font-black leading-tight text-[#191C1D]">My Scans</h2>
        <p className="mt-1 text-[18px] font-medium leading-7 text-[#3B4949]">Review your nutritional history</p>
      </div>

      <div className="sticky top-0 z-10 border-b border-[#BAC9C9]/40 bg-[#F8FAFB]/90 px-5 pt-5 backdrop-blur">
        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-10">
            <HistoryFilterButton active={filter === "all"} label="All" onClick={() => onFilterChange("all")} />
            <HistoryFilterButton active={filter === "saved"} label="Saved" onClick={() => onFilterChange("saved")} />
            <HistoryFilterButton active={filter === "this-week"} label="This Week" onClick={() => onFilterChange("this-week")} />
            <HistoryFilterButton active={filter === "swaps"} label="Swaps" onClick={() => onFilterChange("swaps")} />
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 pt-10">
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#DDF7EF] text-[#00696B]">{icon}</div>
      <h3 className="mt-5 text-2xl font-black text-[#191C1D]">{title}</h3>
      <p className="mt-2 max-w-[280px] text-sm font-semibold leading-6 text-[#566164]">{copy}</p>
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
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.barcode} className="overflow-hidden rounded-xl border border-[#DDE8E9] bg-white/75 shadow-[0_4px_20px_rgba(0,105,107,0.08)] backdrop-blur">
          <div className="flex items-center gap-3 bg-[#EEF7F8] p-3">
            <HistoryThumb imageUrl={group.scannedProduct.imageUrl} name={group.scannedProduct.name} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00696B]">Scanned item</p>
              <h3 className="mt-1 truncate text-[17px] font-black leading-6 text-[#191C1D]">{group.scannedProduct.name}</h3>
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
  const swapName = item.swap.brand ? `${item.swap.brand} ${item.swap.name}` : item.swap.name;
  const meta = item.swap.brand ? `${item.swap.brand} - ${item.swap.category}` : item.swap.category;

  return (
    <button
      type="button"
      className="grid w-full grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-[10px] border border-[#DDE8E9] bg-white p-3 text-left transition hover:bg-[#F8FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      aria-label={`View saved swap ${swapName}`}
    >
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] bg-[#DDF7EF] text-[#00696B]">
        <Apple size={24} strokeWidth={1.9} />
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-[0.14em] text-[#00696B]">{meta}</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#DDE8E9] bg-[#F8FAFB] px-2 py-0.5 text-[11px] font-black text-[#191C1D]">
            <DollarSign size={11} />
            Est. {item.swap.estimatedPrice}
          </span>
        </div>
        <h4 className="mt-1 line-clamp-2 text-[16px] font-black leading-5 text-[#191C1D]">{swapName}</h4>
        <p className="mt-1 text-xs font-black leading-4 text-[#566164]">{item.swap.scoreHint}</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[#566164]">{item.swap.reason}</p>
        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#00696B]">Saved {formatCompactHistoryDateTime(item.savedAt)}</p>
      </div>
    </button>
  );
}

function ProfileScreen({
  profile,
  chart,
  history,
  onProfileSave,
  onLogOut,
}: {
  profile: OnboardingProfile;
  chart: ActivityChart;
  history: ScanHistoryItem[];
  onProfileSave: (profile: OnboardingProfile) => void;
  onLogOut: () => void;
}) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftProfile, setDraftProfile] = useState<OnboardingProfile>(profile);
  const streakLabel = chart.currentStreak === 1 ? "1 Day" : `${chart.currentStreak} Days`;
  const metrics = [
    { label: "Age", value: "28", suffix: "Years", tone: "text-[#00696B]" },
    { label: "Weight", value: "75kg", suffix: "Current", tone: "text-[#00696B]" },
    { label: "Height", value: "180cm", suffix: "Centimeters", tone: "text-[#00696B]" },
    { label: "Goal", value: "Bulking", suffix: "Active", tone: "text-[#2C6956]" },
  ];
  const settingsItems = [
    { label: "Notifications", icon: <Bell size={21} strokeWidth={1.9} />, danger: false },
    { label: "Privacy Policy", icon: <Shield size={21} strokeWidth={1.9} />, danger: false },
    { label: "Terms of Service", icon: <FileText size={21} strokeWidth={1.9} />, danger: false },
    { label: "Data & Storage", icon: <Database size={21} strokeWidth={1.9} />, danger: false },
  ];

  function openEditProfile() {
    setDraftProfile(profile);
    setIsEditingProfile(true);
  }

  function closeEditProfile() {
    setDraftProfile(profile);
    setIsEditingProfile(false);
  }

  function saveProfileDraft() {
    const nextProfile = {
      ...draftProfile,
      displayName: draftProfile.displayName.trim(),
      email: draftProfile.email.trim().toLowerCase(),
      completed: isOnboardingProfileReady(draftProfile),
    };

    onProfileSave(nextProfile);
    setIsEditingProfile(false);
  }

  function updateDraftProfile(updater: (current: OnboardingProfile) => OnboardingProfile) {
    setDraftProfile((current) => updater(current));
  }

  return (
    <div className="-mx-5 min-h-full bg-[#F8FAFB] pb-8">
      <section className="flex flex-col items-center px-5 pt-5 text-center">
        <div className="relative">
          <div className="h-[120px] w-[120px] overflow-hidden rounded-full border-4 border-[#AEEED8] bg-white shadow-[0_16px_34px_rgba(0,105,107,0.10)]">
            <img className="h-full w-full object-cover" src={profilePhoto} alt={profile.displayName} />
          </div>
          <button
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#00696B] text-white shadow-[0_10px_22px_rgba(0,105,107,0.24)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/45"
            type="button"
            aria-label="Edit avatar"
          >
            <Pencil size={15} strokeWidth={3} />
          </button>
        </div>
        <h2 className="mt-3 text-[24px] font-black leading-8 text-[#191C1D]">{profile.displayName}</h2>
        <p className="text-[16px] font-medium leading-6 text-[#3B4949]">{profile.email}</p>
        <button
          className="mt-5 min-h-11 rounded-full border-2 border-[#00BFC3] px-8 text-[15px] font-semibold text-[#00696B] transition hover:bg-[#E8FDFD] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
          type="button"
          onClick={openEditProfile}
        >
          Edit Profile
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 px-5 pt-7">
        <DashboardStatCard icon={<Clock size={25} />} label="Last Scan" value={formatLastScanSummary(history)} tone="blue" />
        <DashboardStatCard icon={<Leaf size={26} />} label="Health Streak" value={streakLabel} tone="green" />
      </section>

      <section className="px-5 pt-8">
        <h3 className="mb-3 text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">Login Activity</h3>
        <ActivityCard chart={chart} />
      </section>

      <section className="px-5 pt-7">
        <h3 className="mb-3 text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">Health Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex min-h-[116px] flex-col items-center justify-center rounded-xl border border-[#DDE8E9] bg-white/72 px-3 text-center shadow-[0_4px_20px_rgba(0,105,107,0.05)] backdrop-blur"
            >
              <p className="text-[12px] font-bold leading-4 text-[#3B4949]">{metric.label}</p>
              <p className={`mt-3 text-[25px] font-black leading-8 ${metric.tone}`}>{metric.value}</p>
              <p className="mt-2 text-[12px] font-bold leading-4 text-[#6B7A7A]">{metric.suffix}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pt-7">
        <h3 className="mb-3 text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">Account Settings</h3>
        <div className="overflow-hidden rounded-xl border border-[#DDE8E9] bg-white/70 shadow-[0_4px_20px_rgba(0,105,107,0.05)] backdrop-blur">
          {settingsItems.map((item) => (
            <ProfileSettingsRow key={item.label} label={item.label} icon={item.icon} />
          ))}
          <ProfileSettingsRow label="Log Out" icon={<LogOut size={21} strokeWidth={1.9} />} danger onClick={onLogOut} />
        </div>
      </section>

      <AnimatePresence>
        {isEditingProfile && (
          <EditProfileSheet
            key="edit-profile-sheet"
            draftProfile={draftProfile}
            onDraftChange={updateDraftProfile}
            onClose={closeEditProfile}
            onSave={saveProfileDraft}
          />
        )}
      </AnimatePresence>
    </div>
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
  const dialogRef = useRef<HTMLElement>(null);
  const nameError = getProfileNameError(draftProfile.displayName);
  const emailError = getProfileEmailError(draftProfile.email);
  const canSave = !nameError && !emailError && isOnboardingProfileReady(draftProfile);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#001B1C]/35 px-0 backdrop-blur-[2px]"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <button className="absolute inset-0 cursor-default" type="button" tabIndex={-1} aria-label="Close edit profile" onClick={onClose} />
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] bg-[#F8FAFB] shadow-[0_-24px_60px_rgba(0,44,45,0.22)] md:mb-6 md:rounded-[28px]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="shrink-0 border-b border-[#DDE8E9] bg-white/95 px-5 pb-4 pt-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#C4D6D8]" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#00696B]">Profile</p>
              <h2 id="edit-profile-title" className="text-[22px] font-black leading-7 text-[#191C1D]">
                Edit Profile
              </h2>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF7F8] text-[#3B4949] transition hover:bg-[#DDF7EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
              aria-label="Close edit profile"
              onClick={onClose}
            >
              <CircleX size={22} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">Account</h3>
            <div className="mt-3 space-y-3">
              <ProfileTextField
                label="Name"
                value={draftProfile.displayName}
                autoComplete="name"
                maxLength={80}
                error={nameError}
                onChange={(value) => onDraftChange((current) => ({ ...current, displayName: value }))}
              />
              <ProfileTextField
                label="Email"
                value={draftProfile.email}
                type="email"
                autoComplete="email"
                maxLength={160}
                error={emailError}
                onChange={(value) => onDraftChange((current) => ({ ...current, email: value }))}
              />
            </div>
          </section>

          <EditProfileChoiceSection
            className="mt-6"
            title="Goals"
            emptyMessage="Choose at least one goal."
            options={MAIN_GOAL_OPTIONS}
            values={draftProfile.mainGoals}
            onToggle={handleMainGoalToggle}
          />

          <EditProfileChoiceSection
            className="mt-6"
            title="Diet"
            emptyMessage="Choose at least one diet preference."
            options={DIET_OPTIONS}
            values={draftProfile.dietPreferences}
            onToggle={handleDietPreferenceToggle}
          />

          <EditProfileChoiceSection
            className="mt-6"
            title="Avoid"
            emptyMessage="Choose at least one ingredient preference."
            options={FOOD_AVOIDANCE_OPTIONS}
            values={draftProfile.foodsToAvoid}
            onToggle={handleFoodAvoidanceToggle}
          />
        </div>

        <footer className="grid shrink-0 grid-cols-[0.82fr_1.18fr] gap-3 border-t border-[#DDE8E9] bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
          <button
            type="button"
            className="flex h-12 items-center justify-center rounded-[14px] border border-[#C9DCDD] text-[15px] font-black text-[#3B4949] transition hover:bg-[#EEF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`flex h-12 items-center justify-center rounded-[14px] text-[15px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 ${
              canSave
                ? "bg-gradient-to-r from-[#12C8CA] to-[#007A79] text-white shadow-[0_12px_24px_rgba(0,128,128,0.18)] active:translate-y-px"
                : "bg-[#D6E0E2] text-[#8B9A9C]"
            }`}
            disabled={!canSave}
            onClick={onSave}
          >
            Save changes
          </button>
        </footer>
      </motion.section>
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
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-black leading-5 text-[#3B4949]">{label}</span>
      <input
        className={`h-12 w-full rounded-[14px] border bg-white px-4 text-[15px] font-bold text-[#191C1D] outline-none transition placeholder:text-[#9BA5A7] focus:border-[#00AEB1] focus:ring-2 focus:ring-[#00C5C8]/20 ${
          error ? "border-[#D8574E]" : "border-[#D9E4E5]"
        }`}
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={`mt-1 block min-h-4 text-[12px] font-bold leading-4 ${error ? "text-[#BA1A1A]" : "text-transparent"}`}>
        {error || "Valid"}
      </span>
    </label>
  );
}

function EditProfileChoiceSection<T extends string>({
  title,
  emptyMessage,
  options,
  values,
  onToggle,
  className = "",
}: {
  title: string;
  emptyMessage: string;
  options: Array<ChoiceOption<T>>;
  values: T[];
  onToggle: (value: T) => void;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-3">
        <h3 className="text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">{title}</h3>
        {values.length === 0 && <p className="text-right text-[12px] font-bold leading-4 text-[#BA1A1A]">{emptyMessage}</p>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = values.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              className={`flex min-h-[68px] min-w-0 items-center gap-2 rounded-[14px] border p-2.5 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 ${
                isSelected
                  ? "border-[#009A9D] bg-[#E1FAF4] shadow-[0_8px_20px_rgba(0,105,107,0.10)]"
                  : "border-[#D9E4E5] bg-white hover:border-[#00C5C8]"
              }`}
              onClick={() => onToggle(option.value)}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${option.tint}`}>{option.icon}</span>
              <span className="min-w-0 flex-1 text-[13px] font-black leading-[1.18] text-[#191C1D]">{option.label}</span>
              {isSelected && <CheckCircle2 className="shrink-0 text-[#00696B]" size={17} strokeWidth={2.6} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getProfileNameError(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Name is required.";
  }

  if (trimmedValue.length > 80) {
    return "Name must be 80 characters or less.";
  }

  return "";
}

function getProfileEmailError(value: string): string {
  const email = value.trim().toLowerCase();

  if (!email) {
    return "Email is required.";
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
      className={`flex min-h-[72px] w-full items-center justify-between border-b border-[#DDE8E9]/70 px-7 text-left transition last:border-b-0 hover:bg-[#EEF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00C5C8]/35 ${
        danger ? "text-[#BA1A1A] hover:bg-[#FFDAD6]/35" : "text-[#191C1D]"
      }`}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-5">
        <span className={danger ? "text-[#BA1A1A]" : "text-[#3B4949]"}>{icon}</span>
        <span className="truncate text-[16px] font-medium leading-6">{label}</span>
      </span>
      <ChevronRight className={danger ? "text-[#F0B8B8]" : "text-[#BAC9C9]"} size={22} strokeWidth={2.2} />
    </button>
  );
}

function HistoryFilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`relative pb-4 text-[16px] font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAFB] ${
        active ? "text-[#00696B]" : "text-[#273737] hover:text-[#00696B]"
      }`}
      onClick={onClick}
    >
      {label}
      {active && <span className="absolute bottom-[-2px] left-0 h-[3px] w-full rounded-full bg-[#00696B]" />}
    </button>
  );
}

function HistoryScanCard({ item, onSelect }: { item: ScanHistoryItem; onSelect: () => void }) {
  const tags = historyItemTags(item);

  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-xl border border-[#DDE8E9] bg-white/75 p-3 text-left shadow-[0_4px_20px_rgba(0,105,107,0.08)] backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <HistoryThumb imageUrl={item.imageUrl} name={item.productName} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[17px] font-semibold leading-6 text-black">{item.productName}</h3>
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
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#B1EFD8] to-[#00696B]/25">
      {imageUrl ? (
        <img className="h-full w-full object-cover" src={imageUrl} alt={name} />
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
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F8FAFB] text-[16px] font-black" style={{ color: accentColor }}>
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
  const swapName = item.swap.brand ? `${item.swap.brand} ${item.swap.name}` : item.swap.name;
  const meta = item.swap.brand ? `${item.swap.brand} - ${item.swap.category}` : item.swap.category;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oat text-ink outline-none transition hover:bg-line focus-visible:ring-2 focus-visible:ring-leaf/35"
          onClick={onBack}
          aria-label="Back to saved swaps"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-leaf">Saved swap</p>
          <h2 className="mt-1 truncate text-xl font-black">{swapName}</h2>
        </div>
      </div>

      <div className="bento-card overflow-hidden">
        <div className="bg-oat p-5">
          <div className="mx-auto flex aspect-square max-h-[190px] w-full max-w-[190px] items-center justify-center overflow-hidden rounded-[8px] bg-cream/80 text-leaf">
            <Apple size={64} strokeWidth={1.9} />
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{meta}</p>
            <h3 className="mt-1 text-xl font-black leading-tight">{swapName}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#DDF7EF] px-3 py-1 text-xs font-black text-[#00696B]">{item.swap.scoreHint}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-cream px-3 py-1 text-xs font-black text-ink">
                <DollarSign size={13} />
                Est. {item.swap.estimatedPrice}
              </span>
            </div>
          </div>

          <p className="text-sm font-semibold leading-6 text-muted">{item.swap.reason}</p>
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oat text-ink outline-none transition hover:bg-line focus-visible:ring-2 focus-visible:ring-leaf/35"
          onClick={onBack}
          aria-label="Back to scan history"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-leaf">History detail</p>
          <h2 className="mt-1 truncate text-xl font-black">{detailName}</h2>
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
    <div className="bento-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black">{title}</h3>
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-oat hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/35"
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
    <div className="grid gap-1 rounded-[8px] border border-line bg-cream px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="break-words text-sm font-bold leading-5">{value}</p>
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
            <div className="space-y-3">
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
    <article className={`bento-card overflow-hidden border ${isSaved ? "border-leaf/50" : "border-transparent"}`}>
      <button
        type="button"
        className="grid w-full grid-cols-[82px_minmax(0,1fr)] gap-3 p-4 text-left outline-none transition hover:bg-oat/45 focus-visible:ring-2 focus-visible:ring-leaf/35"
        onClick={onOpenDetail}
        aria-label={`View details for ${alternativeName}`}
      >
        <div className="flex h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[8px] bg-oat text-leaf">
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
          <h3 className="mt-1 line-clamp-2 text-base font-black leading-5 text-ink">{alternativeName}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-black text-muted">{scoreHint}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-cream px-2.5 py-1 text-xs font-black text-ink">
              <DollarSign size={13} />
              Est. {estimatedPrice}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-muted">{alternative.reason}</p>
          <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-ink">{similarity}</p>
        </div>
      </button>

      <div className="border-t border-line bg-cream px-4 py-3">
        <button
          type="button"
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-[8px] text-sm font-black outline-none transition focus-visible:ring-2 focus-visible:ring-leaf/35 ${
            isSaved
              ? "bg-leaf text-white shadow-[0_10px_20px_rgba(13,83,14,0.16)]"
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oat text-ink transition hover:bg-line"
          onClick={onBack}
          aria-label="Back to swap comparison"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className={`text-xs font-black uppercase tracking-[0.2em] ${originalIsLowerQuality ? "text-ink" : "text-leaf"}`}>
            {detailLabel}
          </p>
          <h2 className="mt-1 truncate text-xl font-black">{detailTitle}</h2>
        </div>
      </div>

      <div className="bento-card overflow-hidden">
        <div className={`${originalIsLowerQuality ? "bg-sky" : "bg-oat"} p-5`}>
          <div className="mx-auto flex aspect-square max-h-[220px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[8px] bg-cream/70">
            {imageUrl ? <img className="h-full w-full object-contain p-4" src={imageUrl} alt={name} /> : <Apple className="text-leaf" size={64} />}
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{meta}</p>
            <h3 className="mt-1 text-xl font-black leading-tight">{name}</h3>
          </div>

          <p className="text-sm font-semibold leading-6 text-muted">{reason}</p>

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

function alternativeImageFor(alternative: AlternativeProduct): string | undefined {
  return alternative.id === FALLBACK_SWAP.id ? boulderCanyonChips : undefined;
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
    <div className="bento-card overflow-hidden p-4">
      <div className="flex items-center justify-between gap-4">
        {currentWeekRange && <p className="whitespace-nowrap text-[11px] font-black text-leaf">Current week: {currentWeekRange}</p>}
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-oat hover:text-ink"
          onClick={() => setIsExpanded((value) => !value)}
          aria-label={isExpanded ? "Hide full activity history" : "Show full activity history"}
          aria-expanded={isExpanded}
        >
          <ChevronRight className={`transition-transform duration-300 ease-out ${isExpanded ? "rotate-90" : ""}`} size={22} />
        </button>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-7 gap-2 rounded-full bg-berry p-1">
          {chart.currentWeek.map((day) => {
            const hasActivity = day.count > 0;
            const isMissedLogin = !hasActivity && !day.isFuture;
            return (
              <span
                key={day.date}
                aria-label={`${day.date}: ${day.count} activity point${day.count === 1 ? "" : "s"}`}
                className={`flex h-9 w-9 justify-self-center items-center justify-center rounded-full ${hasActivity ? "bg-[#5E8E45]" : compactActivityColor(day.level, day.isFuture)}`}
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
      <div ref={scrollerRef} className="overflow-x-auto pb-2" aria-label="Daily activity over the last 53 weeks">
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
        <div className="bg-gradient-to-br from-[#12C8CA] to-[#007A79] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/85">Barcode</p>
          <h2 className="mt-3 text-2xl font-black leading-tight">Scan an ingredient label fast</h2>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#00696B] shadow-[0_12px_24px_rgba(0,105,107,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-white/70"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onCameraScan}
          >
            <Camera size={17} />
            Camera
          </button>
        </div>
        <div className="flex items-center justify-center bg-[#DDF7EF] p-4">
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
            className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-gradient-to-r from-[#12C8CA] to-[#007A79] text-white shadow-[0_12px_24px_rgba(0,128,128,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 disabled:opacity-60"
            onMouseDown={(event) => event.preventDefault()}
            disabled={isLoading}
            aria-label="Search barcode"
          >
            {isLoading ? <Loader2 className="animate-spin" size={21} /> : <Search size={21} />}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-[8px] bg-[#DDF7EF] px-3 py-2 text-sm font-semibold text-[#00696B]">
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
    <div className="grid grid-cols-2 gap-3">
      <div className="bento-card bg-white p-4">
        <Apple className="mb-5 text-leaf" size={30} />
        <h2 className="text-lg font-black">Ingredient-first</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Scores focus on processing and ingredient quality.</p>
      </div>
      <div className="bento-card bg-white p-4">
        <CheckCircle2 className="mb-5 text-coral" size={30} />
        <h2 className="text-lg font-black">Clear swaps</h2>
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
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-4">
      <div className="bento-card p-4">
        <div className="flex gap-4">
          <ProductThumb imageUrl={product.imageUrl} name={product.name} large />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-leaf">{product.brand ?? "Open Food Facts"}</p>
            <h2 className="mt-2 line-clamp-2 text-xl font-black leading-tight">{product.name}</h2>
            <p className="mt-2 line-clamp-1 text-xs font-bold text-muted">{product.categoriesText ?? product.barcode}</p>
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
      <p className="text-xs font-black uppercase tracking-[0.22em] text-leaf">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
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
      className="group mx-0.5 flex h-[62px] flex-col items-center justify-center gap-1 rounded-full px-1 text-xs font-black text-[#3B4949] outline-none transition focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className={`flex h-6 w-6 items-center justify-center transition-colors ${active ? "text-[#0D8F68]" : "text-current group-hover:text-[#00696B]"}`}>{icon}</span>
      <span className="text-[#3B4949]">{label}</span>
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

function activityCellColor(level: number, isFuture: boolean): string {
  if (isFuture) return "bg-[#F7FAFB]";
  if (level <= 0) return "bg-[#EAF4EE]";
  if (level === 1) return "bg-[#0D8F4F]";
  if (level === 2) return "bg-[#31A863]";
  if (level === 3) return "bg-[#5DBB73]";
  return "bg-[#86D695]";
}

function compactActivityColor(level: number, isFuture: boolean): string {
  if (isFuture) return "bg-cream/20";
  if (level <= 0) return "bg-[#EAF4EE]";
  if (level === 1) return "bg-[#0D8F4F]";
  if (level === 2) return "bg-[#31A863]";
  if (level === 3) return "bg-[#5DBB73]";
  return "bg-[#86D695]";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function canUseLaptopCameraPreview(): boolean {
  return isBrowserCameraPreviewSupported() && !isLikelyMobileRuntime();
}

function isLikelyMobileRuntime(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
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
