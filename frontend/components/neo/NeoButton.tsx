"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "pink" | "blue" | "dark" | "snow" | "ghost";

export type NeoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "neo-btn",
  pink: "neo-btn neo-btn-pink",
  blue: "neo-btn neo-btn-blue",
  dark: "neo-btn neo-btn-dark",
  snow: "neo-btn neo-btn-snow",
  ghost: "neo-btn neo-btn-ghost",
};

const SIZE_CLASS: Record<NonNullable<NeoButtonProps["size"]>, string> = {
  sm: "text-sm !py-2 !px-3.5",
  md: "",
  lg: "text-lg !py-3.5 !px-7",
};

const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(function NeoButton(
  { variant = "primary", size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={clsx(VARIANT_CLASS[variant], SIZE_CLASS[size], className)} {...rest}>
      {children}
    </button>
  );
});

export default NeoButton;
