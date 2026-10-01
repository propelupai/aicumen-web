"use client";

import { createContext, useContext } from "react";
import { BRANDS, type Brand } from "@/lib/brand";

const BrandContext = createContext<Brand>(BRANDS.aicumen);

export function BrandProvider({
  brand,
  children,
}: {
  brand: Brand;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}
