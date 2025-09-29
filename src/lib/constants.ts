export const SCENES = {
  MAIN: 'MainScene',
  UI: 'UIScene',
  TEST: 'TestScene'
} as const;

export const MAP_IDS = {
  OVERWORLD_00: 'overworld_00',
  OVERWORLD_01: 'overworld_01',
  OVERWORLD_02: 'overworld_02',
  OVERWORLD_03: 'overworld_03',
  SHOP_01: 'shop_01'
} as const;

export const DOOR_IDS = {
  SHOP_DOOR_01: 'shop_door_01',
  SHOP_EXIT_01: 'shop_exit_01',
  EAST_EXIT_A: 'east_exit_A',
  EAST_EXIT_B: 'east_exit_B',
  WEST_ENTRY_A: 'west_entry_A',
  WEST_ENTRY_B: 'west_entry_B',
  NORTH_EXIT_A: 'north_exit_A',
  SOUTH_ENTRY_A: 'south_entry_a',
  SOUTH_EXIT_A: 'south_exit_a',
  NORTH_ENTRY_A: 'north_entry_a'
} as const;

export const DIRECTIONS = {
  RIGHT: 'right',
  LEFT: 'left',
  UP: 'up',
  DOWN: 'down'
} as const;

export type SceneKey = typeof SCENES[keyof typeof SCENES];
export type MapId = typeof MAP_IDS[keyof typeof MAP_IDS];
export type DoorId = typeof DOOR_IDS[keyof typeof DOOR_IDS];