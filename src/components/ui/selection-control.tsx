"use client";
import { useEffect, useRef, type ComponentProps } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Checkbox({
  indeterminate = false,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  });
  return (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      className={cn("prep-checkbox", className)}
    />
  );
}
export function Radio({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  return (
    <input {...props} type="radio" className={cn("prep-radio", className)} />
  );
}
export function CompletionToggle({
  checked,
  className,
  ...props
}: ComponentProps<"button"> & { checked: boolean }) {
  return (
    <button
      {...props}
      type="button"
      className={cn("prep-completion-toggle", className)}
      aria-pressed={checked}
    >
      <span className="prep-selection-box" aria-hidden="true">
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
    </button>
  );
}
export function FilterChip({
  selected,
  children,
  ...props
}: ComponentProps<"button"> & { selected: boolean }) {
  return (
    <Button
      {...props}
      type="button"
      size="compact"
      variant="secondary"
      aria-pressed={selected}
      className={cn("prep-filter-chip", props.className)}
    >
      <span className="prep-chip-marker" aria-hidden="true">
        {selected ? <Check size={13} /> : <Minus size={13} />}
      </span>
      {children}
    </Button>
  );
}
