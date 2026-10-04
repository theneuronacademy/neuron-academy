// Popup content model (admin-ready). The live popup system
// (AdvertisementPopup + lib/mockStore.ts) stays the source of truth —
// this file defines the data contract Phase 2 will persist.

export interface PopupContent {
  id: string;
  title: string;
  description: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  buttonText: string;
  buttonUrl: string;
  delayMs: number;
  frequency: "once-per-session" | "once-per-day" | "every-visit";
  active: boolean;
}

export const POPUP_DEFAULTS = {
  delayMs: 5000,
  sessionKey: "neuron_ad_popup_dismissed",
  frequency: "once-per-session" as const,
};
