/*
 AI-INDEX
 - Tags: mechanics.economy
 - See: docs/ai/index.json
*/
// Economy helpers: currency registry, wallet utils, and helpers for drops

export interface CurrencySpec {
  value: number;
  color: number;
  radius: number;
  label: string;
}

export interface Wallet {
  total: number;
  counts: {
    copper: number;
    silver: number;
  };
}

export interface SceneWithEconomy {
  wallet?: Wallet;
  collectedCurrency?: Set<string>;
  scene?: {
    get(sceneName: string): any;
  };
}

export type CurrencyType = 'copper' | 'silver';
export type ItemType = 'weapon' | 'shield' | 'consumable';

export const CURRENCIES: Record<CurrencyType, CurrencySpec> = {
  copper: { value: 1, color: 0xB87333, radius: 6, label: 'Copper Ingot' },
  silver: { value: 5, color: 0xC0C0C0, radius: 8, label: 'Silver Ingot' }
  // gold: { value: 10, color: 0xFFD700, radius: 8, label: 'Gold Ingot' }, // future
};

export function getCurrencySpec(type: CurrencyType): CurrencySpec | null {
  return CURRENCIES[type] || null;
}

export function initWallet(scene: SceneWithEconomy): void {
  if (!scene.wallet) {
    scene.wallet = { total: 0, counts: { copper: 0, silver: 0 } };
  }
  if (!scene.collectedCurrency) scene.collectedCurrency = new Set();
}

export function addToWallet(scene: SceneWithEconomy, type: CurrencyType, amount = 1): void {
  initWallet(scene);
  const spec = getCurrencySpec(type);
  if (!spec) return;
  const inc = amount || 1;
  scene.wallet!.counts[type] = (scene.wallet!.counts[type] || 0) + inc;
  scene.wallet!.total += inc * spec.value;
  // Update HUD if available
  try {
    const ui = scene.scene?.get('UIScene');
    ui?.updateCurrency?.(scene.wallet!.total, scene.wallet!.counts.copper || 0, scene.wallet!.counts.silver || 0);
  } catch (e) {
    // UI may not be ready yet
  }
}

// Spend an amount of currency in pence; uses silver (5p) first then copper (1p).
export function spendFromWallet(scene: SceneWithEconomy, costPence: number): boolean {
  initWallet(scene);
  const wallet = scene.wallet;
  if (!wallet) return false;
  const total = (wallet.counts.silver || 0) * 5 + (wallet.counts.copper || 0);
  if (costPence > total) return false;

  let remaining = costPence;
  // Spend silver first
  const takeSilver = Math.min(Math.floor(remaining / 5), wallet.counts.silver || 0);
  wallet.counts.silver = (wallet.counts.silver || 0) - takeSilver;
  remaining -= takeSilver * 5;
  // Spend copper
  const takeCopper = Math.min(remaining, wallet.counts.copper || 0);
  wallet.counts.copper = (wallet.counts.copper || 0) - takeCopper;
  remaining -= takeCopper;

  // If not exact, make change by breaking one silver into 5 copper
  if (remaining > 0 && (wallet.counts.silver || 0) > 0) {
    wallet.counts.silver -= 1;
    wallet.counts.copper = (wallet.counts.copper || 0) + 5;
    const takeCopper2 = Math.min(remaining, wallet.counts.copper || 0);
    wallet.counts.copper -= takeCopper2;
    remaining -= takeCopper2;
  }

  // Recompute total and update HUD
  wallet.total = (wallet.counts.silver || 0) * 5 + (wallet.counts.copper || 0);
  try {
    const ui = scene.scene?.get('UIScene');
    ui?.updateCurrency?.(wallet.total, wallet.counts.copper || 0, wallet.counts.silver || 0);
  } catch {}
  return remaining === 0;
}

export function getWalletTotal(scene: SceneWithEconomy): number {
  initWallet(scene);
  const w = scene.wallet!;
  return (w.counts.silver || 0) * 5 + (w.counts.copper || 0);
}

// Pricing helpers for shop items (in pence)
const WEAPON_PRICES: Record<string, number> = {
  starter: 2,
  basic: 8,
  fast: 12,
  strong: 15
};

const SHIELD_PRICES: Record<string, number> = {
  basic: 6,
  light: 10,
  strong: 14
};

const CONSUMABLE_PRICES: Record<string, number> = {
  healthPotion: 5,
  staminaTonic: 4,
  healingSalve: 8
};

export function getItemPrice(type: ItemType, subtype: string): number {
  if (type === 'weapon') return WEAPON_PRICES[subtype] ?? 8;
  if (type === 'shield') return SHIELD_PRICES[subtype] ?? 6;
  if (type === 'consumable') return CONSUMABLE_PRICES[subtype] ?? 3;
  return 1;
}