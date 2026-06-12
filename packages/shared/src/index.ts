/**
 * Tipe & kontrak bersama lintas workspace (client, api, worker).
 * Disiapkan untuk Eden treaty types pada milestone berikutnya.
 */

/** Respons dari endpoint health check API. */
export type HealthResponse = {
  status: 'ok';
  uptime: number;
};
