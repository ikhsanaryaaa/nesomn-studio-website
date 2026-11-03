/** Public build configuration. Never put credentials in VITE_* variables. */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const apiUrl = (path: string) => API_BASE + path;
export const isLandingHost = () => {
  const origin = import.meta.env.VITE_LANDING_URL;
  return !!origin && typeof window !== 'undefined' && window.location.origin === origin;
};
