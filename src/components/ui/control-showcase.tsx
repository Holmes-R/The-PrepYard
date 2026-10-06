"use client";
import { useState } from "react";
import { ArrowRight, StickyNote, History, Eye, Trash2 } from "lucide-react";
import { Button } from "./button";
import {
  Checkbox,
  Radio,
  CompletionToggle,
  FilterChip,
} from "./selection-control";

const states = [
  "Default",
  "Hover",
  "Pressed",
  "Focus",
  "Loading",
  "Disabled",
] as const;
export function ControlShowcase() {
  const [solved, setSolved] = useState(false);
  const [selected, setSelected] = useState(true);
  const [note, setNote] = useState(false);
  const [revisionPreview, setRevisionPreview] = useState(false);
  const [segment, setSegment] = useState("Topics");
  return (
    <div className="prep-showcase">
      <header>
        <p className="prep-showcase-meta">Component preview · examples only</p>
        <h1>Daily practice, polished.</h1>
        <p>
          Reusable controls and typography in the PrepYard theme. These examples
          do not save account data.
        </p>
      </header>
      <section>
        <h2>Buttons</h2>
        <p>
          40px regular controls, 32px compact actions, and 44px touch targets on
          mobile.
        </p>
        {(["default", "secondary", "ghost", "icon"] as const).map((variant) => (
          <div className="prep-state-row" key={variant}>
            <h3>
              {variant === "default"
                ? "Primary"
                : variant === "icon"
                  ? "Icon"
                  : variant === "ghost"
                    ? "Ghost"
                    : "Secondary"}
            </h3>
            <div className="prep-state-examples">
              {states.map((state) => (
                <div key={state}>
                  <span>{state}</span>
                  <Button
                    variant={variant === "icon" ? "ghost" : variant}
                    size={variant === "icon" ? "icon" : "default"}
                    aria-label={
                      variant === "icon" ? state + " action" : undefined
                    }
                    data-preview-state={state.toLowerCase()}
                    loading={state === "Loading"}
                    disabled={state === "Disabled"}
                  >
                    {variant === "icon" ? (
                      state === "Loading" ? null : (
                        <ArrowRight size={16} />
                      )
                    ) : (
                      <>
                        {state === "Loading" ? "Saving…" : "Practice"}
                        {state !== "Loading" && <ArrowRight size={16} />}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section>
        <h2>Selection controls</h2>
        <div className="prep-selection-examples">
          {[
            "Unchecked",
            "Checked",
            "Hover",
            "Focus",
            "Disabled",
            "Disabled checked",
            "Indeterminate",
          ].map((state) => (
            <label key={state} data-preview-state={state.toLowerCase()}>
              <Checkbox
                defaultChecked={
                  state === "Checked" || state === "Disabled checked"
                }
                disabled={state.startsWith("Disabled")}
                indeterminate={state === "Indeterminate"}
                aria-label={state + " checkbox"}
              />
              {state}
            </label>
          ))}
        </div>
        <h3>Radio buttons</h3>
        <div className="prep-selection-examples">
          {[
            "Unchecked",
            "Checked",
            "Hover",
            "Focus",
            "Disabled",
            "Disabled checked",
          ].map((state) => (
            <label key={state} data-preview-state={state.toLowerCase()}>
              <Radio
                name={"preview-radio-" + state}
                defaultChecked={
                  state === "Checked" || state === "Disabled checked"
                }
                disabled={state.startsWith("Disabled")}
                aria-label={state + " radio"}
              />
              {state}
            </label>
          ))}
        </div>
        <h3>Filters and segments</h3>
        <div className="prep-showcase-controls">
          <FilterChip
            selected={selected}
            onClick={() => setSelected(!selected)}
          >
            Arrays
          </FilterChip>
          <FilterChip
            selected={!selected}
            onClick={() => setSelected(!selected)}
          >
            Strings
          </FilterChip>
          <div className="prep-segments" role="group" aria-label="Preview view">
            {["Topics", "Patterns"].map((value) => (
              <Button
                key={value}
                size="compact"
                variant="ghost"
                aria-pressed={segment === value}
                onClick={() => setSegment(value)}
              >
                {segment === value && <span aria-hidden="true">✓</span>}
                {value}
              </Button>
            ))}
          </div>
        </div>
      </section>
      <section>
        <h2>Typography</h2>
        <div className="prep-type-scale">
          <div>
            <span>Page · 40/32px · 600</span>
            <p className="prep-type-page">Prepare with confidence.</p>
          </div>
          <div>
            <span>Section · 22px · 600</span>
            <p className="prep-type-section">Explore your topics</p>
          </div>
          <div>
            <span>Question · 15px · 500</span>
            <p className="prep-type-question">Find the Duplicate Number</p>
          </div>
          <div>
            <span>Body · 15px · 400</span>
            <p>
              Save your approach, revisit tricky questions, and keep practicing.
            </p>
          </div>
          <div>
            <span>Metadata · 13px · 400</span>
            <p className="prep-showcase-meta">12 / 48 solved · 25% complete</p>
          </div>
        </div>
      </section>
      <section>
        <h2>Company question</h2>
        <div className="prep-preview-table">
          <div className="prep-preview-heading">
            <span>Status</span>
            <span>Question</span>
            <span>Difficulty</span>
            <span>Topics</span>
            <span>Frequency</span>
            <span>Revision</span>
            <span>Notes</span>
          </div>
          <div className="prep-preview-question">
            <CompletionToggle
              checked={solved}
              onClick={() => setSolved(!solved)}
              aria-label={
                solved ? "Mark Two Sum unsolved" : "Mark Two Sum solved"
              }
            />
            <div>
              <p className="prep-type-question">Two Sum</p>
              <span className="prep-preview-tag">Hash Map</span>
            </div>
            <span className="prep-preview-easy">Easy</span>
            <span>Array, Hash Table</span>
            <span className="prep-numeric">85%</span>
            <Button
              size="compact"
              variant="ghost"
              aria-label="Preview revision"
              aria-expanded={revisionPreview}
              onClick={() => setRevisionPreview(!revisionPreview)}
            >
              <History size={16} />
              <span>Revision</span>
            </Button>
            <Button
              size="compact"
              variant="ghost"
              onClick={() => setNote(!note)}
            >
              <StickyNote size={16} />
              <span>Note</span>
            </Button>
          </div>
        </div>
      </section>
      {revisionPreview && (
        <p role="status" className="prep-showcase-meta">
          Revision preview: the live question list lets you rate your confidence
          and review its history.
        </p>
      )}
      <section>
        <h2>Compact note</h2>
        <article className="prep-preview-note">
          <div>
            <StickyNote size={18} aria-hidden="true" />
            <h3>Two Sum</h3>
          </div>
          <p className="prep-showcase-meta">Private note · saved question</p>
          <div className="prep-showcase-controls">
            <Button
              size="compact"
              variant="ghost"
              aria-expanded={note}
              onClick={() => setNote(!note)}
            >
              <Eye size={16} />
              {note ? "Hide note" : "View note"}
            </Button>
            <Button
              size="compact"
              variant="ghost"
              aria-label="Clear example note"
              onClick={() => setNote(false)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
          {note && (
            <p>
              Store each value and its index in a hash map. Check the complement
              before inserting.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}
