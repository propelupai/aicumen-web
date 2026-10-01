export type BrandId = "aicumen" | "aingel";

export type Brand = {
  id: BrandId;
  /** User-facing product name. */
  name: string;
  metaTitle: string;
  metaDescription: string;
  /** When false, hide CBSE wording from the UI (AIngel / non-CBSE pitch). */
  showCbse: boolean;
};

export const BRANDS: Record<BrandId, Brand> = {
  aicumen: {
    id: "aicumen",
    name: "AICUMEN",
    showCbse: true,
    metaTitle: "AICUMEN — Socratic Computational Thinking for Schools",
    metaDescription:
      "AICUMEN helps CBSE schools meet the Computational Thinking mandate with teacher-first Socratic prompts — layered into the lessons you already teach.",
  },
  aingel: {
    id: "aingel",
    name: "AIngel",
    showCbse: false,
    metaTitle: "AIngel — Socratic Computational Thinking for Schools",
    metaDescription:
      "AIngel helps schools build computational thinking with teacher-first Socratic prompts — layered into the lessons you already teach.",
  },
};

/** Hostnames that should render the AIngel brand (aingel.propelup.ai and local previews). */
export function isAingelHost(host: string | null | undefined): boolean {
  const hostname = (host ?? "").split(":")[0].trim().toLowerCase();
  return hostname === "aingel" || hostname.startsWith("aingel.");
}

export function brandFromHost(host: string | null | undefined): Brand {
  return isAingelHost(host) ? BRANDS.aingel : BRANDS.aicumen;
}
