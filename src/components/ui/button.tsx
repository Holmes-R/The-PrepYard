"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva("prep-button", {
  variants: {
    variant: {
      default: "prep-button--primary",
      secondary: "prep-button--secondary",
      outline: "prep-button--secondary",
      ghost: "prep-button--ghost",
    },
    size: {
      default: "prep-button--regular",
      compact: "prep-button--compact",
      icon: "prep-button--icon",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      {...props}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onClick={(event) => {
        if (disabled || loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <LoaderCircle
              className="prep-spinner"
              size={16}
              aria-hidden="true"
            />
          )}
          {children}
        </>
      )}
    </Component>
  );
}
