export enum CellType {
  AIR = 0,
  DIRT = 1,
  ROCK = 2,
  FOOD = 3,
  NEST = 4,
  STORAGE = 5,
  NURSERY = 6,
  DEFENSE = 7, // Sandbag/Wall
  GEM = 8, // Rare points
}

export enum AntJob {
  IDLE = 'IDLE',
  MINING = 'MINING',
  FORAGING = 'FORAGING',
  RETURNING = 'RETURNING',
  BUILDING = 'BUILDING',
  ATTACKING = 'ATTACKING',
  SLEEPING = 'SLEEPING',
  FLEEING = 'FLEEING',
}

export enum AntType {
  WORKER = 'WORKER',
  SOLDIER = 'SOLDIER',
  SUPER_SOLDIER = 'SUPER_SOLDIER',
  QUEEN = 'QUEEN',
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Ant {
  id: number;
  type: AntType;
  x: number;
  y: number;
  job: AntJob;
  target: Vector2D | null;
  carrying: boolean;
  health: number;
  maxHealth: number;
  energy: number;
  angle: number;
  sleepiness: number; // 0-100
  // RPG Stats
  speed: number;
  strength: number;
  level: number;
  xp: number;
  kills: number; // Tracker for evolution
}

export interface GameConfig {
  width: number;
  height: number;
  cellSize: number;
}

export interface Resources {
  food: number;
  materials: number;
  population: number;
  maxFood: number;
  score: number;
}

export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'alert' | 'success' | 'ai';
  timestamp: number;
}

export interface WorldState {
  grid: CellType[][];
  ants: Ant[];
  particles: Particle[];
  resources: Resources;
  pheromones: number[][]; // 0-1 intensity map
  enemies: Enemy[];
  time: number; // 0 to 2400 (Day/Night cycle)
  autoBreed: boolean; // Auto-spawn setting
  threatLevel: number; // 0-100
  gameSpeed: number;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  type: 'SPIDER' | 'BEETLE' | 'CENTIPEDE' | 'WASP' | 'TERMITE';
  health: number;
  maxHealth: number;
  targetId: number | null;
}