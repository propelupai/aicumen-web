export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  if (!part) return "there";
  if (part.toLowerCase().startsWith("ms.") || part.toLowerCase().startsWith("mr.")) {
    return part;
  }
  return part;
}
