import { AlertTriangle, ChevronLeft, Loader2, Search } from "lucide-react";
import { FormEvent, useLayoutEffect, useReducer, useRef } from "react";
import {
  INITIAL_FOOD_SEARCH_STATE,
  friendlyTypesenseError,
  reduceFoodSearchState,
  searchFoods,
  type FoodSearchResult,
} from "../lib/typesenseSearch";

const YOU_MIGHT_LIKE: FoodSearchResult[] = [
  {
    id: "suggestion-rxbar-chocolate",
    name: "Chocolate Sea Salt Protein Bar",
    brand: "RXBAR",
    category: "Protein bars",
    cravingTags: ["sweet", "chocolate", "snack"],
    formatTags: ["grab and go", "bar", "portable snack"],
    healthTags: ["higher protein", "short ingredient list"],
    ingredientsSummary: "Dates, egg whites, almonds, cashews, cocoa, and sea salt.",
    betterbiteScore: 8,
    imageUrl: "/search-foods/breakfast-snacks.png",
    textMatch: 0,
  },
  {
    id: "suggestion-siggis-yogurt",
    name: "Plain Skyr",
    brand: "Siggi's",
    category: "Yogurt",
    cravingTags: ["creamy", "breakfast", "snack"],
    formatTags: ["cup", "spoon snack"],
    healthTags: ["higher protein", "lower sugar", "cultured"],
    ingredientsSummary: "Cultured milk with a short ingredient list and no added sugar.",
    betterbiteScore: 9,
    imageUrl: "/search-foods/breakfast-snacks.png",
    textMatch: 0,
  },
  {
    id: "suggestion-lesserevil-popcorn",
    name: "Himalayan Salt Popcorn",
    brand: "LesserEvil",
    category: "Popcorn",
    cravingTags: ["salty", "crunchy", "snack"],
    formatTags: ["bagged snack", "movie snack"],
    healthTags: ["whole grain", "simple ingredient list"],
    ingredientsSummary: "Popcorn, coconut oil, and Himalayan salt.",
    betterbiteScore: 8,
    imageUrl: "/search-foods/crackers-popcorn.png",
    textMatch: 0,
  },
  {
    id: "suggestion-simple-mills-crackers",
    name: "Almond Flour Crackers",
    brand: "Simple Mills",
    category: "Crackers",
    cravingTags: ["salty", "crunchy", "cracker"],
    formatTags: ["boxed snack", "dip pairing"],
    healthTags: ["short ingredient list", "seed based"],
    ingredientsSummary: "Almond flour, sunflower seeds, and sea salt.",
    betterbiteScore: 8,
    imageUrl: "/search-foods/crackers-popcorn.png",
    textMatch: 0,
  },
  {
    id: "suggestion-siete-chips",
    name: "Sea Salt Tortilla Chips",
    brand: "Siete",
    category: "Tortilla chips",
    cravingTags: ["salty", "crunchy", "chips"],
    formatTags: ["bagged snack", "chips"],
    healthTags: ["cleaner oil", "short ingredient list"],
    ingredientsSummary: "Cassava flour, avocado oil, coconut flour, and sea salt.",
    betterbiteScore: 8,
    imageUrl: "/search-foods/crunchy-potato.png",
    textMatch: 0,
  },
];

