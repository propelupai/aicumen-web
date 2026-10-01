import { headers } from "next/headers";
import { brandFromHost, type Brand } from "@/lib/brand";

export async function resolveBrand(): Promise<Brand> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return brandFromHost(host);
}
