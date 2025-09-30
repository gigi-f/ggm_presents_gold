/**
 * Simple working examples demonstrating library benefits
 * These are proof-of-concept implementations showing how the recommended libraries
 * would improve the codebase without complex type issues
 */

// Example 1: Simple Zod validation for item data
import { z } from 'zod';

export const SimpleItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['weapon', 'shield', 'consumable']),
  price: z.number().min(0)
});

export function validateItem(data: unknown) {
  try {
    return SimpleItemSchema.parse(data);
  } catch (error) {
    console.error('Invalid item data:', error);
    return null;
  }
}

// Example 2: Simple event system with EventEmitter3
import EventEmitter from 'eventemitter3';

export const gameEvents = new EventEmitter();

// Usage examples that would replace direct scene communication:
export function emitPlayerDamage(amount: number) {
  gameEvents.emit('player:damage', { amount });
}

export function emitCurrencyAdd(type: string, amount: number) {
  gameEvents.emit('currency:add', { type, amount });
}

export function onPlayerDamage(callback: (data: any) => void) {
  gameEvents.on('player:damage', callback);
  return () => gameEvents.off('player:damage', callback);
}

// Example 3: Simple state store with Zustand  
import { create } from 'zustand';

interface SimpleGameState {
  playerHp: number;
  gold: number;
  currentMap: string;
  inventory: any[];
  
  setPlayerHp: (hp: number) => void;
  addGold: (amount: number) => void;
  setCurrentMap: (mapId: string) => void;
  addToInventory: (item: any) => void;
}

export const useSimpleGameStore = create<SimpleGameState>((set) => ({
  playerHp: 100,
  gold: 0,
  currentMap: 'OVERWORLD_01',
  inventory: [],
  
  setPlayerHp: (hp) => set({ playerHp: Math.max(0, hp) }),
  addGold: (amount) => set((state) => ({ gold: state.gold + amount })),
  setCurrentMap: (mapId) => set({ currentMap: mapId }),
  addToInventory: (item) => set((state) => ({ 
    inventory: [...state.inventory, item] 
  }))
}));

// Example integration showing how these work together
export function demonstrateIntegration() {
  // 1. Validate incoming data with Zod
  const itemData = {
    id: 'sword_001',
    name: 'Iron Sword',
    type: 'weapon',
    price: 50
  };
  
  const validItem = validateItem(itemData);
  if (!validItem) {
    console.error('Invalid item data');
    return;
  }
  
  // 2. Update state with Zustand
  const store = useSimpleGameStore.getState();
  store.addToInventory(validItem);
  
  // 3. Emit events with EventEmitter3
  gameEvents.emit('inventory:add', { item: validItem });
  
  // 4. Set up reactive listeners
  const unsubscribe = onPlayerDamage((data) => {
    console.log(`Player took ${data.amount} damage`);
    store.setPlayerHp(store.playerHp - data.amount);
  });
  
  // Simulate damage
  emitPlayerDamage(10);
  
  // Cleanup
  unsubscribe();
  
  console.log('Current state:', useSimpleGameStore.getState());
}

// Example showing how this would simplify current economy code
export function modernizeEconomyExample() {
  // Instead of manual validation and state management in current code:
  // - Hard-coded price lookups
  // - Direct scene property modification
  // - Manual UI updates
  
  // New approach:
  const itemPrice = 25;
  const store = useSimpleGameStore.getState();
  
  if (store.gold >= itemPrice) {
    store.addGold(-itemPrice);
    gameEvents.emit('purchase:success', { price: itemPrice });
  } else {
    gameEvents.emit('purchase:failed', { reason: 'insufficient_funds' });
  }
  
  // UI automatically updates via event listeners
  gameEvents.on('purchase:success', () => {
    console.log('Purchase successful! Playing sound...');
  });
  
  gameEvents.on('purchase:failed', (data) => {
    console.log(`Purchase failed: ${data.reason}`);
  });
}

// Bundle size impact analysis
export const LIBRARY_SIZES = {
  'zod': '~45KB (data validation)',
  'zustand': '~8KB (state management)', 
  'eventemitter3': '~7KB (event system)',
  'lodash-es': '~5-20KB (utilities, tree-shakable)',
  'total_estimated': '~65-80KB additional'
};

// Benefits summary
export const BENEFITS = {
  'Type Safety': 'Catch errors at compile time instead of runtime',
  'State Management': 'Single source of truth, predictable updates',
  'Event System': 'Decoupled architecture, easier testing',
  'Validation': 'Robust data parsing with helpful error messages',
  'Developer Experience': 'Better IDE support, refactoring tools',
  'Maintainability': 'Cleaner code, easier to understand and modify',
  'Scalability': 'Patterns that work for larger codebases'
};

console.log('Library integration examples loaded successfully');
console.log('Estimated bundle impact:', LIBRARY_SIZES);
console.log('Key benefits:', BENEFITS);