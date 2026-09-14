"use client";

import { useParams } from "next/navigation";
import { useWeekend } from "./store";

/** Voor pagina's onder /weekends/[slug]: het weekend uit de URL + patch-helpers. */
export function useCurrentWeekend() {
  const params = useParams<{ slug: string }>();
  return useWeekend(params.slug);
}
