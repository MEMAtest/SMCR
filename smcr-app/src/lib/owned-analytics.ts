export function trackOwnedEvent(
  eventName: 'lead_submitted' | 'signup_completed' | 'demo_requested' | 'download_completed' | 'checkout_started' | 'purchase_completed',
  properties: Record<string, string | number | boolean> = {},
): boolean {
  if (typeof window === 'undefined') return false;
  const analyticsWindow = window as typeof window & {
    ownedPortfolioTrack?: (name: string, values?: Record<string, string | number | boolean>) => boolean;
    ownedPortfolioQueue?: Array<[string, Record<string, string | number | boolean>]>;
  };
  if (analyticsWindow.ownedPortfolioTrack) {
    return analyticsWindow.ownedPortfolioTrack(eventName, properties);
  }
  (analyticsWindow.ownedPortfolioQueue ||= []).push([eventName, properties]);
  return true;
}
