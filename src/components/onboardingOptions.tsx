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
import type { DietPreference, FoodAvoidance, MainGoal } from "../types";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon: ReactNode;
  tint: string;
}

export const MAIN_GOAL_OPTIONS: Array<ChoiceOption<MainGoal>> = [
  { value: "eat-healthier", label: "Eat healthier overall", icon: <Salad size={19} />, tint: "bg-[#DDF7EF] text-[#00696B]" },
  { value: "energy-focus", label: "Improve energy & focus", icon: <Brain size={19} />, tint: "bg-[#D7F1F6] text-[#00637A]" },
  { value: "manage-weight", label: "Manage weight", icon: <Scale size={19} />, tint: "bg-[#E6F6DF] text-[#256D1B]" },
  { value: "fitness-goals", label: "Support fitness goals", icon: <Dumbbell size={19} />, tint: "bg-[#B6F4E4] text-[#00696B]" },
  { value: "reduce-inflammation", label: "Reduce inflammation", icon: <Droplets size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
  { value: "long-term-health", label: "Feel better long-term", icon: <HeartPulse size={19} />, tint: "bg-[#F0F7E5] text-[#256D1B]" },
];

export const DIET_OPTIONS: Array<ChoiceOption<DietPreference>> = [
  { value: "no-preference", label: "No preference", icon: <Sparkles size={19} />, tint: "bg-[#DDF7EF] text-[#00696B]" },
  { value: "vegetarian", label: "Vegetarian", icon: <Leaf size={19} />, tint: "bg-[#CFF5D5] text-[#256D1B]" },
  { value: "vegan", label: "Vegan", icon: <Leaf size={19} />, tint: "bg-[#E6F6DF] text-[#256D1B]" },
  { value: "pescatarian", label: "Pescatarian", icon: <Fish size={19} />, tint: "bg-[#D7F1F6] text-[#00637A]" },
  { value: "keto-low-carb", label: "Keto / Low carb", icon: <Flame size={19} />, tint: "bg-[#DDF7EF] text-[#007477]" },
  { value: "gluten-free", label: "Gluten-free", icon: <WheatOff size={19} />, tint: "bg-[#F2EED9] text-[#6B5B00]" },
  { value: "dairy-free", label: "Dairy-free", icon: <MilkOff size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
];

export const FOOD_AVOIDANCE_OPTIONS: Array<ChoiceOption<FoodAvoidance>> = [
  { value: "none", label: "None", icon: <CircleSlash2 size={19} />, tint: "bg-[#DDF7EF] text-[#00696B]" },
  { value: "seed-oils", label: "Seed oils", icon: <Droplets size={19} />, tint: "bg-[#D7F1F6] text-[#00637A]" },
  { value: "added-sugars", label: "Added sugars", icon: <Sparkles size={19} />, tint: "bg-[#F2EED9] text-[#6B5B00]" },
  { value: "artificial-sweeteners", label: "Artificial sweeteners", icon: <Zap size={19} />, tint: "bg-[#DDF7EF] text-[#007477]" },
  { value: "artificial-colors", label: "Artificial colors", icon: <Palette size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
  { value: "high-sodium", label: "High sodium", icon: <Flame size={19} />, tint: "bg-[#F0F7E5] text-[#256D1B]" },
  { value: "gluten", label: "Gluten", icon: <WheatOff size={19} />, tint: "bg-[#F2EED9] text-[#6B5B00]" },
  { value: "dairy", label: "Dairy", icon: <MilkOff size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
  { value: "gmos", label: "GMOs", icon: <Leaf size={19} />, tint: "bg-[#CFF5D5] text-[#256D1B]" },
];
