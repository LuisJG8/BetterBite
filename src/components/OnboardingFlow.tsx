import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  HeartPulse,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useRef } from "react";
import welcomeFoodHero from "../assets/onboarding-food-hero.png";
import { DIET_OPTIONS, FOOD_AVOIDANCE_OPTIONS, MAIN_GOAL_OPTIONS, type ChoiceOption } from "./onboardingOptions";
import type { DietPreference, FoodAvoidance, MainGoal, OnboardingProfile } from "../types";
import "./onboarding.css";

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
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0 });
  }, [step]);

  return (
    <main ref={mainRef} className="onboarding">
      <div className="onboarding-shell">
        <header className="onboarding-masthead">
          <img src="/apple-touch-icon.png" alt="" width="38" height="38" />
          <span>BetterBite</span>
        </header>
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
    <section className="onboarding-welcome">
      <img className="onboarding-hero" src={welcomeFoodHero} alt="Assorted foods and healthier swaps" width="1122" height="1402" />
      <div className="onboarding-intro">
        <h1 tabIndex={-1} className="onboarding-headline">
          Find healthier alternatives to the foods <em>you already love.</em>
        </h1>
        <p className="onboarding-deck">
          Similar taste. Better ingredients. Smarter swaps.
        </p>
        <PrimaryButton label="Get Started" onClick={onContinue} />
      </div>
    </section>
  );
}

function BenefitsScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <ScreenFrame
      title="Why it matters"
      subtitle="Better choices. Better you."
      onBack={onBack}
      footer={<PrimaryButton label="Next" onClick={onContinue} />}
      progressStep="benefits"
    >
      <ul className="onboarding-benefits">
        {BENEFITS.map((benefit) => (
          <li key={benefit.label}>
            <span className="onboarding-benefit-icon" aria-hidden="true">{benefit.icon}</span>
            <span>{benefit.label}</span>
          </li>
        ))}
      </ul>
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
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      headerAction={<SkipButton onClick={onSkip} />}
      footer={<PrimaryButton label="Next" disabled={values.length === 0} onClick={onContinue} />}
      progressStep={progressStep}
    >
      <div className="onboarding-choices">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={values.includes(option.value)}
            className="onboarding-choice"
            onClick={() => onToggle(option.value)}
          >
            <span className="onboarding-choice-art" aria-hidden="true">
              <img src={option.imageSrc} alt="" width="54" height="54" loading="lazy" decoding="async" />
              <span className={`onboarding-choice-icon ${option.tint}`}>{option.icon}</span>
            </span>
            <span className="onboarding-choice-label">
              {option.label}
              {option.description && <small>{option.description}</small>}
            </span>
            <span className="onboarding-check" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
          </button>
        ))}
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
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onComplete();
  }

  return (
    <ScreenFrame
      title="Set up your profile"
      subtitle="Both fields are optional. BetterBite saves your profile on this device. Food and menu scans send photos to a service for analysis."
      onBack={onBack}
      footer={null}
      progressStep="account"
    >
      <form method="post" onSubmit={handleSubmit} className="onboarding-account-form">
        <label className="block">
          <span className="onboarding-field-label">Name</span>
          <span className="onboarding-field">
            <User size={20} strokeWidth={2.2} aria-hidden="true" />
            <input
              type="text"
              name="name"
              autoComplete="name"
              maxLength={80}
              value={profile.displayName}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </span>
        </label>

        <label className="block">
          <span className="onboarding-field-label">Email address</span>
          <span className="onboarding-field">
            <Mail size={20} strokeWidth={2.2} aria-hidden="true" />
            <input
              type="email"
              name="email"
              maxLength={254}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              value={profile.email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </span>
        </label>

        <PrimaryButton label="Save profile" type="submit" />
      </form>
    </ScreenFrame>
  );
}

function ScreenFrame({
  title,
  subtitle,
  onBack,
  children,
  footer,
  progressStep,
  headerAction,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
  progressStep: VisibleOnboardingStep;
  headerAction?: ReactNode;
}) {
  return (
    <section className="onboarding-step">
      <div className="onboarding-toolbar">
        <button type="button" className="onboarding-back" aria-label="Go back" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        {headerAction}
      </div>

      <div className="onboarding-step-layout">
        <div className="onboarding-step-heading">
          <h1 tabIndex={-1} className="onboarding-headline">{title}</h1>
          <p className="onboarding-deck">{subtitle}</p>
        </div>
        <div className="onboarding-step-panel">
          {children}
          <footer className="onboarding-step-footer">
            {footer}
            <OnboardingProgress step={progressStep} />
          </footer>
        </div>
      </div>
    </section>
  );
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="onboarding-skip" onClick={onClick}>
      <span>Skip</span>
      <ArrowRight size={17} />
    </button>
  );
}

function OnboardingProgress({ step }: { step: VisibleOnboardingStep }) {
  const currentIndex = ONBOARDING_PROGRESS_STEPS.indexOf(step);
  const progressValue = currentIndex + 1;

  return (
    <div
      className="onboarding-progress"
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuemin={1}
      aria-valuemax={ONBOARDING_PROGRESS_STEPS.length}
      aria-valuenow={progressValue}
    >
      {ONBOARDING_PROGRESS_STEPS.map((progressStep, index) => (
        <span
          key={progressStep}
          data-current={index === currentIndex}
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
  return (
    <button
      type={type}
      className="onboarding-primary"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
      {type !== "submit" && <ArrowRight size={18} aria-hidden="true" />}
    </button>
  );
}
