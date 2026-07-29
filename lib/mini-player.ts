import { artworkProxyPath } from "@/lib/artwork";

export const MINI_PLAYER_PREF_KEY = "colab.miniPlayerEnabled";

export function isMiniPlayerEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MINI_PLAYER_PREF_KEY) !== "0";
}

export function setMiniPlayerEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MINI_PLAYER_PREF_KEY, enabled ? "1" : "0");
}

export function supportsDocumentPip(): boolean {
  return (
    typeof window !== "undefined" &&
    "documentPictureInPicture" in window &&
    typeof (
      window as Window & {
        documentPictureInPicture?: { requestWindow: unknown };
      }
    ).documentPictureInPicture?.requestWindow === "function"
  );
}

type DocumentPip = {
  window: Window | null;
  requestWindow: (options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
  }) => Promise<Window>;
};

export function getDocumentPip(): DocumentPip | null {
  if (!supportsDocumentPip()) return null;
  return (
    window as unknown as { documentPictureInPicture: DocumentPip }
  ).documentPictureInPicture;
}

export function mediaArtworkUrl(trackId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${artworkProxyPath(trackId)}`;
}
