import { Fragment } from "react";
import { CheckIcon } from "./icons.js";

interface StepIndicatorProps {
  steps: string[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <div className={`step-indicator-line${i <= currentIndex ? " done" : ""}`} />}
          <div
            className={`step-indicator-item${
              i < currentIndex ? " done" : i === currentIndex ? " current" : ""
            }`}
          >
            <span className="step-indicator-circle">
              {i < currentIndex ? <CheckIcon width={13} height={13} /> : i + 1}
            </span>
            <span className="step-indicator-label">{label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
