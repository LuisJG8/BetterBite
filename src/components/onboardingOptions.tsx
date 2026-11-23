import {
  Brain,
  CircleSlash2,
  Droplets,
  Dumbbell,
  Fish,
  Flame,
  HeartPulse,
  Leaf,
  MilkOff,
  Palette,
  Salad,
  Scale,
  Sparkles,
  WheatOff,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import addedSugarsImage from "../assets/onboarding-options/added-sugars.png";
import artificialColorsImage from "../assets/onboarding-options/artificial-colors.png";
import artificialSweetenersImage from "../assets/onboarding-options/artificial-sweeteners.png";
import dairyFreeImage from "../assets/onboarding-options/dairy-free.png";
import dairyImage from "../assets/onboarding-options/dairy.png";
import eatHealthierImage from "../assets/onboarding-options/main-goal-eat-healthier.png";
import energyFocusImage from "../assets/onboarding-options/main-goal-energy-focus.png";
import fitnessGoalsImage from "../assets/onboarding-options/main-goal-fitness-goals.png";
import glutenFreeImage from "../assets/onboarding-options/gluten-free.png";
import glutenImage from "../assets/onboarding-options/gluten.png";
import gmosImage from "../assets/onboarding-options/gmos.png";
import highSodiumImage from "../assets/onboarding-options/high-sodium.png";
import ketoLowCarbImage from "../assets/onboarding-options/keto-low-carb.png";
import longTermHealthImage from "../assets/onboarding-options/main-goal-long-term-health.png";
import manageWeightImage from "../assets/onboarding-options/main-goal-manage-weight.png";
import noPreferenceImage from "../assets/onboarding-options/no-preference.png";
import noneImage from "../assets/onboarding-options/none.png";
import pescatarianImage from "../assets/onboarding-options/pescatarian.png";
import reduceInflammationImage from "../assets/onboarding-options/main-goal-reduce-inflammation.png";
import seedOilsImage from "../assets/onboarding-options/seed-oils.png";
import veganImage from "../assets/onboarding-options/vegan.png";
import vegetarianImage from "../assets/onboarding-options/vegetarian.png";
import type { DietPreference, FoodAvoidance, MainGoal } from "../types";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  featured?: boolean;
  imageAlt: string;
  imageSrc: string;
  icon: ReactNode;
  tint: string;
}

export const MAIN_GOAL_OPTIONS: Array<ChoiceOption<MainGoal>> = [
  {
    value: "eat-healthier",
    label: "Eat healthier overall",
    featured: true,
    imageAlt: "Balanced meal bowl with greens, grains, avocado, vegetables, and berries",
    imageSrc: eatHealthierImage,
    icon: <Salad size={19} />,
    tint: "bg-[#DDF7EF] text-[#00696B]",
  },
  {
    value: "energy-focus",
    label: "Improve energy & focus",
    imageAlt: "Smiling person touching their temple with a glowing brain motif",
    imageSrc: energyFocusImage,
    icon: <Brain size={19} />,
    tint: "bg-[#D7F1F6] text-[#00637A]",
  },
  {
    value: "manage-weight",
    label: "Manage weight",
    imageAlt: "Modern scale surrounded by fresh foods and a measuring tape",
    imageSrc: manageWeightImage,
    icon: <Scale size={19} />,
    tint: "bg-[#E6F6DF] text-[#256D1B]",
  },
  {
    value: "fitness-goals",
    label: "Support fitness goals",
    imageAlt: "Person tying running shoes beside a smoothie, banana, oats, water, and a dumbbell",
    imageSrc: fitnessGoalsImage,
    icon: <Dumbbell size={19} />,
    tint: "bg-[#B6F4E4] text-[#00696B]",
  },
  {
    value: "reduce-inflammation",
    label: "Reduce inflammation",
    imageAlt: "Turmeric, ginger, blueberries, greens, olive oil, tea, and water droplets",
    imageSrc: reduceInflammationImage,
    icon: <Droplets size={19} />,
    tint: "bg-[#E3F1F6] text-[#00637A]",
  },
  {
    value: "long-term-health",
    label: "Feel better long-term",
    imageAlt: "Smiling person with fresh food near a sunny walking path",
    imageSrc: longTermHealthImage,
    icon: <HeartPulse size={19} />,
    tint: "bg-[#F0F7E5] text-[#256D1B]",
  },
];

