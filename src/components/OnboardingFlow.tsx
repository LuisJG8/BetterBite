import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import appLogo from "../assets/healthier-food-logo-option-07.png";
import welcomeFoodHero from "../assets/onboarding-food-hero.png";
import { DIET_OPTIONS, FOOD_AVOIDANCE_OPTIONS, MAIN_GOAL_OPTIONS, type ChoiceOption } from "./onboardingOptions";
import type { DietPreference, FoodAvoidance, MainGoal, OnboardingProfile } from "../types";

export type OnboardingStep = "welcome" | "benefits" | "main-goal" | "diet" | "avoid" | "account" | "app";

type VisibleOnboardingStep = Exclude<OnboardingStep, "app">;

interface OnboardingFlowProps {
  step: VisibleOnboardingStep;
  profile: OnboardingProfile;
  onBack: () => void;
  onContinue: () => void;
  onSkipOptionalQuestion: () => void;
  onAccountNameChange: (name: string) => void;
  onAccountEmailChange: (email: string) => void;
  onMainGoalToggle: (goal: MainGoal) => void;
  onDietPreferenceToggle: (preference: DietPreference) => void;
  onFoodAvoidanceToggle: (avoidance: FoodAvoidance) => void;
}

const BENEFITS = [
  { label: "Lower risk of diseases", icon: <ShieldCheck size={22} strokeWidth={2.2} /> },
  { label: "Better brain function", icon: <Brain size={22} strokeWidth={2.2} /> },
  { label: "More energy", icon: <Zap size={22} strokeWidth={2.2} /> },
  { label: "Stronger immune system", icon: <HeartPulse size={22} strokeWidth={2.2} /> },
  { label: "Live longer", icon: <Sparkles size={22} strokeWidth={2.2} /> },
];
const ONBOARDING_PROGRESS_STEPS: VisibleOnboardingStep[] = ["benefits", "main-goal", "diet", "avoid", "account"];

export function OnboardingFlow({
  step,
  profile,
  onBack,
  onContinue,
  onSkipOptionalQuestion,
  onAccountNameChange,
  onAccountEmailChange,
  onMainGoalToggle,
  onDietPreferenceToggle,
  onFoodAvoidanceToggle,
}: OnboardingFlowProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [step]);

  return (
    <main className="min-h-[100dvh] bg-[#F7FAFB] text-[#1F2629]">
      <div className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#F7FAFB] shadow-[0_24px_70px_rgba(0,105,107,0.12)] md:my-6 md:h-[900px] md:max-h-[calc(100vh-3rem)] md:rounded-[34px]">
        {step === "welcome" && <WelcomeScreen onContinue={onContinue} />}
        {step === "benefits" && <BenefitsScreen onBack={onBack} onContinue={onContinue} />}
        {step === "main-goal" && (
          <QuestionScreen
            title="What's your main goal?"
            subtitle="Choose all that apply."
            options={MAIN_GOAL_OPTIONS}
            values={profile.mainGoals}
            progressStep="main-goal"
            onBack={onBack}
            onContinue={onContinue}
            onSkip={onSkipOptionalQuestion}
            onToggle={onMainGoalToggle}
          />
        )}
        {step === "diet" && (
          <QuestionScreen
            title="What's your diet preference?"
            subtitle="Choose all that apply."
            options={DIET_OPTIONS}
            values={profile.dietPreferences}
            progressStep="diet"
            onBack={onBack}
            onContinue={onContinue}
            onSkip={onSkipOptionalQuestion}
            onToggle={onDietPreferenceToggle}
          />
        )}
        {step === "avoid" && (
          <QuestionScreen
            title="Any foods or ingredients you want to avoid?"
            subtitle="Choose all that apply."
            options={FOOD_AVOIDANCE_OPTIONS}
            values={profile.foodsToAvoid}
            progressStep="avoid"
            onBack={onBack}
            onContinue={onContinue}
            onSkip={onSkipOptionalQuestion}
            onToggle={onFoodAvoidanceToggle}
          />
        )}
        {step === "account" && (
          <AccountScreen
            profile={profile}
            onBack={onBack}
            onComplete={onContinue}
            onNameChange={onAccountNameChange}
            onEmailChange={onAccountEmailChange}
          />
        )}
      </div>
    </main>
  );
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <section className="flex h-full min-h-0 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+65px)] pt-[calc(env(safe-area-inset-top)+42px)]">
      <div className="flex min-h-0 flex-1 -translate-y-[35px] flex-col items-center justify-center">
        <img src={appLogo} alt="BetterBite" className="h-[62px] w-[62px] object-contain" />
        <h1 className="mt-3 text-center text-[22px] font-black leading-none text-[#00696B]">BetterBite</h1>

        <div className="mt-8 flex h-[232px] w-full max-w-[330px] items-center justify-center overflow-hidden rounded-[28px] bg-white shadow-[0_18px_46px_rgba(0,105,107,0.13)]">
          <img src={welcomeFoodHero} alt="Assorted foods and healthier swaps" className="h-full w-full object-cover" />
        </div>

        <h2 className="mt-8 max-w-[330px] text-left text-[26px] font-black leading-[1.06] text-[#063F41]">
          Find healthier alternatives to the foods you already love.
        </h2>
        <p className="mt-3 max-w-[330px] text-left text-[15px] font-semibold leading-6 text-[#566164]">
          Similar taste. Better ingredients. Smarter swaps.
        </p>
      </div>

      <PrimaryButton label="Get Started" onClick={onContinue} />
    </section>
  );
}

function BenefitsScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <ScreenFrame onBack={onBack} footer={<PrimaryButton label="Next" onClick={onContinue} />} progressStep="benefits">
      <div className="pt-4 text-center">
        <h1 className="text-[25px] font-black leading-[1.08] text-[#063F41]">Why it matters</h1>
        <p className="mt-2 text-[15px] font-semibold leading-5 text-[#566164]">Better choices. Better you.</p>
      </div>

      <div className="mt-8 space-y-3">
        {BENEFITS.map((benefit) => (
          <div key={benefit.label} className="flex min-h-[58px] items-center gap-4 border-b border-[#DDE6E7] pb-3 last:border-b-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DDF7EF] text-[#00696B]">
              {benefit.icon}
            </span>
            <span className="min-w-0 flex-1 text-[16px] font-black leading-5 text-[#1F2629]">{benefit.label}</span>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}

function QuestionScreen<T extends string>({
  title,
  subtitle,
  options,
  values,
  progressStep,
  onBack,
  onContinue,
  onSkip,
  onToggle,
}: {
  title: string;
  subtitle: string;
  options: Array<ChoiceOption<T>>;
  values: T[];
  progressStep: VisibleOnboardingStep;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onToggle: (value: T) => void;
}) {
  return (
    <ScreenFrame
      onBack={onBack}
      headerAction={<SkipButton onClick={onSkip} />}
      footer={<PrimaryButton label="Next" disabled={values.length === 0} onClick={onContinue} />}
      progressStep={progressStep}
    >
      <div className="pt-[72px] text-center">
        <h1 className="mx-auto max-w-[330px] text-[22px] font-black leading-[1.12] text-[#063F41]">{title}</h1>
        <p className="mt-2 text-[14px] font-semibold leading-5 text-[#566164]">{subtitle}</p>
      </div>

      <div className="mt-5 space-y-2.5 pb-1">
        {options.map((option) => {
          const isSelected = values.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              className={`relative flex min-h-[88px] w-full items-center gap-3 overflow-hidden rounded-[14px] border px-3.5 py-2.5 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40 ${
                isSelected
                  ? "border-[#009A9D] bg-gradient-to-r from-[#E1FAF4] to-white shadow-[0_12px_28px_rgba(0,105,107,0.15),inset_0_0_0_1px_rgba(0,154,157,0.22)] ring-2 ring-[#00C5C8]/35"
                  : "border-[#D9E4E5] bg-white/70 hover:border-[#00C5C8] active:bg-[#EEF7F8]"
              }`}
              onClick={() => onToggle(option.value)}
            >
              <span className="relative h-[68px] w-[82px] shrink-0 overflow-hidden rounded-[11px] bg-[#EEF7F8]">
                <img className="h-full w-full object-cover" src={option.imageSrc} alt={option.imageAlt} />
                <span
                  className={`absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 shadow-[0_5px_12px_rgba(0,0,0,0.16)] ${option.tint}`}
                  aria-hidden="true"
                >
                  {option.icon}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] font-black leading-5 ${isSelected ? "text-[#063F41]" : "text-[#1F2629]"}`}>{option.label}</span>
                {option.description && (
                  <span className={`mt-0.5 block text-[12px] font-semibold leading-4 ${isSelected ? "text-[#00696B]" : "text-[#566164]"}`}>
                    {option.description}
                  </span>
                )}
              </span>
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border transition ${
                  isSelected ? "border-[#009A9D] bg-[#009A9D] text-white shadow-[0_6px_14px_rgba(0,105,107,0.24)]" : "border-[#B9CCCF] bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check size={14} strokeWidth={3.2} />
              </span>
            </button>
          );
        })}
      </div>
    </ScreenFrame>
  );
}

function AccountScreen({
  profile,
  onBack,
  onComplete,
  onNameChange,
  onEmailChange,
}: {
  profile: OnboardingProfile;
  onBack: () => void;
  onComplete: () => void;
  onNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onComplete();
  }

  return (
    <ScreenFrame onBack={onBack} footer={null} progressStep="account">
      <div className="flex min-h-full flex-col justify-center py-4">
        <div className="text-center">
          <h1 className="text-[24px] font-black leading-[1.1] text-[#063F41]">Create your account</h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[14px] font-semibold leading-5 text-[#566164]">
            Save your preferences and scans across devices.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <label className="block">
            <span className="sr-only">Full Name</span>
            <span className="flex h-[56px] items-center gap-3 rounded-[14px] border border-[#D9E4E5] bg-white px-4 text-[#667080]">
              <User size={20} strokeWidth={2.2} className="shrink-0 text-[#657A7C]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-[#9BA5A7]"
                type="text"
                name="name"
                placeholder="Full Name"
                autoComplete="name"
                maxLength={80}
                required
                value={profile.displayName}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </span>
          </label>

          <label className="block">
            <span className="sr-only">Email address</span>
            <span className="flex h-[56px] items-center gap-3 rounded-[14px] border border-[#D9E4E5] bg-white px-4 text-[#667080]">
              <Mail size={20} strokeWidth={2.2} className="shrink-0 text-[#657A7C]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-[#9BA5A7]"
                type="email"
                name="email"
                placeholder="Email address"
                autoComplete="email"
                required
                value={profile.email}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </span>
          </label>

          <label className="block">
            <span className="sr-only">Password</span>
            <span className="flex h-[56px] items-center gap-3 rounded-[14px] border border-[#D9E4E5] bg-white px-4 text-[#667080]">
              <LockKeyhole size={20} strokeWidth={2.2} className="shrink-0 text-[#657A7C]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-[#9BA5A7]"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#657A7C] transition hover:bg-[#EEF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={21} strokeWidth={2.2} /> : <Eye size={21} strokeWidth={2.2} />}
              </button>
            </span>
          </label>

          <PrimaryButton label="Create account" type="submit" />
        </form>

        <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-[13px] font-extrabold text-[#748284]">
          <span className="h-px bg-[#DDE6E7]" />
          <span>or</span>
          <span className="h-px bg-[#DDE6E7]" />
        </div>

        <button
          type="button"
          className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#CDDCDD] bg-white text-[15px] font-extrabold text-[#111517] transition hover:border-[#00C5C8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40"
          onClick={onComplete}
        >
          <span className="text-[22px] font-black text-[#4285F4]">G</span>
          Continue with Google
        </button>
      </div>
    </ScreenFrame>
  );
}

function ScreenFrame({
  onBack,
  children,
  footer,
  progressStep,
  headerAction,
}: {
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
  progressStep: VisibleOnboardingStep;
  headerAction?: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pb-[5px] pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex h-10 items-center justify-between">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E7EEF0] bg-white text-[#063F41] shadow-[0_8px_18px_rgba(0,0,0,0.06)] transition hover:bg-[#EEF7F8] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40"
            aria-label="Go back"
            onClick={onBack}
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          {headerAction}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
      <footer className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3">
        {footer}
        <OnboardingProgress step={progressStep} />
      </footer>
    </section>
  );
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex h-[35px] items-center gap-2 rounded-full border border-[#E7EEF0] bg-white px-4 text-[16px] font-semibold text-[#111517] shadow-[0_8px_18px_rgba(0,0,0,0.06)] transition hover:bg-[#EEF7F8] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40"
      onClick={onClick}
    >
      <span>Skip</span>
      <ArrowRight size={20} strokeWidth={2.4} />
    </button>
  );
}

function OnboardingProgress({ step }: { step: VisibleOnboardingStep }) {
  const currentIndex = ONBOARDING_PROGRESS_STEPS.indexOf(step);
  const progressValue = currentIndex + 1;

  return (
    <div
      className="mt-8 flex h-6 items-center justify-center gap-2"
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuemin={1}
      aria-valuemax={ONBOARDING_PROGRESS_STEPS.length}
      aria-valuenow={progressValue}
    >
      {ONBOARDING_PROGRESS_STEPS.map((progressStep, index) => (
        <span
          key={progressStep}
          className={`h-[7px] w-[7px] rounded-full transition-colors ${index === currentIndex ? "bg-[#063F41]" : "bg-[#D8DDDE]"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled = false,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const hasTrailingArrow = label === "Next";

  return (
    <button
      type={type}
      className={`mb-2.5 flex h-[56px] w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40 ${
        disabled
          ? "bg-[#D6E0E2] text-[#9BA5A7]"
          : "bg-gradient-to-r from-[#12C8CA] to-[#007A79] text-white shadow-[0_12px_26px_rgba(0,128,128,0.22)] active:translate-y-px"
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
      {hasTrailingArrow && <ArrowRight size={20} strokeWidth={2.8} />}
    </button>
  );
}
