import { AlertTriangle, CheckCircle2, ChevronLeft, HelpCircle, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { rankMenuDishes } from "../lib/menuRecommendations";
import type {
  FoodAvoidance,
  MenuAnalysis,
  MenuConcern,
  MenuCravingCategory,
  MenuDishRecommendation,
  MenuEvidenceLevel,
} from "../types";

const CATEGORY_LABELS: Record<MenuCravingCategory, string> = {
  burgers: "Burgers",
  chicken: "Chicken",
  pizza: "Pizza",
  tacos: "Tacos",
  bowls: "Bowls",
  salads: "Salads",
  sides: "Sides",
  drinks: "Drinks",
  desserts: "Something sweet",
  other: "Something else",
};

const CONCERN_LABELS: Record<MenuConcern, string> = {
  "added-sugar": "Added sugar likely",
  dairy: "May contain dairy",
  fried: "Fried preparation",
  gluten: "May contain gluten",
  "high-sodium": "Higher sodium likely",
  "processed-meat": "Processed meat",
  "seed-oil-likely": "Cooking oil is unverified",
};

export function MenuResults({
  analysis,
  foodsToAvoid,
  onRescan,
}: {
  analysis: MenuAnalysis;
  foodsToAvoid: FoodAvoidance[];
  onRescan: () => void;
}) {
  const [craving, setCraving] = useState<MenuCravingCategory | null>(null);
  const [selectedDish, setSelectedDish] = useState<MenuDishRecommendation | null>(null);
  const categories = useMemo(
    () => Array.from(new Set(analysis.dishes.map((dish) => dish.category))).sort((left, right) => CATEGORY_LABELS[left].localeCompare(CATEGORY_LABELS[right])),
    [analysis.dishes],
  );
  const recommendations = useMemo(
    () => (craving ? rankMenuDishes({ dishes: analysis.dishes, craving, foodsToAvoid }) : []),
    [analysis.dishes, craving, foodsToAvoid],
  );

  useEffect(() => {
    setCraving(null);
    setSelectedDish(null);
  }, [analysis.id]);

  if (selectedDish) {
    return <MenuDishDetail dish={selectedDish} onBack={() => setSelectedDish(null)} />;
  }

  return (
    <section className="mx-5 mt-4 overflow-hidden rounded-[22px] border border-[#B7D7D2] bg-white shadow-[0_12px_30px_rgba(0,105,107,0.10)]">
      <header className="border-b border-[#DDE8E9] bg-[#EEF8F5] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#00696B]">Menu analyzed</p>
            <h3 className="mt-1 text-xl font-black text-[#191C1D]">{analysis.restaurantName ?? "Restaurant menu"}</h3>
            <p className="mt-1 text-sm font-semibold text-[#566164]">
              {analysis.dishes.length} dishes · {analysis.pageCount} page{analysis.pageCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#B7D7D2] bg-white text-[#00696B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
            onClick={onRescan}
            aria-label="Scan a different menu"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      {!craving ? (
        <div className="p-4">
          <h4 className="text-[22px] font-black leading-7 text-[#191C1D]">What sounds good?</h4>
          <p className="mt-1 text-sm font-semibold leading-5 text-[#566164]">We’ll keep the same craving and surface the better matches.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className="min-h-12 rounded-xl border border-[#D5E5E2] bg-[#F8FAFB] px-3 text-left text-sm font-black text-[#294A4B] transition hover:border-[#00A8AB] hover:bg-[#EEF8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
                onClick={() => setCraving(category)}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1 rounded-full bg-[#EEF7F8] px-3 text-xs font-black text-[#00696B]"
            onClick={() => setCraving(null)}
          >
            <ChevronLeft size={15} /> Change craving
          </button>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#00696B]">Closest better matches</p>
              <h4 className="mt-1 text-2xl font-black text-[#191C1D]">{CATEGORY_LABELS[craving]}</h4>
            </div>
            <span className="text-xs font-bold text-[#6B7B7C]">Best fit first</span>
          </div>

          <div className="mt-4 space-y-3">
            {recommendations.slice(0, 5).map((dish, index) => (
              <button
                key={dish.id}
                type="button"
                className="w-full rounded-2xl border border-[#DDE8E9] bg-white p-4 text-left shadow-[0_5px_16px_rgba(0,105,107,0.06)] transition hover:border-[#86CFCB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
                onClick={() => setSelectedDish(dish)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-[0.13em] text-[#16806F]">
                      {index === 0 ? "Closest better choice" : dish.cravingMatch === "closest" ? "Same craving" : "Related option"}
                    </span>
                    <span className="mt-1 block text-lg font-black leading-6 text-[#191C1D]">{dish.name}</span>
                  </span>
                  {dish.price && <span className="shrink-0 text-sm font-black text-[#294A4B]">{dish.price}</span>}
                </span>
                <span className="mt-1.5 line-clamp-2 block text-sm font-semibold leading-5 text-[#566164]">{dish.description}</span>
                <span className="mt-3 block rounded-xl bg-[#EEF8F5] px-3 py-2 text-xs font-bold leading-5 text-[#315354]">{dish.reason}</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {dish.positives.slice(0, 2).map((positive) => (
                    <span key={positive} className="rounded-full bg-[#DDF7EF] px-2.5 py-1 text-[11px] font-black text-[#246854]">
                      {positive}
                    </span>
                  ))}
                  {dish.concerns.slice(0, 1).map((concern) => (
                    <span key={concern} className="rounded-full bg-[#FFF4D6] px-2.5 py-1 text-[11px] font-black text-[#775916]">
                      {CONCERN_LABELS[concern]}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MenuDishDetail({ dish, onBack }: { dish: MenuDishRecommendation; onBack: () => void }) {
  const serverQuestions = getServerQuestions(dish.concerns);

  return (
    <section className="mx-5 mt-4 overflow-hidden rounded-[22px] border border-[#B7D7D2] bg-white shadow-[0_12px_30px_rgba(0,105,107,0.10)]">
      <header className="border-b border-[#DDE8E9] bg-[#EEF8F5] p-4">
        <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-full bg-white px-3 text-xs font-black text-[#00696B]" onClick={onBack}>
          <ChevronLeft size={15} /> Menu matches
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#16806F]">{dish.cravingMatch === "closest" ? "Same craving" : "Related option"}</p>
            <h3 className="mt-1 text-2xl font-black leading-8 text-[#191C1D]">{dish.name}</h3>
          </div>
          {dish.price && <span className="shrink-0 text-base font-black text-[#294A4B]">{dish.price}</span>}
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#566164]">{dish.description}</p>
      </header>

      <div className="space-y-4 p-4">
        <InfoSection icon={<Sparkles size={18} />} title="Why it may fit">
          <p>{dish.reason}</p>
          {dish.positives.length > 0 && <p className="mt-1">Menu positives: {dish.positives.join(" · ")}</p>}
        </InfoSection>

        <InfoSection icon={<AlertTriangle size={18} />} title="Worth knowing" tone="warning">
          {dish.concerns.length > 0 ? (
            <ul className="space-y-1">{dish.concerns.map((concern) => <li key={concern}>• {CONCERN_LABELS[concern]}</li>)}</ul>
          ) : (
            <p>No obvious concerns were found in the menu description.</p>
          )}
          {dish.suggestedChange && <p className="mt-2 font-black">Easy change: {dish.suggestedChange}</p>}
        </InfoSection>

        <InfoSection icon={<CheckCircle2 size={18} />} title="Information confidence">
          <p>{getEvidenceCopy(dish.evidence)}</p>
          <p className="mt-1 text-xs">BetterBite does not infer exact calories, oils, or allergens when the restaurant has not supplied them.</p>
        </InfoSection>

        {serverQuestions.length > 0 && (
          <InfoSection icon={<HelpCircle size={18} />} title="Ask your server">
            <ul className="space-y-1">{serverQuestions.map((question) => <li key={question}>• {question}</li>)}</ul>
          </InfoSection>
        )}
      </div>
    </section>
  );
}

function InfoSection({
  icon,
  title,
  tone = "default",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: "default" | "warning";
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl p-3.5 ${tone === "warning" ? "bg-[#FFF8E7]" : "bg-[#F2F8F6]"}`}>
      <h4 className="flex items-center gap-2 text-sm font-black text-[#294A4B]">{icon}{title}</h4>
      <div className="mt-2 text-sm font-semibold leading-5 text-[#566164]">{children}</div>
    </section>
  );
}

function getEvidenceCopy(evidence: MenuEvidenceLevel): string {
  if (evidence === "restaurant-verified") {
    return "The restaurant supplied this information.";
  }
  if (evidence === "menu-inferred") {
    return "This is inferred from the wording on the scanned menu.";
  }
  return "The menu does not provide enough information to verify this detail.";
}

function getServerQuestions(concerns: MenuConcern[]): string[] {
  const questions = new Set<string>();
  if (concerns.includes("fried") || concerns.includes("seed-oil-likely")) questions.add("What oil is this cooked in?");
  if (concerns.includes("gluten")) questions.add("Can this be prepared without gluten cross-contact?");
  if (concerns.includes("dairy")) questions.add("Does the sauce or preparation contain dairy?");
  if (concerns.includes("high-sodium")) questions.add("Can the sauce or seasoning be served on the side?");
  return Array.from(questions).slice(0, 3);
}
