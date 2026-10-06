// Modelo de datos compartido por content script, background, popup y opciones.
// Solo cifras agregadas: nunca HTML, conversaciones ni credenciales.

export type SourceKind = 'observed' | 'manual' | 'demo';
export type QuotaKind = 'session' | 'weekly' | 'other';

export interface ResetInfo {
  /** ISO 8601 en UTC; null si no se pudo normalizar. */
  at: string | null;
  /** Texto original mostrado por la página (o null si no había). */
  raw: string | null;
  /** true si se derivó de un texto relativo ("en 2 h"). */
  approximate: boolean;
}

export interface Money {
  /** Decimal canónico con punto, p. ej. "46" o "0.00". */
  amount: string;
  /** Código ISO (USD, EUR, CLP) o símbolo si no se pudo identificar. */
  currency: string;
}

export interface Quota {
  id: string;
  kind: QuotaKind;
  label: string;
  /** 0–100; null = no disponible (nunca 0 por defecto). */
  percent: number | null;
  reset: ResetInfo;
}

export interface CreditPool {
  id: string;
  label: string;
  percentUsed: number | null;
  remaining: Money | null;
  total: Money | null;
  expiresRaw: string | null;
}

export interface SpendLimit {
  spent: Money;
  limit: Money;
}

export interface UsageCredits {
  balance: Money | null;
  monthlyLimit: SpendLimit | null;
}

export interface ProductShare {
  label: string;
  percent: number;
}

export interface UsageSnapshot {
  version: 1;
  source: SourceKind;
  /** Momento de la observación o del ingreso manual (ISO). */
  observedAt: string;
  /** Zona horaria del navegador al observar, para interpretar reinicios. */
  timeZone: string;
  plan: string | null;
  quotas: Quota[];
  credits: CreditPool[];
  usageCredits: UsageCredits | null;
  productShares: ProductShare[];
  coverage: 'complete' | 'partial';
  /** Códigos de campos que no se pudieron leer. */
  missing: string[];
}

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  panelEnabled: boolean;
  theme: Theme;
  staleMinutes: number;
  /** Cada cuántos minutos releer la vista de uso en una pestaña inactiva (0 = nunca). */
  autoRefreshMinutes: number;
  thresholds: number[];
  activeSource: SourceKind;
  manualAlerts: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  panelEnabled: true,
  theme: 'auto',
  staleMinutes: 15,
  autoRefreshMinutes: 10,
  thresholds: [50, 80, 100],
  activeSource: 'observed',
  manualAlerts: false,
};

export interface Alert {
  key: string;
  metric: string;
  threshold: number;
  percent: number;
  createdAt: string;
}

export interface PanelState {
  x: number | null;
  y: number | null;
  minimized: boolean;
}

export const STORAGE_KEYS = {
  settings: 'settings',
  panel: 'panel',
  alertsFired: 'alerts:fired',
  alertsActive: 'alerts:active',
  refresh: 'refresh:tab',
  liveOrg: 'live:org',
  snap: (s: SourceKind) => `snap:${s}` as const,
} as const;

export const USAGE_URL = 'https://claude.ai/settings/usage';
export const USIV_URL = 'https://usiv.cl/?utm_source=usage-meter&utm_medium=extension';
export const REPO_URL = 'https://github.com/cfloresusiv/USIV_Usage_Meter';