export function SearchScreen() {
  const [state, dispatch] = useReducer(reduceFoodSearchState, INITIAL_FOOD_SEARCH_STATE);
  const searchRequestIdRef = useRef(0);
  const latestQueryRef = useRef(state.query);

  const searchRef = useRef<HTMLDivElement>(null);
  const returnToFood = useRef<string | null>(null);

  function openDetail(result: FoodSearchResult) {
    returnToFood.current = result.id;
    dispatch({ type: "resultSelected", result });
  }

  useLayoutEffect(() => {
    if (state.selectedResult || !returnToFood.current) return;
    const opener = searchRef.current?.querySelector<HTMLButtonElement>(
      `button[data-food-id="${CSS.escape(returnToFood.current)}"]`,
    );
    opener?.focus();
    returnToFood.current = null;
  }, [state.selectedResult]);

  function handleQueryChange(query: string): void {
    if (query.trim() !== latestQueryRef.current.trim()) {
      searchRequestIdRef.current += 1;
    }
    latestQueryRef.current = query;
    dispatch({ type: "queryChanged", query });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.status === "loading") {
      return;
    }

    const query = state.query.trim();
    if (!query) {
      dispatch({ type: "queryChanged", query: "" });
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    latestQueryRef.current = state.query;
    dispatch({ type: "searchStarted", query });

    try {
      const results = await searchFoods(query);
      if (searchRequestIdRef.current !== requestId || latestQueryRef.current.trim() !== query) {
        return;
      }
      dispatch({ type: "searchSucceeded", query, results });
    } catch (error) {
      if (searchRequestIdRef.current !== requestId || latestQueryRef.current.trim() !== query) {
        return;
      }
      dispatch({ type: "searchFailed", query, error: friendlyTypesenseError(error) });
    }
  }

  const hasSearched = Boolean(state.submittedQuery);

  if (state.selectedResult) {
    return <FoodDetailScreen result={state.selectedResult} onBack={() => dispatch({ type: "detailClosed" })} />;
  }

  return (
    <div ref={searchRef} className="pb-8 text-ink">
      <h2 className="pt-3 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[1.08] tracking-[-0.045em]">Search foods</h2>

      <search className="sticky top-0 z-10 block border-b border-line bg-cream pb-5 pt-4 md:pb-8 md:pt-5">
        <form className="flex max-w-3xl items-center rounded-2xl border border-[#aebdb2] bg-white p-1 shadow-sm focus-within:border-leaf" onSubmit={handleSubmit}>
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">Search foods</span>
            <input
              value={state.query}
              onChange={(event) => handleQueryChange(event.target.value)}
              className="h-11 w-full rounded-xl bg-transparent px-3 text-base text-ink placeholder:text-[#64736b] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf"
              placeholder="Search chips, soda, cookies..."
              type="search"
              name="q"
              enterKeyHint="search"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="flex h-11 w-12 shrink-0 items-center justify-center rounded-xl bg-leaf text-white transition-colors hover:bg-[#103e34] disabled:cursor-wait disabled:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
            aria-label="Search foods"
          >
            {state.status === "loading" ? <Loader2 className="animate-spin" size={22} /> : <Search size={22} />}
          </button>
        </form>
      </search>

      <div className="space-y-5 pt-6 md:pt-8">
        {state.status === "idle" && (
          <YouMightLike onSelect={openDetail} />
        )}

        {state.status === "loading" && (
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-muted">
            <Loader2 className="animate-spin text-[#00696B]" size={22} />
            <p className="text-sm font-bold">Searching local Typesense foods...</p>
          </div>
        )}

        {state.status === "error" && state.error && (
          <div role="alert" className="rounded-2xl border border-[#eecfc6] bg-[#fff5f0] p-4 text-[#943826]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0" size={22} />
              <div>
                <p className="text-sm font-black">Search is unavailable</p>
                <p className="mt-1 text-sm font-semibold leading-5">{state.error}</p>
              </div>
            </div>
          </div>
        )}

        {state.status === "empty" && (
          <SearchEmptyState title={`No foods found for "${state.submittedQuery}"`} body="Try a broader craving like chips, soda, fries, cookies, cereal, burgers, or yogurt." />
        )}
        {(state.status === "empty" || state.status === "error") && (
          <YouMightLike query={state.submittedQuery} onSelect={openDetail} />
        )}

        {state.results.length > 0 && (
          <>
            <div role="status" className="flex items-center justify-between gap-2">
              <p className="min-w-0 break-words text-xs font-black uppercase tracking-[0.18em] text-[#566164]">
                {hasSearched ? `Results for ${state.submittedQuery}` : "Results"}
              </p>
              <p className="shrink-0 text-sm font-bold text-[#00696B]">{state.results.length} foods</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {state.results.map((result) => (
                <FoodResultCard
                  key={result.id}
                  result={result}
                  onSelect={() => openDetail(result)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function YouMightLike({ query, onSelect }: { query?: string; onSelect: (result: FoodSearchResult) => void }) {
  const suggestions = query
    ? YOU_MIGHT_LIKE.filter((food) => [food.name, food.brand, food.category, ...food.cravingTags, ...food.formatTags]
        .some((value) => value.toLowerCase().includes(query.toLowerCase())))
    : YOU_MIGHT_LIKE;
  if (!suggestions.length) return null;

  return (
    <section aria-labelledby="you-might-like-title">
      <div className="mb-4 md:mb-5">
        <h3 id="you-might-like-title" className="font-serif text-[clamp(1.65rem,3vw,2.25rem)] font-normal leading-tight tracking-[-0.035em] text-ink">
          {query ? "From the on-device collection" : "You might like"}
        </h3>
        {!query && <p className="mt-1.5 text-sm leading-5 text-muted">Popular healthier choices worth trying</p>}
      </div>

      <ul data-swipe-ignore="true" className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3 pt-1 sm:grid sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {suggestions.map((result) => (
          <li key={result.id} className="w-[min(60vw,12rem)] min-w-0 shrink-0 snap-start sm:w-auto">
            <button
              type="button"
              className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-white text-left shadow-sm transition-colors hover:border-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
              data-food-id={result.id}
              aria-label={`View ${result.brand} ${result.name}`}
              onClick={() => onSelect(result)}
            >
              <div className="relative aspect-[5/4] w-full overflow-hidden bg-oat">
                <img className={suggestionImageClass(result.id)} src={result.imageUrl} alt="" loading="lazy" />
                <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white text-[13px] font-bold tabular-nums text-leaf shadow-sm">
                  {result.betterbiteScore}
                </span>
              </div>
              <div className="px-3.5 pb-4 pt-3">
                <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.1em] text-leaf">{result.brand}</p>
                <p className="mt-1 text-base font-semibold leading-5 text-ink">{result.name}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Several suggestions share a food photograph. Frame the subject of each card.
function suggestionImageClass(id: string) {
  const focalPoints: Record<string, string> = {
    "suggestion-rxbar-chocolate": "origin-bottom-right scale-[1.7] object-bottom",
    "suggestion-siggis-yogurt": "origin-top-right scale-[1.7] object-top",
    "suggestion-lesserevil-popcorn": "origin-top-left scale-[1.5] object-top",
    "suggestion-simple-mills-crackers": "origin-bottom-right scale-[1.4] object-bottom",
  };
  return `h-full w-full object-cover ${focalPoints[id] || ""}`;
}

function SearchEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white px-4 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-oat text-leaf">
        <Search size={34} />
      </div>
      <h3 className="mt-4 max-w-full break-words font-serif text-2xl text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function FoodResultCard({ result, onSelect }: { result: FoodSearchResult; onSelect: () => void }) {
  const tags = Array.from(new Set([...result.cravingTags.slice(0, 2), ...result.healthTags.slice(0, 1)]));

  return (
    <button
      type="button"
      className="flex min-w-0 w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition hover:border-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
      data-food-id={result.id}
      onClick={onSelect}
    >
      <FoodImage result={result} size="list" />
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-semibold leading-5 text-ink">{result.name}</h3>
        <p className="mt-0.5 break-words text-sm leading-5 text-muted">
          {result.brand} · {result.category}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-oat px-2 py-1 text-xs font-medium leading-4 text-ink">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <FoodScore value={result.betterbiteScore} />
    </button>
  );
}

function FoodDetailScreen({ result, onBack }: { result: FoodSearchResult; onBack: () => void }) {
  const backRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    backRef.current?.focus();
  }, []);
  return (
    <div className="grid gap-4 pb-8 pt-3 text-ink md:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] md:items-start md:gap-x-10 md:gap-y-5">
      <button
        type="button"
        className="mb-1 inline-flex h-11 items-center gap-1 justify-self-start rounded-full border border-line bg-white px-3 pr-4 text-sm font-semibold text-leaf transition hover:border-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf md:col-span-2"
        onClick={onBack}
        ref={backRef}
        aria-label="Back to food search"
      >
        <ChevronLeft size={22} strokeWidth={2.8} />
        Search
      </button>

      <div className="min-w-0 md:col-start-2 md:row-start-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-leaf">Prototype detail</p>
        <h2 className="mt-2 break-words font-serif text-[clamp(2.1rem,4.5vw,3.3rem)] font-normal leading-[1.06] tracking-[-0.04em]">{result.name}</h2>
        <p className="mt-2 text-base leading-6 text-muted">
          {result.brand} · {result.category}
        </p>
      </div>

      <FoodImage result={result} size="detail" />

      <div className="grid grid-cols-[auto_1fr] items-start gap-4 rounded-2xl border border-line bg-white p-4 md:col-start-2">
        <FoodScore value={result.betterbiteScore} large />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Ingredient summary</p>
          <p className="mt-1 break-words text-sm leading-6 text-muted">{result.ingredientsSummary}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:col-start-2">
        {Array.from(new Set([...result.cravingTags, ...result.formatTags, ...result.healthTags])).slice(0, 9).map((tag, index) => (
          <span key={`${tag}-${index}`} className="rounded-full bg-oat px-3 py-1 text-xs font-semibold text-leaf">
            {tag}
          </span>
        ))}
      </div>

      <p className="rounded-xl bg-[#f4eddd] px-4 py-3 text-sm leading-5 text-[#604c2d] md:col-start-2">
        This catalog preview shows sample scores and ingredient summaries. Check the package for the full ingredient list.
      </p>
    </div>
  );
}

function FoodImage({ result, size }: { result: FoodSearchResult; size: "list" | "detail" }) {
  const isDetail = size === "detail";
  const fallbackInitial = result.name.charAt(0).toUpperCase();

  return (
    <div
      className={`${
        isDetail ? "aspect-[4/3] w-full rounded-2xl md:col-start-1 md:row-start-2 md:row-end-6" : "h-16 w-16 rounded-xl sm:h-20 sm:w-20"
      } flex shrink-0 items-center justify-center overflow-hidden border border-line bg-oat text-[22px] font-bold text-leaf`}
    >
      {result.imageUrl ? (
        <img
          className="h-full w-full object-cover"
          src={result.imageUrl}
          referrerPolicy="no-referrer"
          alt={isDetail ? result.name : ""}
          loading={isDetail ? "eager" : "lazy"}
        />
      ) : (
        fallbackInitial
      )}
    </div>
  );
}

function FoodScore({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <div
      className={`${large ? "h-14 w-14 text-xl" : "h-10 w-10 text-sm"} flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${
        value >= 8 ? "bg-[#dcf0d4] text-[#294c2b]" : value >= 6 ? "bg-[#eaf0ca] text-[#4a561c]" : value >= 4 ? "bg-[#f6e5c7] text-[#60451c]" : "bg-[#f5d7d0] text-[#802d30]"
      }`}
      aria-label={`BetterBite prototype score ${value} out of 10`}
    >
      {value}
    </div>
  );
}
