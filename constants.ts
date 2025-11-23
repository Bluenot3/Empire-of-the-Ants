import { AntType, CellType } from './types';

export const GRID_WIDTH = 120; // Even Wider world
export const GRID_HEIGHT = 80;
export const CELL_SIZE = 12;

export const COLORS = {
  [CellType.AIR]: '#2d2d2d',
  [CellType.DIRT]: '#5d4037',
  [CellType.ROCK]: '#263238', // Dark blue-grey
  [CellType.FOOD]: '#4caf50',
  [CellType.NEST]: '#5e35b1', // Deep Purple
  [CellType.STORAGE]: '#ff6f00', // Amber/Orange
  [CellType.NURSERY]: '#ec407a', // Pink
  [CellType.DEFENSE]: '#8d6e63', // Hard dirt/sandbag
  [CellType.GEM]: '#00e5ff', // Cyan/Diamond
};

export const ANT_COLORS = {
  [AntType.WORKER]: '#ffb74d',
  [AntType.SOLDIER]: '#e53935',
  [AntType.SUPER_SOLDIER]: '#ff1744', // Bright Red
  [AntType.QUEEN]: '#d500f9',
};

export const COSTS = {
  WORKER: { food: 10 },
  SOLDIER: { food: 30 },
  SUPER_SOLDIER: { food: 150 },
  BUILD_STORAGE: { materials: 10 },
  BUILD_NURSERY: { materials: 20 },
  BUILD_DEFENSE: { materials: 5 },
};

export const INITIAL_RESOURCES = {
  food: 300, 
  materials: 100,
  population: 1,
  maxFood: 1000,
  score: 0,
};

export const PHEROMONE_DECAY = 0.95; // Slower decay for longer trails
export const MAX_ANTS = 800; // Massive cap for wars
export const DAY_LENGTH = 2000; // Ticks per day

export const LEVEL_SCALER = 0.15; // Visual size increase per level