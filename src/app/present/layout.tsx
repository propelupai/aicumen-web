/** Full-screen projector view — no teacher nav chrome. */
export default function PresentLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
