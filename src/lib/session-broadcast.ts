/** Sync live session state between teacher tablet and projector window. */

export type PresentPhase = "stem" | "coach" | "extend" | "done";

export type SessionPresentState = {
  activityId: number;
  phase: PresentPhase;
  coachIndex: number;
  title: string;
  emoji: string;
  theme: string;
  chapterTitle: string;
  subjectLine: string;
  questCode: string;
  /** Text shown on the board */
  displayText: string;
  stepLabel: string | null;
  stepNumber: number | null;
  totalSteps: number;
  deliveryAid: { label: string; text: string } | null;
};

const CHANNEL_PREFIX = "aicumen-present-";

export function presentChannelKey(channelId: string): string {
  return `${CHANNEL_PREFIX}${channelId}`;
}

export function createPresentChannelId(activityId: number): string {
  return `${activityId}-${crypto.randomUUID().slice(0, 8)}`;
}

export function broadcastPresentState(channelId: string, state: SessionPresentState): void {
  if (typeof window === "undefined") return;
  try {
    const ch = new BroadcastChannel(presentChannelKey(channelId));
    ch.postMessage(state);
    ch.close();
  } catch {
    // BroadcastChannel unavailable — projector won't sync
  }
}

export function subscribePresentState(
  channelId: string,
  onState: (state: SessionPresentState) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const ch = new BroadcastChannel(presentChannelKey(channelId));
    ch.onmessage = (ev: MessageEvent<SessionPresentState>) => {
      if (ev.data?.activityId) onState(ev.data);
    };
    return () => ch.close();
  } catch {
    return () => {};
  }
}
