"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ToastProvider, Toaster } from "@/hooks/use-toast";
import { AuthProvider } from "@/context/auth-context";
import { BrandProvider } from "@/context/brand-context";
import type { Brand } from "@/lib/brand";

export function Providers({
  children,
  brand,
}: {
  children: React.ReactNode;
  brand: Brand;
}) {
  return (
    <BrandProvider brand={brand}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </BrandProvider>
  );
}
