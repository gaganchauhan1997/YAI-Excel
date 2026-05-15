"use client";

import { ReactNode } from "react";
import clsx from "clsx";

export default function NeoCard({
  children,
  className,
  tilt,
  shadow = "ink",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  tilt?: "l" | "r";
  shadow?: "ink" | "pink" | "blue" | "primary";
  hover?: boolean;
}) {
  const shadowClass =
    shadow === "pink"
      ? "shadow-neo-pink"
      : shadow === "blue"
      ? "shadow-neo-blue"
      : shadow === "primary"
      ? "shadow-neo-primary"
      : "shadow-neo";
  return (
    <div
      className={clsx(
        "bg-snow border-[3px] border-ink p-5",
        shadowClass,
        tilt === "l" && "tilt-l",
        tilt === "r" && "tilt-r",
        hover && "transition-transform hover:-translate-x-1 hover:-translate-y-1",
        className,
      )}
    >
      {children}
    </div>
  );
}
