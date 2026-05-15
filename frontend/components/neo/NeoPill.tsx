"use client";

import { ReactNode } from "react";
import clsx from "clsx";

export default function NeoPill({
  children,
  variant = "snow",
  className,
  onClick,
}: {
  children: ReactNode;
  variant?: "snow" | "dark" | "primary" | "pink" | "blue";
  className?: string;
  onClick?: () => void;
}) {
  const variants: Record<string, string> = {
    snow: "bg-snow",
    dark: "bg-ink text-snow",
    primary: "bg-primary",
    pink: "bg-secondary",
    blue: "bg-accent text-snow",
  };
  return (
    <span
      className={clsx("neo-pill", variants[variant], className, onClick && "cursor-pointer")}
      onClick={onClick}
    >
      {children}
    </span>
  );
}
