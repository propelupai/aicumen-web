import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { resolveBrand } from "@/lib/resolve-brand";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveBrand();
  return {
    title: brand.metaTitle,
    description: brand.metaDescription,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brand = await resolveBrand();
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers brand={brand}>{children}</Providers>
      </body>
    </html>
  );
}
