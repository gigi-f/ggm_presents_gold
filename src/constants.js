/*
 AI-INDEX
 - Tags: engine.constants
 - See: docs/ai/index.json
*/

// Centralized constants to avoid stringly-typed keys and typos

// Scene keys
const SCENES = Object.freeze({
  MAIN: 'MainScene',
  UI: 'UIScene',
  TEST: 'TestScene'
});

// Map IDs
const MAP_IDS = Object.freeze({
  OVERWORLD_00: 'overworld_00',
  OVERWORLD_01: 'overworld_01',
  OVERWORLD_02: 'overworld_02',
  SHOP_01: 'shop_01'
});

// Door IDs (only those referenced from code; data may contain more)
const DOOR_IDS = Object.freeze({
  SHOP_DOOR_01: 'shop_door_01',
  SHOP_EXIT_01: 'shop_exit_01',
  EAST_EXIT_A: 'east_exit_A',
  EAST_EXIT_B: 'east_exit_B',
  WEST_ENTRY_A: 'west_entry_A',
  WEST_ENTRY_B: 'west_entry_B',
  NORTH_EXIT_A: 'north_exit_A',
  SOUTH_ENTRY_A: 'south_entry_A'
});

// Direction strings
const DIRECTIONS = Object.freeze({
  RIGHT: 'right',
  LEFT: 'left',
  UP: 'up',
  DOWN: 'down'
});

// Export to window for non-module usage (optional in browsers)
if (typeof window !== 'undefined') {
  window.SCENES = SCENES;
  window.MAP_IDS = MAP_IDS;
  window.DOOR_IDS = DOOR_IDS;
  window.DIRECTIONS = DIRECTIONS;
}