export const DIET_OPTIONS: Array<ChoiceOption<DietPreference>> = [
  {
    value: "no-preference",
    label: "No preference",
    featured: true,
    imageAlt: "Open plate with varied balanced foods",
    imageSrc: noPreferenceImage,
    icon: <Sparkles size={19} />,
    tint: "bg-[#DDF7EF] text-[#00696B]",
  },
  {
    value: "vegetarian",
    label: "Vegetarian",
    imageAlt: "Vegetarian bowl with beans, greens, tomatoes, eggs, and cheese",
    imageSrc: vegetarianImage,
    icon: <Leaf size={19} />,
    tint: "bg-[#CFF5D5] text-[#256D1B]",
  },
  {
    value: "vegan",
    label: "Vegan",
    imageAlt: "Plant-based bowl with tofu, chickpeas, avocado, carrots, and sprouts",
    imageSrc: veganImage,
    icon: <Leaf size={19} />,
    tint: "bg-[#E6F6DF] text-[#256D1B]",
  },
  {
    value: "pescatarian",
    label: "Pescatarian",
    imageAlt: "Seafood bowl with salmon, shrimp, avocado, seaweed, and lemon",
    imageSrc: pescatarianImage,
    icon: <Fish size={19} />,
    tint: "bg-[#D7F1F6] text-[#00637A]",
  },
  {
    value: "keto-low-carb",
    label: "Keto / Low carb",
    imageAlt: "Low-carb foods with avocado, eggs, salmon, nuts, and greens",
    imageSrc: ketoLowCarbImage,
    icon: <Flame size={19} />,
    tint: "bg-[#DDF7EF] text-[#007477]",
  },
  {
    value: "gluten-free",
    label: "Gluten-free",
    imageAlt: "Gluten-free foods with rice, quinoa, corn tortillas, and vegetables",
    imageSrc: glutenFreeImage,
    icon: <WheatOff size={19} />,
    tint: "bg-[#F2EED9] text-[#6B5B00]",
  },
  {
    value: "dairy-free",
    label: "Dairy-free",
    imageAlt: "Dairy-free foods with almond milk, coconut, almonds, and berries",
    imageSrc: dairyFreeImage,
    icon: <MilkOff size={19} />,
    tint: "bg-[#E3F1F6] text-[#00637A]",
  },
];

export const FOOD_AVOIDANCE_OPTIONS: Array<ChoiceOption<FoodAvoidance>> = [
  {
    value: "none",
    label: "None",
    featured: true,
    imageAlt: "Clean plate with a green check badge",
    imageSrc: noneImage,
    icon: <CircleSlash2 size={19} />,
    tint: "bg-[#DDF7EF] text-[#00696B]",
  },
  {
    value: "seed-oils",
    label: "Seed oils",
    imageAlt: "Cooking oil bottle with sunflower seeds and soybean pods",
    imageSrc: seedOilsImage,
    icon: <Droplets size={19} />,
    tint: "bg-[#D7F1F6] text-[#00637A]",
  },
  {
    value: "added-sugars",
    label: "Added sugars",
    imageAlt: "Sugar cubes, spoon, and strawberry",
    imageSrc: addedSugarsImage,
    icon: <Sparkles size={19} />,
    tint: "bg-[#F2EED9] text-[#6B5B00]",
  },
  {
    value: "artificial-sweeteners",
    label: "Artificial sweeteners",
    imageAlt: "Sweetener packet, tablets, and lemon slice",
    imageSrc: artificialSweetenersImage,
    icon: <Zap size={19} />,
    tint: "bg-[#DDF7EF] text-[#007477]",
  },
  {
    value: "artificial-colors",
    label: "Artificial colors",
    imageAlt: "Colorful droplets and palette with caution badge",
    imageSrc: artificialColorsImage,
    icon: <Palette size={19} />,
    tint: "bg-[#E3F1F6] text-[#00637A]",
  },
  {
    value: "high-sodium",
    label: "High sodium",
    imageAlt: "Salt shaker, salt crystals, and pretzel pieces",
    imageSrc: highSodiumImage,
    icon: <Flame size={19} />,
    tint: "bg-[#F0F7E5] text-[#256D1B]",
  },
  {
    value: "gluten",
    label: "Gluten",
    imageAlt: "Wheat, bread slices, and pasta shapes",
    imageSrc: glutenImage,
    icon: <WheatOff size={19} />,
    tint: "bg-[#F2EED9] text-[#6B5B00]",
  },
  {
    value: "dairy",
    label: "Dairy",
    imageAlt: "Milk glass, cheese cubes, and yogurt cup",
    imageSrc: dairyImage,
    icon: <MilkOff size={19} />,
    tint: "bg-[#E3F1F6] text-[#00637A]",
  },
  {
    value: "gmos",
    label: "GMOs",
    imageAlt: "Corn, soybean pods, sprout, and science badge",
    imageSrc: gmosImage,
    icon: <Leaf size={19} />,
    tint: "bg-[#CFF5D5] text-[#256D1B]",
  },
];
