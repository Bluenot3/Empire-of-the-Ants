import { useRef, useEffect, useCallback, useState } from 'react';
import { WorldState, CellType, Ant, AntType, AntJob, Enemy, Resources, Particle } from '../types';
import { GRID_WIDTH, GRID_HEIGHT, COSTS, PHEROMONE_DECAY, MAX_ANTS, INITIAL_RESOURCES, DAY_LENGTH, COLORS, LEVEL_SCALER } from '../constants';

const rand = (n: number) => Math.floor(Math.random() * n);

export const useGameEngine = () => {
  const gameStateRef = useRef<WorldState>({
    grid: [],
    ants: [],
    particles: [],
    resources: { ...INITIAL_RESOURCES },
    pheromones: [],
    enemies: [],
    time: 600, // Start at "morning"
    autoBreed: false,
    threatLevel: 0,
    gameSpeed: 1,
  });

  const [tick, setTick] = useState(0);

  // Initialize Game
  useEffect(() => {
    const initialGrid: CellType[][] = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(CellType.DIRT));
    const initialPheromones: number[][] = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));

    // Sky
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        initialGrid[y][x] = CellType.AIR;
      }
    }

    // Nest Setup
    const centerX = Math.floor(GRID_WIDTH / 2);
    const centerY = 35; // Deeper nest
    
    // Create a small starter room
    for(let dy=-2; dy<=2; dy++) {
        for(let dx=-2; dx<=2; dx++) {
            initialGrid[centerY+dy][centerX+dx] = CellType.NEST;
        }
    }
    // Tunnel to surface
    for(let y=15; y<centerY; y++) {
        initialGrid[y][centerX] = CellType.AIR;
    }

    // Queen
    const queen: Ant = {
      id: 1,
      type: AntType.QUEEN,
      x: centerX,
      y: centerY,
      job: AntJob.IDLE,
      target: null,
      carrying: false,
      health: 2000,
      maxHealth: 2000,
      energy: 100,
      angle: 0,
      sleepiness: 0,
      speed: 1.0,
      strength: 5,
      level: 10,
      xp: 0,
      kills: 0
    };

    // Initial Workers
    const ants: Ant[] = [queen];
    for(let i=0; i<12; i++) {
        ants.push({
            id: 2 + i,
            type: AntType.WORKER,
            x: centerX + rand(3) - 1,
            y: centerY + rand(3) - 1,
            job: AntJob.IDLE,
            target: null,
            carrying: false,
            health: 40,
            maxHealth: 40,
            energy: 100,
            angle: 0,
            sleepiness: 0,
            speed: 0.8 + Math.random() * 0.4,
            strength: 1,
            level: 1,
            xp: 0,
            kills: 0
        });
    }

    // Random Food Clusters & Gems
    for(let i=0; i<40; i++) {
        const fx = rand(GRID_WIDTH - 10) + 5;
        const fy = rand(GRID_HEIGHT - 20) + 20;
        const size = rand(5) + 2;
        for(let dy=0; dy<size; dy++){
            for(let dx=0; dx<size; dx++){
                if(fy+dy < GRID_HEIGHT && fx+dx < GRID_WIDTH)
                    initialGrid[fy+dy][fx+dx] = CellType.FOOD;
            }
        }
    }

    // Buried Gems
    for(let i=0; i<20; i++) {
        const gx = rand(GRID_WIDTH - 4) + 2;
        const gy = rand(GRID_HEIGHT - 30) + 30; // Deep
        initialGrid[gy][gx] = CellType.GEM;
    }

    gameStateRef.current = {
      grid: initialGrid,
      ants: ants,
      particles: [],
      resources: { ...INITIAL_RESOURCES },
      pheromones: initialPheromones,
      enemies: [],
      time: 600,
      autoBreed: false,
      threatLevel: 0,
      gameSpeed: 1,
    };
  }, []);

  // --- Logic Helpers ---

  const getCell = (x: number, y: number) => {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return CellType.ROCK;
    return gameStateRef.current.grid[y][x];
  };

  const setCell = (x: number, y: number, type: CellType) => {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;
    gameStateRef.current.grid[y][x] = type;
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, speed: number) => {
      for(let i=0; i<count; i++) {
          gameStateRef.current.particles.push({
              id: Math.random(),
              x: x + 0.5,
              y: y + 0.5,
              vx: (Math.random() - 0.5) * speed,
              vy: (Math.random() - 0.5) * speed,
              life: 1.0,
              color: color,
              size: Math.random() * 2 + 1
          });
      }
  };

  const gainXp = (ant: Ant, amount: number) => {
      ant.xp += amount;
      // Exponential leveling curve
      const threshold = 10 * Math.pow(1.5, ant.level - 1); 
      
      if (ant.xp >= threshold) {
          ant.xp -= threshold;
          ant.level++;
          // Significant stat boost
          ant.maxHealth += 15 * ant.level;
          ant.health = ant.maxHealth;
          ant.speed += 0.05;
          ant.strength += 0.5;
          spawnParticles(ant.x, ant.y, '#ffd700', 15, 0.8); // Level Up FX
      }
  };

  const findNearest = (ant: Ant, type: CellType | 'ENEMY' | 'STORAGE_SPACE' | 'NEST' | 'NURSERY'): {x: number, y: number} | null => {
    const range = 100; // Wide vision
    let bestDist = Infinity;
    let target = null;

    if (type === 'ENEMY') {
        let bestEnemy = null;
        gameStateRef.current.enemies.forEach(e => {
            const dist = Math.abs(e.x - ant.x) + Math.abs(e.y - ant.y);
            if (dist < range && dist < bestDist) {
                bestDist = dist;
                bestEnemy = {x: e.x, y: e.y};
            }
        });
        return bestEnemy;
    }

    if (type === 'NEST') {
        // Find queen or nest tiles
        const queen = gameStateRef.current.ants.find(a => a.type === AntType.QUEEN);
        if (queen) return { x: Math.floor(queen.x), y: Math.floor(queen.y) };
        return { x: Math.floor(GRID_WIDTH/2), y: 35 };
    }

    // Optimization: Spiral search
    for (let r = 1; r < range; r+=2) {
        const steps = Math.max(8, Math.floor(r * 2));
        for (let i = 0; i < steps; i++) {
             const angle = (Math.PI * 2 / steps) * i;
             const tx = Math.floor(ant.x + Math.cos(angle) * r);
             const ty = Math.floor(ant.y + Math.sin(angle) * r);
             
             if (tx < 0 || tx >= GRID_WIDTH || ty < 0 || ty >= GRID_HEIGHT) continue;

             const cell = getCell(tx, ty);
             
             if (type === 'STORAGE_SPACE') {
                 if ((cell === CellType.STORAGE || cell === CellType.NEST)) return {x: tx, y: ty};
             } else if (type === 'NURSERY') {
                 if (cell === CellType.NURSERY) return {x: tx, y: ty};
             } else if (cell === type) {
                 return {x: tx, y: ty};
             }
        }
        if (target) break; 
    }
    return target;
  };

  const moveAnt = (ant: Ant, dx: number, dy: number, state: WorldState) => {
    if (Math.random() > ant.speed) return false;

    // Normalize direction
    if (dx !== 0) dx = dx > 0 ? 1 : -1;
    if (dy !== 0) dy = dy > 0 ? 1 : -1;

    let newX = ant.x + dx;
    let newY = ant.y + dy;
    let cell = getCell(newX, newY);
    
    // Physics Logic
    // Large ants break dirt automatically if strong enough
    const canCrush = ant.level > 5 && (ant.type === AntType.SOLDIER || ant.type === AntType.SUPER_SOLDIER);
    
    if (canCrush && (cell === CellType.DIRT || cell === CellType.DEFENSE)) {
        if (cell === CellType.DIRT || (cell === CellType.DEFENSE && Math.random() < 0.2)) {
            setCell(newX, newY, CellType.AIR);
            spawnParticles(newX, newY, COLORS[cell], 2, 0.3);
            cell = CellType.AIR;
        }
    }

    // Passable logic
    const isHardBlock = cell === CellType.ROCK || cell === CellType.DEFENSE;
    const isSoftBlock = cell === CellType.DIRT || cell === CellType.FOOD || cell === CellType.GEM;
    
    // Collision / Slidling
    if (isHardBlock || (isSoftBlock && ant.job !== AntJob.MINING)) {
        if (dx !== 0 && dy === 0) {
            if (getCell(ant.x, ant.y + 1) === CellType.AIR) { dy = 1; dx = 0; }
            else if (getCell(ant.x, ant.y - 1) === CellType.AIR) { dy = -1; dx = 0; }
            else { dx = rand(3) - 1; dy = rand(3) - 1; }
        } else if (dy !== 0 && dx === 0) {
            if (getCell(ant.x + 1, ant.y) === CellType.AIR) { dx = 1; dy = 0; }
            else if (getCell(ant.x - 1, ant.y) === CellType.AIR) { dx = -1; dy = 0; }
             else { dx = rand(3) - 1; dy = rand(3) - 1; }
        }
        newX = ant.x + dx;
        newY = ant.y + dy;
        cell = getCell(newX, newY);
    }

    let moved = false;
    const canMine = ant.job === AntJob.MINING || (ant.type !== AntType.QUEEN && (cell === CellType.FOOD || cell === CellType.GEM));

    if (cell === CellType.AIR || cell === CellType.NEST || cell === CellType.STORAGE || cell === CellType.NURSERY) {
      ant.x = newX;
      ant.y = newY;
      moved = true;
    } else if (canMine && isSoftBlock) {
        // Mining Logic
        const mineChance = ant.type === AntType.SUPER_SOLDIER ? 0.9 : (0.7 - (ant.strength * 0.05));
        if (Math.random() > mineChance) { 
             if (cell === CellType.GEM) {
                state.resources.score += 500;
                spawnParticles(newX, newY, '#00e5ff', 8, 0.8);
                gainXp(ant, 50); // Huge XP for gems
             } else if (cell === CellType.DIRT) {
                 state.resources.materials++;
                 state.resources.score += 1;
                 gainXp(ant, 1);
             } else if (cell === CellType.FOOD) {
                 // Eat food to grow
                 if (ant.health < ant.maxHealth || ant.type === AntType.SOLDIER || ant.type === AntType.SUPER_SOLDIER) {
                     // Heal and gain XP instead of carrying
                     ant.health = Math.min(ant.maxHealth, ant.health + 30);
                     ant.energy = 100;
                     gainXp(ant, 10); // Eating makes them bigger
                     spawnParticles(newX, newY, '#4caf50', 3, 0.2);
                 } else if (ant.type === AntType.WORKER && !ant.carrying) {
                     ant.carrying = true;
                     ant.job = AntJob.RETURNING;
                 }
             }
             
             setCell(newX, newY, CellType.AIR);
             spawnParticles(newX, newY, COLORS[cell], 3, 0.2);
        }
        ant.energy -= 0.5;
    } 

    // Rotation
    const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
    const diff = targetAngle - ant.angle;
    ant.angle += diff * 0.3;

    return moved;
  };

  const updateAnt = (ant: Ant, state: WorldState) => {
    if (ant.health <= 0) return;
    
    const isNight = state.time > 1300 || state.time < 500;
    
    // Flee Logic
    const fleeThreshold = ant.type === AntType.WORKER ? 0.25 : 0.1;
    if (ant.health < ant.maxHealth * fleeThreshold && ant.type !== AntType.QUEEN) {
        ant.job = AntJob.FLEEING;
    }

    // Sleep logic (Super Soldiers don't sleep much during war)
    const warActive = state.enemies.length > 5;
    if (!warActive && ant.job !== AntJob.FLEEING && (ant.energy <= 0 || (isNight && ant.type === AntType.WORKER))) {
        ant.job = AntJob.SLEEPING;
        ant.energy += 0.5;
        ant.health += 0.1; // Heal while sleeping
        if (Math.random() < 0.05) spawnParticles(ant.x, ant.y, '#fff', 1, 0.05);
        if (ant.energy >= 100) ant.job = AntJob.IDLE;
        return;
    }

    ant.energy -= 0.05;

    // Queen Logic
    if (ant.type === AntType.QUEEN) {
        // Auto Breed Logic
        if (state.autoBreed && state.resources.food > 50 && state.ants.length < MAX_ANTS) {
             if (Math.random() < 0.05) { // 5% chance per tick to spawn if conditions met
                 spawnAnt(Math.random() > 0.8 ? AntType.SOLDIER : AntType.WORKER);
             }
        }
        
        // Healing Aura
        state.ants.forEach(other => {
            if (other !== ant && Math.abs(other.x - ant.x) < 8 && Math.abs(other.y - ant.y) < 8) {
                if (other.health < other.maxHealth) other.health += 1.0;
            }
        });
        return;
    }

    // Combat Logic (Soldier & Super Soldier)
    if (ant.type === AntType.SOLDIER || ant.type === AntType.SUPER_SOLDIER) {
         const enemyLoc = findNearest(ant, 'ENEMY');
         if (enemyLoc) {
             const dx = Math.sign(enemyLoc.x - ant.x);
             const dy = Math.sign(enemyLoc.y - ant.y);
             moveAnt(ant, dx, dy, state);
             
             // Attack Distance depends on size
             const reach = 1 + (ant.level * LEVEL_SCALER);
             if (Math.abs(enemyLoc.x - ant.x) <= reach && Math.abs(enemyLoc.y - ant.y) <= reach) {
                 const enemy = state.enemies.find(e => e.x === enemyLoc.x && e.y === enemyLoc.y);
                 if (enemy) {
                     const dmg = 2 * ant.strength;
                     enemy.health -= dmg;
                     spawnParticles(enemy.x, enemy.y, '#ef5350', 3, 0.4);
                     gainXp(ant, 2); // Combat XP
                     
                     if (enemy.health <= 0) {
                         ant.kills++;
                         ant.health = Math.min(ant.maxHealth, ant.health + 50); // Feast on kill
                         gainXp(ant, 50); // Kill Bonus
                     }
                 }
             }
             return;
         }

         // Rally
         let bestP = 0;
         let bestDir = {x:0, y:0};
         for(let dy=-1; dy<=1; dy++){
             for(let dx=-1; dx<=1; dx++){
                 if(dx===0 && dy===0) continue;
                 const px = Math.floor(ant.x + dx);
                 const py = Math.floor(ant.y + dy);
                 if(px>=0 && px<GRID_WIDTH && py>=0 && py<GRID_HEIGHT) {
                     if(state.pheromones[py][px] > bestP) {
                         bestP = state.pheromones[py][px];
                         bestDir = {x: dx, y: dy};
                     }
                 }
             }
         }

         if (bestP > 0.05) {
             moveAnt(ant, bestDir.x, bestDir.y, state);
         } else {
             if(Math.random() < 0.2) {
                 moveAnt(ant, rand(3)-1, rand(3)-1, state);
             }
         }
         return;
    }

    // Worker Logic
    if (ant.type === AntType.WORKER) {
        if (ant.carrying) {
            const storage = findNearest(ant, 'STORAGE_SPACE');
            const targetX = storage ? storage.x : GRID_WIDTH/2;
            const targetY = storage ? storage.y : 35;
            
            const dx = Math.sign(targetX - ant.x);
            const dy = Math.sign(targetY - ant.y);
            moveAnt(ant, dx, dy, state);

            if (Math.abs(targetX - ant.x) < 2 && Math.abs(targetY - ant.y) < 2) {
                ant.carrying = false;
                state.resources.food += 5;
                state.resources.score += 5;
                gainXp(ant, 5);
                const storageCount = state.grid.flat().filter(c => c === CellType.STORAGE).length;
                state.resources.maxFood = 1000 + (storageCount * 500);
                if (state.resources.food > state.resources.maxFood) state.resources.food = state.resources.maxFood;
            }
            return;
        } 
        
        const foodLoc = findNearest(ant, CellType.FOOD);
        if (foodLoc) {
            const dx = Math.sign(foodLoc.x - ant.x);
            const dy = Math.sign(foodLoc.y - ant.y);
            if (Math.abs(foodLoc.x - ant.x) <= 1 && Math.abs(foodLoc.y - ant.y) <= 1) {
                 ant.job = AntJob.MINING;
                 moveAnt(ant, dx, dy, state);
            } else {
                moveAnt(ant, dx, dy, state);
            }
        } else {
             const gemLoc = findNearest(ant, CellType.GEM);
             if (gemLoc && Math.abs(gemLoc.x - ant.x) < 8) {
                 const dx = Math.sign(gemLoc.x - ant.x);
                 const dy = Math.sign(gemLoc.y - ant.y);
                 moveAnt(ant, dx, dy, state);
                 ant.job = AntJob.MINING;
             } else if (Math.random() < 0.4) {
                 const dx = rand(3) - 1;
                 const dy = rand(3) - 1;
                 const dirY = (ant.y < 15) ? 1 : dy; 
                 moveAnt(ant, dx, dirY, state);
             }
        }
    }
  };

  // Main Game Loop
  const gameLoop = useCallback(() => {
    const state = gameStateRef.current;
    
    // Multi-tick based on game speed
    const steps = state.gameSpeed;
    
    for (let step = 0; step < steps; step++) {
        // 0. Time & Threat
        state.time = (state.time + 1) % DAY_LENGTH;
        state.resources.score += 0.01;
        
        // Calculate Threat Level based on Score and Pop
        state.threatLevel = Math.min(100, Math.floor((state.resources.score / 500) + (state.resources.population / 20)));

        // Infinite Food (Fungal Growth)
        if (Math.random() < 0.2) { 
            const rx = rand(GRID_WIDTH);
            const ry = rand(GRID_HEIGHT);
            if (state.grid[ry][rx] === CellType.AIR || state.grid[ry][rx] === CellType.DIRT) {
                if (ry > 15) state.grid[ry][rx] = CellType.FOOD;
            }
        }

        // Automatic Waves / Invasion
        if (Math.random() < (state.threatLevel / 5000)) { // Chance increases with threat
             spawnEnemy();
        }

        // 1. Update Ants
        state.ants = state.ants.filter(a => a.health > 0);
        state.ants.forEach(ant => updateAnt(ant, state));

        // 2. Update Particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            p.vy += 0.02; // Gravity
            if (p.life <= 0) state.particles.splice(i, 1);
        }

        // 3. Pheromones
        for(let y=0; y<GRID_HEIGHT; y++) {
            for(let x=0; x<GRID_WIDTH; x++) {
                if (state.pheromones[y][x] > 0) {
                    state.pheromones[y][x] *= PHEROMONE_DECAY;
                    if (state.pheromones[y][x] < 0.01) state.pheromones[y][x] = 0;
                }
            }
        }

        // 4. Update Enemies
        state.enemies.forEach(enemy => {
            // Find Target
            let target = null;
            let minDist = 40;
            state.ants.forEach(ant => {
                const d = Math.abs(ant.x - enemy.x) + Math.abs(ant.y - enemy.y);
                if (d < minDist) {
                    minDist = d;
                    target = ant;
                }
            });

            // Move
            if (enemy.type === 'WASP') {
                // Wasps fly fast and ignore terrain
                if (target) {
                    enemy.x += Math.sign(target.x - enemy.x) * 0.4;
                    enemy.y += Math.sign(target.y - enemy.y) * 0.4;
                } else {
                    enemy.x += (Math.random() - 0.5);
                    enemy.y += (Math.random() - 0.5);
                }
            } else if (enemy.type === 'TERMITE') {
                // Termites dig tunnels
                const tx = Math.floor(enemy.x);
                const ty = Math.floor(enemy.y);
                if (getCell(tx, ty) === CellType.DIRT) {
                     setCell(tx, ty, CellType.AIR);
                }
                if (target) {
                     enemy.x += Math.sign(target.x - enemy.x) * 0.1;
                     enemy.y += Math.sign(target.y - enemy.y) * 0.1;
                }
            } else {
                 // Spiders/Beetles
                 if (target) {
                     const dx = Math.sign(target.x - enemy.x);
                     const dy = Math.sign(target.y - enemy.y);
                     enemy.x += dx * 0.15;
                     enemy.y += dy * 0.15;
                 } else {
                     if (enemy.y < 35) enemy.y += 0.05; // Fall/Move down
                     enemy.x += (Math.random()-0.5) * 0.2;
                 }
            }

            // Attack
            if (target && minDist < 2) {
                target.health -= 5;
                spawnParticles(target.x, target.y, '#fff', 2, 0.3);
            }
        });
        
        // Enemy Death -> Meat Explosion
        const aliveEnemies: Enemy[] = [];
        state.enemies.forEach(e => {
            if (e.health > 0) {
                aliveEnemies.push(e);
            } else {
                state.resources.score += 200;
                const cx = Math.floor(e.x);
                const cy = Math.floor(e.y);
                // Big explosion of meat
                const meatAmount = e.type === 'BEETLE' ? 3 : 2;
                for(let dy=-meatAmount; dy<=meatAmount; dy++){
                    for(let dx=-meatAmount; dx<=meatAmount; dx++){
                        if (cy+dy < GRID_HEIGHT && cx+dx < GRID_WIDTH && cy+dy >= 0 && cx+dx >= 0)
                            state.grid[cy+dy][cx+dx] = CellType.FOOD;
                    }
                }
                spawnParticles(cx, cy, '#880e4f', 15, 1);
            }
        });
        state.enemies = aliveEnemies;
    }

    state.resources.population = state.ants.length;
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    const interval = setInterval(gameLoop, 1000 / 30);
    return () => clearInterval(interval);
  }, [gameLoop]);


  // --- Actions ---

  const spawnAnt = (type: AntType) => {
    let costVal = COSTS.WORKER.food;
    if (type === AntType.SOLDIER) costVal = COSTS.SOLDIER.food;
    if (type === AntType.SUPER_SOLDIER) costVal = COSTS.SUPER_SOLDIER.food;

    const res = gameStateRef.current.resources;
    
    if (res.food >= costVal && gameStateRef.current.ants.length < MAX_ANTS) {
        res.food -= costVal;
        const queen = gameStateRef.current.ants.find(a => a.type === AntType.QUEEN);
        if (queen) {
            let hp = 30;
            let str = 1;
            let spd = 0.8 + Math.random() * 0.4;
            
            if (type === AntType.SOLDIER) { hp = 80; str = 3; }
            if (type === AntType.SUPER_SOLDIER) { hp = 250; str = 8; spd = 1.3; }

            gameStateRef.current.ants.push({
                id: Date.now() + Math.random(),
                type: type,
                x: queen.x,
                y: queen.y,
                job: AntJob.IDLE,
                target: null,
                carrying: false,
                health: hp,
                maxHealth: hp,
                energy: 100,
                angle: 0,
                sleepiness: 0,
                speed: spd,
                strength: str,
                level: 1,
                xp: 0,
                kills: 0
            });
            spawnParticles(queen.x, queen.y, '#fff', 5, 0.5);
        }
    }
  };

  const interactCell = (x: number, y: number, tool: string) => {
      const grid = gameStateRef.current.grid;
      const res = gameStateRef.current.resources;

      if (tool === 'dig') {
          const c = grid[y][x];
          if (c === CellType.DIRT || c === CellType.FOOD || c === CellType.GEM) {
              if (c === CellType.GEM) {
                  res.score += 500;
                  spawnParticles(x, y, '#00e5ff', 8, 0.8);
              }
              if (c === CellType.FOOD) {
                  res.food += 5; // Manual gather
              }
              grid[y][x] = CellType.AIR;
              res.materials++;
              spawnParticles(x, y, '#8d6e63', 4, 0.5);
          }
      } else if (tool === 'build_food') {
           grid[y][x] = CellType.FOOD;
           spawnParticles(x, y, COLORS[CellType.FOOD], 2, 0.2);
      } else if (tool === 'rally') {
          const r = 6;
          for(let dy=-r; dy<=r; dy++){
              for(let dx=-r; dx<=r; dx++){
                 const py = y+dy;
                 const px = x+dx;
                 if(py>=0 && py<GRID_HEIGHT && px>=0 && px<GRID_WIDTH){
                     const dist = Math.sqrt(dx*dx + dy*dy);
                     if (dist <= r)
                        gameStateRef.current.pheromones[py][px] = 1.0;
                 }
              }
          }
      } else if (tool === 'build_storage') {
          if (res.materials >= COSTS.BUILD_STORAGE.materials) {
              res.materials -= COSTS.BUILD_STORAGE.materials;
              grid[y][x] = CellType.STORAGE;
              spawnParticles(x, y, COLORS[CellType.STORAGE], 3, 0.2);
              res.score += 10;
          }
      } else if (tool === 'build_nursery') {
          if (res.materials >= COSTS.BUILD_NURSERY.materials) {
              res.materials -= COSTS.BUILD_NURSERY.materials;
              grid[y][x] = CellType.NURSERY;
              spawnParticles(x, y, COLORS[CellType.NURSERY], 3, 0.2);
              res.score += 20;
          }
      } else if (tool === 'build_defense') {
          if (res.materials >= COSTS.BUILD_DEFENSE.materials) {
              res.materials -= COSTS.BUILD_DEFENSE.materials;
              grid[y][x] = CellType.DEFENSE;
              res.score += 5;
          }
      } else if (tool === 'warcry') {
          // Enrage Soldiers
          gameStateRef.current.ants.forEach(a => {
             if (a.type === AntType.SOLDIER || a.type === AntType.SUPER_SOLDIER) {
                 a.energy = 100;
                 a.job = AntJob.ATTACKING;
                 spawnParticles(a.x, a.y, '#f44336', 3, 0.5);
             }
          });
      }
  };
  
  const spawnEnemy = () => {
      // Scale threat with level
      const threat = gameStateRef.current.threatLevel;
      const typeRoll = Math.random() * 100;
      
      let type: any = 'SPIDER';
      let hp = 100;

      if (threat > 50 && typeRoll > 70) {
          type = 'TERMITE';
          hp = 400;
      } else if (threat > 20 && typeRoll > 50) {
          type = 'WASP';
          hp = 200;
      } else if (typeRoll > 80) {
          type = 'CENTIPEDE';
          hp = 300;
      } else if (typeRoll > 40) {
          type = 'BEETLE';
          hp = 150;
      }

      gameStateRef.current.enemies.push({
          id: Date.now() + Math.random(),
          x: rand(GRID_WIDTH),
          y: type === 'WASP' ? 2 : 5, 
          type: type,
          health: hp,
          maxHealth: hp,
          targetId: null
      });
  };

  const addResources = (f: number, m: number) => {
      gameStateRef.current.resources.food += f;
      gameStateRef.current.resources.materials += m;
  };

  return {
    gameStateRef,
    spawnAnt,
    interactCell,
    spawnEnemy,
    addResources,
    tick
  };
};