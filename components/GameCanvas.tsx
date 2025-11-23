import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CellType, Ant, AntType, WorldState, Enemy } from '../types';
import { GRID_WIDTH, GRID_HEIGHT, CELL_SIZE, COLORS, ANT_COLORS, LEVEL_SCALER } from '../constants';

interface GameCanvasProps {
  worldState: React.MutableRefObject<WorldState>;
  onCellClick: (x: number, y: number) => void;
  selectedTool: string;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ worldState, onCellClick, selectedTool }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Camera State
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.8); // Start zoomed out a bit
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // --- Rendering Helpers ---

  const drawCell = (ctx: CanvasRenderingContext2D, x: number, y: number, type: CellType, pheromone: number) => {
    const px = x * CELL_SIZE;
    const py = y * CELL_SIZE;

    // Base
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

    // Texture details
    if (type === CellType.DIRT) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    } else if (type === CellType.STORAGE) {
        ctx.strokeStyle = '#e65100';
        ctx.strokeRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    } else if (type === CellType.NURSERY) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(px + CELL_SIZE/2, py + CELL_SIZE/2, 2, 0, Math.PI*2);
        ctx.fill();
    } else if (type === CellType.DEFENSE) {
        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.moveTo(px, py + CELL_SIZE);
        ctx.lineTo(px + CELL_SIZE/2, py);
        ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
        ctx.fill();
        // Cross bracing
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+CELL_SIZE, py+CELL_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px+CELL_SIZE,py); ctx.lineTo(px, py+CELL_SIZE); ctx.stroke();
    } else if (type === CellType.GEM) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(px + CELL_SIZE/2, py);
        ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE/2);
        ctx.lineTo(px + CELL_SIZE/2, py + CELL_SIZE);
        ctx.lineTo(px, py + CELL_SIZE/2);
        ctx.fill();
        // Shine
        if (Math.random() < 0.05) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(px + CELL_SIZE/2 - 1, py + CELL_SIZE/2 - 1, 2, 2);
        }
    } else if (type === CellType.FOOD) {
        ctx.fillStyle = '#a5d6a7';
        ctx.beginPath(); ctx.arc(px + CELL_SIZE/2, py + CELL_SIZE/2, 2, 0, Math.PI*2); ctx.fill();
    }

    // Pheromones (Rally or Scent)
    if (pheromone > 0.05 && type === CellType.AIR) {
      ctx.fillStyle = `rgba(255, 50, 50, ${pheromone * 0.4})`;
      ctx.beginPath();
      ctx.arc(px + CELL_SIZE/2, py + CELL_SIZE/2, pheromone * 4, 0, Math.PI*2);
      ctx.fill();
    }
  };

  const drawAnt = (ctx: CanvasRenderingContext2D, ant: Ant) => {
    const screenX = ant.x * CELL_SIZE + CELL_SIZE / 2;
    const screenY = ant.y * CELL_SIZE + CELL_SIZE / 2;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(ant.angle);

    // SIZE SCALING BASED ON LEVEL
    // Base size + Level bonus. 
    // Example: Level 10 ant is 2.5x size.
    const growthFactor = 1 + (ant.level * LEVEL_SCALER);
    ctx.scale(growthFactor, growthFactor);

    // Level Aura
    if (ant.level > 1) {
        ctx.strokeStyle = ant.type === AntType.SOLDIER || ant.type === AntType.SUPER_SOLDIER ? 'rgba(255,0,0,0.3)' : 'rgba(255,215,0,0.3)';
        ctx.lineWidth = 1 / growthFactor; // Keep line thin visually
        ctx.beginPath();
        ctx.arc(0, 0, ant.type === AntType.SUPER_SOLDIER ? 10 : 6, 0, Math.PI*2);
        ctx.stroke();
    }

    // Ant Body
    ctx.fillStyle = ANT_COLORS[ant.type];
    
    if (ant.type === AntType.QUEEN) {
      ctx.beginPath(); ctx.ellipse(0, 4, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -3, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -8, 2.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (ant.type === AntType.SUPER_SOLDIER) {
      // Super Soldier - Bigger, spiky
      const sizeScale = 1.8;
      ctx.scale(sizeScale, sizeScale);
      
      // Spikes
      ctx.fillStyle = '#b71c1c';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-4, 0); ctx.lineTo(4, 0); ctx.fill();

      // Body
      ctx.fillStyle = ANT_COLORS[ant.type];
      ctx.beginPath(); ctx.ellipse(0, 2, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); // Abdomen
      ctx.beginPath(); ctx.ellipse(0, -4, 3, 3, 0, 0, Math.PI * 2); ctx.fill(); // Head
      
      // Mandibles
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(-1, -8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(1, -8); ctx.stroke();

    } else {
      // Simple Worker/Soldier
      ctx.beginPath();
      ctx.ellipse(0, 0, ant.type === AntType.SOLDIER ? 3.5 : 2.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Legs lines
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(4, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(4, 2); ctx.stroke();
    }

    // Carrying Food
    if (ant.carrying) {
      ctx.fillStyle = COLORS[CellType.FOOD];
      ctx.beginPath();
      ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sleep Zzz
    if (ant.energy < 20 && ant.job === 'SLEEPING') {
        ctx.fillStyle = '#fff';
        ctx.font = '8px Arial';
        ctx.fillText('z', 5, -5);
    }
    
    // Fleeing Sweat
    if (ant.job === 'FLEEING') {
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath(); ctx.arc(0, -8, 1, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const screenX = enemy.x * CELL_SIZE + CELL_SIZE / 2;
    const screenY = enemy.y * CELL_SIZE + CELL_SIZE / 2;

    ctx.save();
    ctx.translate(screenX, screenY);

    if (enemy.type === 'SPIDER') {
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth = 1.5;
        for(let i=0; i<8; i++) {
            const a = (Math.PI*2/8)*i;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*14, Math.sin(a)*14); ctx.stroke();
        }
    } else if (enemy.type === 'BEETLE') {
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(-6, -8, 12, 16);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-4, -6, 8, 12);
        // Horn
        ctx.fillStyle = '#aaa';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-2, -14); ctx.lineTo(2, -14); ctx.fill();
    } else if (enemy.type === 'WASP') {
        // Wasp - Yellow/Black, Wings
        ctx.rotate(Math.sin(Date.now() * 0.02) * 0.2); // Hover wiggle
        
        // Wings
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.ellipse(-5, -5, 4, 10, -0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -5, 4, 10, 0.5, 0, Math.PI*2); ctx.fill();
        
        // Body
        ctx.fillStyle = '#fbc02d';
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(-4, -2, 8, 2);
        ctx.fillRect(-4, 2, 8, 2);
    } else if (enemy.type === 'TERMITE') {
        // Termite - Pale, Big Head
        ctx.fillStyle = '#fff9c4'; // Pale body
        ctx.beginPath(); ctx.ellipse(0, 3, 4, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#d7ccc8'; // Big head
        ctx.beginPath(); ctx.ellipse(0, -5, 5, 5, 0, 0, Math.PI*2); ctx.fill();
        // Pincers
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(0, -12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3, -8); ctx.lineTo(0, -12); ctx.stroke();
    } else {
        // Centipede
        ctx.fillStyle = '#ff9800';
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 15, 0, 0, Math.PI*2); ctx.fill();
        // Legs
        ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 1;
        for(let i=-10; i<10; i+=4) {
             ctx.beginPath(); ctx.moveTo(-6, i); ctx.lineTo(6, i); ctx.stroke();
        }
    }
    
    // Health bar
    ctx.fillStyle = 'red';
    ctx.fillRect(-8, -15, 16, 3);
    ctx.fillStyle = 'lime';
    ctx.fillRect(-8, -15, 16 * (enemy.health / enemy.maxHealth), 3);

    ctx.restore();
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { grid, ants, pheromones, enemies, particles, time } = worldState.current;

    ctx.save();
    // Apply Camera Transform
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-canvas.width / 2 + offset.x, -canvas.height / 2 + offset.y);
    
    // Draw World Boundary (Sky vs Dirt BG)
    ctx.fillStyle = '#0d0d0d'; // Deep underground bg
    ctx.fillRect(0, 0, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
    
    // Sky
    ctx.fillStyle = '#81d4fa'; // Day Sky
    if (time > 1400 || time < 400) ctx.fillStyle = '#010515'; // Night Sky
    ctx.fillRect(0, 0, GRID_WIDTH * CELL_SIZE, 15 * CELL_SIZE);

    // 1. Grid
    // Optimization: Only render cells in view (approximated)
    // Simple cull for now: just don't draw if huge world
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (grid[y][x] !== CellType.DIRT && grid[y][x] !== CellType.AIR) {
           drawCell(ctx, x, y, grid[y][x], pheromones[y][x]);
        } else if (grid[y][x] === CellType.DIRT) {
           drawCell(ctx, x, y, grid[y][x], pheromones[y][x]);
        } else {
           if (pheromones[y][x] > 0.05) drawCell(ctx, x, y, CellType.AIR, pheromones[y][x]);
        }
      }
    }

    // 2. Enemies
    enemies.forEach(e => drawEnemy(ctx, e));

    // 3. Ants
    ants.forEach(ant => drawAnt(ctx, ant));

    // 4. Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * CELL_SIZE, p.y * CELL_SIZE, p.size, 0, Math.PI * 2);
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // 5. Day/Night Cycle Overlay (for underground atmosphere)
    if (time > 1300 || time < 500) {
       ctx.fillStyle = 'rgba(0, 0, 20, 0.4)'; // Night tint
       ctx.fillRect(0, 0, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
    }
    
    // Sun / Moon in sky
    const skyY = 5 * CELL_SIZE;
    const skyX = (time / 2000) * (GRID_WIDTH * CELL_SIZE);
    if (time > 500 && time < 1500) {
        // Sun
        ctx.fillStyle = '#fff176';
        ctx.shadowColor = '#fff176';
        ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(skyX, skyY, 20, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        // Moon
        ctx.fillStyle = '#e0e0e0';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(skyX > GRID_WIDTH*CELL_SIZE ? skyX - GRID_WIDTH*CELL_SIZE : skyX, skyY, 15, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.restore();

    requestRef.current = requestAnimationFrame(render);
  }, [worldState, offset, scale]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(render);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [render]);

  // --- Interaction ---

  const screenToWorld = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      
      const cx = clientX - rect.left - canvas.width / 2;
      const cy = clientY - rect.top - canvas.height / 2;
      
      const wx = (cx - offset.x) / scale + canvas.width / 2;
      const wy = (cy - offset.y) / scale + canvas.height / 2;

      return {
          x: Math.floor(wx / CELL_SIZE),
          y: Math.floor(wy / CELL_SIZE)
      };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button === 0) { // Left click for tools
         const {x, y} = screenToWorld(e.clientX, e.clientY);
         if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
             onCellClick(x, y);
         }
      } else if (e.button === 1 || e.button === 2) { // Middle or Right for Pan
         setIsDragging(true);
         setLastMouse({ x: e.clientX, y: e.clientY });
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          const dx = e.clientX - lastMouse.x;
          const dy = e.clientY - lastMouse.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          setLastMouse({ x: e.clientX, y: e.clientY });
      } else if (e.buttons === 1) {
          // Drag painting
         const {x, y} = screenToWorld(e.clientX, e.clientY);
         if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
             onCellClick(x, y);
         }
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
      const newScale = Math.min(Math.max(0.1, scale - e.deltaY * 0.001), 4);
      setScale(newScale);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
        <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
        className={`cursor-crosshair`}
        />
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
            Zoom Level: {Math.round(scale * 100)}%
        </div>
    </div>
  );
};

export default GameCanvas;