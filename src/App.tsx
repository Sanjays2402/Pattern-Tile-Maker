import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Download, Eraser, PenTool, LayoutGrid, SplitSquareHorizontal, Layers, Play, Pause, Trash2, Heart, Star, Sparkles, Sun, Cloud, Aperture, Undo2, Palette, Wand2, Frame, Zap, SprayCan, Grid3X3, Moon, Leaf, Minimize2, Maximize2, PaintBucket } from 'lucide-react';

type TilingMode = 'normal' | 'mirror' | 'brick' | 'diagonal';

const TILE_SIZE = 200;

function App() {
  const drawRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#fc4c4c');
  const [bgColor, setBgColor] = useState('#ffe6f0');
  const [brushSize, setBrushSize] = useState(6);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'spray' | 'fill'>('pen');
  const [mode, setMode] = useState<TilingMode>('normal');
  const [animating, setAnimate] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [stamp, setStamp] = useState<string | null>(null);
  const [symmetry, setSymmetry] = useState(false);
  const [rainbowMode, setRainbowMode] = useState(false);
  const [neonMode, setNeonMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [patternScale, setPatternScale] = useState(1);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  
  const rainbowHue = useRef(0);
  const lastPos = useRef<{ x: number, y: number } | null>(null);
  const animOffset = useRef(0);
  const reqRef = useRef<number | undefined>(undefined);

  // Panning state (for dragging background)
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingBg = useRef(false);
  const lastBgPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    saveState();
    // eslint-disable-next-line
  }, []);

  const saveState = () => {
    const canvas = drawRef.current;
    if (canvas) {
      setUndoStack(prev => [...prev, canvas.toDataURL()]);
    }
  };

  const handleUndo = () => {
    if (undoStack.length <= 1) { 
      if (undoStack.length === 1) clearCanvas(false);
      return;
    }
    const canvas = drawRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const newStack = [...undoStack];
    newStack.pop(); 
    const lastState = newStack[newStack.length - 1]; 
    setUndoStack(newStack);
    
    const img = new Image();
    img.src = lastState;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      renderPattern();
    };
  };

  useEffect(() => {
    const canvas = drawRef.current;
    if (canvas && undoStack.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
    
    const handleResize = () => {
      if (bgRef.current) {
        bgRef.current.width = window.innerWidth;
        bgRef.current.height = window.innerHeight;
        renderPattern();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize); // eslint-disable-next-line
  }, []);

  const renderPattern = useCallback(() => {
    const bg = bgRef.current;
    const tile = drawRef.current;
    if (!bg || !tile) return;

    const ctx = bg.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, bg.width, bg.height);

    const activeTileSize = TILE_SIZE * patternScale;
    const cols = Math.ceil(bg.width / activeTileSize) + 2;
    const rows = Math.ceil(bg.height / activeTileSize) + 2;
    
    let ox = panRef.current.x;
    let oy = panRef.current.y;
    
    if (animating) {
      animOffset.current += animSpeed;
      ox += animOffset.current;
      oy += animOffset.current;
    }

    ctx.save();
    
    if (mode === 'diagonal') {
      ctx.translate(bg.width / 2, bg.height / 2);
      ctx.rotate(Math.PI / 4);
      ctx.translate(-bg.width, -bg.height);
    }

    const activeRepeat = mode === 'mirror' ? activeTileSize * 2 : activeTileSize;
    ctx.translate(ox % activeRepeat, oy % activeRepeat);

    const startX = mode === 'diagonal' ? -cols : -2;
    const startY = mode === 'diagonal' ? -rows : -2;
    const endX = mode === 'diagonal' ? cols * 2 : cols + 1;
    const endY = mode === 'diagonal' ? rows * 2 : rows + 1;

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        let drawX = x * activeTileSize - activeTileSize;
        let drawY = y * activeTileSize - activeTileSize;
        
        if (mode === 'brick' && y % 2 !== 0) {
          drawX += activeTileSize / 2;
        }

        ctx.save();
        ctx.translate(drawX, drawY);

        if (mode === 'mirror') {
          const mirrorX = Math.abs(x % 2) === 1;
          const mirrorY = Math.abs(y % 2) === 1;
          
          ctx.translate(mirrorX ? activeTileSize : 0, mirrorY ? activeTileSize : 0);
          ctx.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
        }

        ctx.drawImage(tile, 0, 0, activeTileSize, activeTileSize);
        ctx.restore();
      }
    }
    
    ctx.restore();
  }, [bgColor, mode, animating, animSpeed, patternScale]);

  useEffect(() => {
    let reqId: number | undefined = undefined;
    if (animating) {
      const loop = () => {
        renderPattern();
        reqId = requestAnimationFrame(loop);
      };
      reqId = requestAnimationFrame(loop);
    } else {
      renderPattern();
    }
    return () => {
      if (reqId) cancelAnimationFrame(reqId);
    };
  }, [renderPattern, animating]);

  useEffect(() => {
    renderPattern();
  }, [bgColor, mode, renderPattern]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = drawRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  // Background Drag Logic
  const handleBgDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingBg.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    lastBgPos.current = { x: clientX, y: clientY };
  };

  const handleBgMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingBg.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const dx = clientX - lastBgPos.current.x;
    const dy = clientY - lastBgPos.current.y;
    
    panRef.current.x += dx;
    panRef.current.y += dy;
    lastBgPos.current = { x: clientX, y: clientY };
    
    if (!animating) requestAnimationFrame(renderPattern);
  };

  const handleBgUp = () => {
    isDraggingBg.current = false;
  };

  const getActiveColor = () => {
    if (rainbowMode && tool !== 'eraser') {
      rainbowHue.current = (rainbowHue.current + 3) % 360;
      return `hsl(${rainbowHue.current}, 100%, 50%)`;
    }
    return tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
  };

  const applyGlow = (ctx: CanvasRenderingContext2D, strokeColor: string) => {
    if (neonMode && tool !== 'eraser') {
      ctx.shadowBlur = brushSize * 1.5;
      ctx.shadowColor = strokeColor;
    } else {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  };

  const drawStampInternal = (ctx: CanvasRenderingContext2D, sz: number, activeStamp: string) => {
    if (activeStamp === 'star') {
      for(let i = 0; i < 5; i++) {
        ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * sz, -Math.sin((18 + i * 72) / 180 * Math.PI) * sz);
        ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * (sz/2), -Math.sin((54 + i * 72) / 180 * Math.PI) * (sz/2));
      }
      ctx.fill();
    } else if (activeStamp === 'heart') {
      ctx.arc(-sz/2, -sz/2, sz/2, Math.PI, 0, false);
      ctx.arc(sz/2, -sz/2, sz/2, Math.PI, 0, false);
      ctx.lineTo(0, sz);
      ctx.fill();
    } else if (activeStamp === 'cloud') {
      ctx.arc(-sz/2, 0, sz/2, 0, Math.PI*2);
      ctx.arc(sz/2, 0, sz/2, 0, Math.PI*2);
      ctx.arc(0, -sz/2, sz/1.5, 0, Math.PI*2);
      ctx.fill();
    } else if (activeStamp === 'sun') {
      ctx.arc(0, 0, sz/2, 0, Math.PI*2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, sz/4);
      ctx.strokeStyle = ctx.fillStyle;
      for(let i=0; i<8; i++) {
         ctx.moveTo(0,0);
         ctx.lineTo(Math.cos(i*Math.PI/4)*sz*1.2, Math.sin(i*Math.PI/4)*sz*1.2);
      }
      ctx.stroke();
    } else if (activeStamp === 'moon') {
      ctx.arc(0, 0, sz/1.5, Math.PI * 0.5, Math.PI * 1.5, true);
      ctx.arc(sz/4, 0, sz/1.5, Math.PI * 1.5, Math.PI * 0.5, false);
      ctx.fill();
    } else if (activeStamp === 'leaf') {
      ctx.moveTo(0, sz);
      ctx.quadraticCurveTo(sz, 0, 0, -sz);
      ctx.quadraticCurveTo(-sz, 0, 0, sz);
      ctx.fill();
    } else {
      ctx.arc(0, 0, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const renderStamp = (x: number, y: number, sz: number, activeStamp: string, activeColor: string) => {
    const canvas = drawRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.fillStyle = activeColor;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    
    applyGlow(ctx, activeColor);
    
    ctx.translate(x, y);
    ctx.beginPath();
    drawStampInternal(ctx, sz, activeStamp);
    
    ctx.restore();
  }

  const drawStamp = (x: number, y: number) => {
    if (!stamp) return;
    const c = getActiveColor();
    const sz = Math.max(10, brushSize * 3);
    
    renderStamp(x, y, sz, stamp, c);
    if (symmetry) {
         renderStamp(TILE_SIZE - x, y, sz, stamp, c);
         renderStamp(x, TILE_SIZE - y, sz, stamp, c);
         renderStamp(TILE_SIZE - x, TILE_SIZE - y, sz, stamp, c);
    }
    renderPattern();
  }

  const drawStroke = (x1: number, y1: number, x2: number, y2: number) => {
    const ctx = drawRef.current?.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawSpray = (x: number, y: number) => {
    const ctx = drawRef.current?.getContext('2d');
    if (!ctx) return;
    const activeC = getActiveColor();
    ctx.fillStyle = activeC;
    applyGlow(ctx, activeC);

    const sprayRadius = brushSize * 2;
    const density = Math.max(5, brushSize * 1.5);
    
    const sprayDots = (cx: number, cy: number) => {
        for(let i = 0; i < density; i++) {
           const angle = Math.random() * Math.PI * 2;
           const radius = Math.random() * sprayRadius;
           ctx.fillRect(cx + Math.cos(angle)*radius, cy + Math.sin(angle)*radius, 2, 2);
        }
    };
    
    sprayDots(x, y);
    if (symmetry) {
       sprayDots(TILE_SIZE - x, y);
       sprayDots(x, TILE_SIZE - y);
       sprayDots(TILE_SIZE - x, TILE_SIZE - y);
    }
  };

  const performFloodFill = (startX: number, startY: number) => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Convert active color to RGBA
    const activeColorStr = getActiveColor();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1; tempCanvas.height = 1;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.fillStyle = activeColorStr;
    tCtx.fillRect(0, 0, 1, 1);
    const fillPixel = tCtx.getImageData(0, 0, 1, 1).data;
    const [fR, fG, fB, fA] = [fillPixel[0], fillPixel[1], fillPixel[2], fillPixel[3]];

    const imgData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    const data = imgData.data;

    const fillAt = (sx: number, sy: number) => {
      sx = Math.floor(sx);
      sy = Math.floor(sy);
      if (sx < 0 || sx >= TILE_SIZE || sy < 0 || sy >= TILE_SIZE) return;

      const startPos = (sy * TILE_SIZE + sx) * 4;
      const startR = data[startPos];
      const startG = data[startPos + 1];
      const startB = data[startPos + 2];
      const startA = data[startPos + 3];

      // Tolerate if filling the same color
      if (startR === fR && startG === fG && startB === fB && startA === fA) return;

      const matchStartColor = (pos: number) => {
        return data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;
      };
      
      const colorPixel = (pos: number) => {
        data[pos] = fR;
        data[pos + 1] = fG;
        data[pos + 2] = fB;
        data[pos + 3] = fA;
      };

      const pixelStack = [[sx, sy]];
      
      while (pixelStack.length > 0) {
        const newPos = pixelStack.pop()!;
        const x = newPos[0];
        let y = newPos[1];

        let pixelPos = (y * TILE_SIZE + x) * 4;
        while (y-- >= 0 && matchStartColor(pixelPos)) {
          pixelPos -= TILE_SIZE * 4;
        }
        pixelPos += TILE_SIZE * 4;
        ++y;

        let reachLeft = false;
        let reachRight = false;

        while (y++ < TILE_SIZE - 1 && matchStartColor(pixelPos)) {
          colorPixel(pixelPos);

          if (x > 0) {
            if (matchStartColor(pixelPos - 4)) {
              if (!reachLeft) {
                pixelStack.push([x - 1, y]);
                reachLeft = true;
              }
            } else if (reachLeft) {
              reachLeft = false;
            }
          }

          if (x < TILE_SIZE - 1) {
            if (matchStartColor(pixelPos + 4)) {
              if (!reachRight) {
                pixelStack.push([x + 1, y]);
                reachRight = true;
              }
            } else if (reachRight) {
              reachRight = false;
            }
          }

          pixelPos += TILE_SIZE * 4;
        }
      }
    };

    fillAt(startX, startY);
    if (symmetry) {
      fillAt(TILE_SIZE - startX, startY);
      fillAt(startX, TILE_SIZE - startY);
      fillAt(TILE_SIZE - startX, TILE_SIZE - startY);
    }
    ctx.putImageData(imgData, 0, 0);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getCoordinates(e);

    if (tool === 'fill' && !stamp) {
      performFloodFill(pos.x, pos.y);
      saveState();
      if (!animating) renderPattern();
      return;
    }

    if (stamp) {
      drawStamp(pos.x, pos.y);
      saveState(); 
      return;
    }
    setIsDrawing(true);
    lastPos.current = pos;
    if (tool === 'spray') {
        drawSpray(pos.x, pos.y);
        renderPattern();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || stamp) return;
    const pos = getCoordinates(e);
    const ctx = drawRef.current?.getContext('2d');
    if (!ctx || !lastPos.current) return;

    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    
    if (tool === 'spray') {
        drawSpray(pos.x, pos.y);
    } else {
        const activeC = getActiveColor();
        ctx.strokeStyle = activeC;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        applyGlow(ctx, activeC);
        
        drawStroke(lastPos.current.x, lastPos.current.y, pos.x, pos.y);

        if (symmetry) {
            drawStroke(TILE_SIZE - lastPos.current.x, lastPos.current.y, TILE_SIZE - pos.x, pos.y); 
            drawStroke(lastPos.current.x, TILE_SIZE - lastPos.current.y, pos.x, TILE_SIZE - pos.y); 
            drawStroke(TILE_SIZE - lastPos.current.x, TILE_SIZE - lastPos.current.y, TILE_SIZE - pos.x, TILE_SIZE - pos.y); 
        }
    }
    
    lastPos.current = pos;
    if (!animating) renderPattern();
  };

  const stopDrawing = () => {
    if (isDrawing) saveState(); 
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = (pushHistory = true) => {
    const canvas = drawRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderPattern();
      if (pushHistory) saveState();
    }
  };

  const handleMagicSurprise = () => {
    clearCanvas(false);
    
    const randomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
    const bgH = Math.floor(Math.random() * 360);
    setBgColor(`hsl(${bgH}, 40%, 90%)`);
    
    const modes: TilingMode[] = ['normal', 'mirror', 'brick', 'diagonal'];
    setMode(modes[Math.floor(Math.random() * modes.length)]);
    setSymmetry(Math.random() > 0.3);
    setNeonMode(Math.random() > 0.5); 
    setRainbowMode(Math.random() > 0.7);

    const stamps = ['heart', 'star', 'cloud', 'sun', 'moon', 'leaf'];
    
    const count = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
        const ax = 30 + Math.random() * (TILE_SIZE - 60);
        const ay = 30 + Math.random() * (TILE_SIZE - 60);
        const sSize = 15 + Math.random() * 25;
        const sType = stamps[Math.floor(Math.random() * stamps.length)];
        const sCol = randomColor();
        
        renderStamp(ax, ay, sSize, sType, sCol);
        if (Math.random() > 0.3) {
            renderStamp(TILE_SIZE - ax, ay, sSize, sType, sCol);
            renderStamp(ax, TILE_SIZE - ay, sSize, sType, sCol);
            renderStamp(TILE_SIZE - ax, TILE_SIZE - ay, sSize, sType, sCol);
        }
    }
    
    renderPattern();
    saveState();
  };

  const downloadFullPattern = () => {
    const link = document.createElement('a');
    link.download = 'full-pattern.png';
    link.href = bgRef.current?.toDataURL() || '';
    link.click();
  };
  
  const downloadSingleTile = () => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (drawRef.current) ctx.drawImage(drawRef.current, 0, 0);
    
    const link = document.createElement('a');
    link.download = 'single-tile.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const ActionBtn = ({ icon: Icon, active, onClick, activeCls = "bg-pink-500 text-white" }: any) => (
    <button 
      onClick={onClick} 
      className={`p-2 rounded-xl flex justify-center items-center transition-all ${active ? activeCls : 'bg-white shadow-sm text-gray-600 hover:bg-gray-50'}`}
    >
      <Icon size={18}/>
    </button>
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <canvas 
        ref={bgRef} 
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleBgDown}
        onMouseMove={handleBgMove}
        onMouseUp={handleBgUp}
        onMouseLeave={handleBgUp}
        onTouchStart={handleBgDown}
        onTouchMove={handleBgMove}
        onTouchEnd={handleBgUp}
        style={{ zIndex: 0 }}
      />
      
      {isDraggingBg.current && (
         <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center opacity-30">
            <div className="bg-black text-white px-4 py-2 rounded-full font-bold uppercase tracking-widest backdrop-blur-md">Pan Active</div>
         </div>
      )}

      {isMinimized && (
        <button 
          onClick={() => setIsMinimized(false)}
          className="absolute top-4 left-4 z-20 p-4 bg-white/95 backdrop-blur-md rounded-full shadow-2xl border border-white/50 hover:bg-indigo-50 transition-all hover:scale-110 active:scale-95 text-indigo-600 group"
          title="Show Controls"
        >
          <Maximize2 size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      <div className={`absolute top-4 left-4 max-h-[95vh] overflow-y-auto z-10 flex flex-col gap-4 max-w-sm w-full bg-white/95 backdrop-blur-md p-5 rounded-3xl shadow-2xl border border-white/50 custom-scrollbar transition-all duration-300 origin-top-left ${isMinimized ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-black text-gray-800 flex items-center gap-1.5 line-clamp-1">
            <span role="img" aria-label="puzzle">🧩</span> Pattern Maker
          </h1>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setIsMinimized(true)} title="Minimize" className="p-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-200 transition-colors shadow-sm">
                <Minimize2 size={16} />
            </button>
            <button onClick={handleMagicSurprise} title="Surprise Me!" className="p-2 rounded-full bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors shadow-sm">
                <Wand2 size={16} />
            </button>
            <button onClick={handleUndo} title="Undo" className="p-2 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors shadow-sm disabled:opacity-50" disabled={undoStack.length <= 1}>
                <Undo2 size={16} />
            </button>
          </div>
        </div>

        <div className={`${neonMode ? 'bg-zinc-900' : 'bg-gradient-to-br from-indigo-50 to-pink-50'} rounded-2xl p-1 shadow-inner h-fit max-w-[210px] mx-auto border-2 border-dashed ${neonMode ? 'border-zinc-700' : 'border-indigo-200'} relative group cursor-crosshair transition-colors duration-500 overflow-hidden`}>
          <div className={`absolute inset-0 pointer-events-none ${showGrid ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`} style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <canvas
            ref={drawRef}
            width={TILE_SIZE}
            height={TILE_SIZE}
            className="bg-transparent touch-none rounded-xl relative z-10"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {tool === 'eraser' && !stamp && (
             <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-zinc-800/80 text-[10px] font-bold text-white pointer-events-none uppercase tracking-wider backdrop-blur-sm z-20">Eraser</div>
          )}
          {rainbowMode && (
             <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-[10px] font-bold text-white pointer-events-none uppercase tracking-wider shadow-sm z-20">Rainbow</div>
          )}
          {neonMode && (
             <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-cyan-500/90 text-[10px] font-bold text-white pointer-events-none shadow-[0_0_10px_rgba(6,182,212,0.8)] uppercase tracking-wider z-20">Neon</div>
          )}
        </div>

        <div className="bg-gray-100/50 rounded-2xl p-3 flex flex-col gap-2 border border-gray-100">
          <div className="flex flex-wrap gap-2 justify-center">
              <ActionBtn icon={PenTool} active={tool === 'pen' && !stamp} onClick={() => { setTool('pen'); setStamp(null); }} />
              <ActionBtn icon={PaintBucket} active={tool === 'fill' && !stamp} onClick={() => { setTool('fill'); setStamp(null); }} />
              <ActionBtn icon={SprayCan} active={tool === 'spray' && !stamp} onClick={() => { setTool('spray'); setStamp(null); }} />
              <ActionBtn icon={Eraser} active={tool === 'eraser' && !stamp} onClick={() => { setTool('eraser'); setStamp(null); }} />
              <div className="w-[2px] bg-gray-200 h-8 mx-1" />
              <ActionBtn icon={Heart} active={stamp === 'heart'} onClick={() => { setStamp('heart'); }} />
              <ActionBtn icon={Star} active={stamp === 'star'} onClick={() => { setStamp('star'); }} />
              <ActionBtn icon={Cloud} active={stamp === 'cloud'} onClick={() => { setStamp('cloud'); }} />
              <ActionBtn icon={Sun} active={stamp === 'sun'} onClick={() => { setStamp('sun'); }} />
              <ActionBtn icon={Moon} active={stamp === 'moon'} onClick={() => { setStamp('moon'); }} />
              <ActionBtn icon={Leaf} active={stamp === 'leaf'} onClick={() => { setStamp('leaf'); }} />
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-1 border-t border-gray-200/60 pt-2">
              <ActionBtn icon={Grid3X3} active={showGrid} onClick={() => setShowGrid(!showGrid)} activeCls="bg-indigo-500 text-white shadow-md border-0" />
              <ActionBtn icon={Palette} active={rainbowMode} onClick={() => setRainbowMode(!rainbowMode)} activeCls="bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white shadow-md border-0" />
              <ActionBtn icon={Zap} active={neonMode} onClick={() => setNeonMode(!neonMode)} activeCls="bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.5)] border-0" />
              <ActionBtn icon={Aperture} active={symmetry} onClick={() => setSymmetry(!symmetry)} activeCls="bg-purple-500 text-white shadow-md" />
              <div className="w-[2px] bg-gray-200 h-8 mx-1" />
              <ActionBtn icon={Trash2} active={false} onClick={() => clearCanvas(true)} />
          </div>
        </div>

        <div className="space-y-4 px-2">
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-center">
               <label className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Ink</label>
               <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={rainbowMode} className={`w-[32px] h-[32px] rounded-full border-2 border-white shadow-sm cursor-pointer p-0 ${rainbowMode ? 'opacity-30' : ''}`} />
             </div>
             <div className="flex flex-col items-center">
               <label className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Bg</label>
               <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-[32px] h-[32px] rounded-full border-2 border-white shadow-sm cursor-pointer p-0" />
             </div>
             <div className="flex-1 flex flex-col ml-1">
               <label className="text-[10px] font-bold text-gray-500 mb-1.5 flex justify-between uppercase tracking-wider">
                 <span>Brush Size</span>
                 <span>{brushSize}px</span>
               </label>
               <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full accent-pink-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
             </div>
          </div>

          <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
             <div className="flex items-center gap-3">
                 <div className="flex-1">
                   <label className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider block">Pattern Style</label>
                   <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg">
                     <button onClick={() => setMode('normal')} className={`p-1.5 rounded-md flex justify-center ${mode === 'normal' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={16}/></button>
                     <button onClick={() => setMode('mirror')} className={`p-1.5 rounded-md flex justify-center ${mode === 'mirror' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><SplitSquareHorizontal size={16}/></button>
                     <button onClick={() => setMode('brick')} className={`p-1.5 rounded-md flex justify-center ${mode === 'brick' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><Layers size={16}/></button>
                     <button onClick={() => setMode('diagonal')} className={`p-1.5 rounded-md flex justify-center ${mode === 'diagonal' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><Sparkles size={16}/></button>
                   </div>
                 </div>
                 <div className="w-20">
                    <label className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider block text-center">Zoom</label>
                    <input type="range" min="0.3" max="3" step="0.1" value={patternScale} onChange={(e) => setPatternScale(parseFloat(e.target.value))} className="w-full mt-1.5 accent-indigo-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                 </div>
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
             <button onClick={() => {
                if (!animating && undoStack.length <= 1) handleMagicSurprise();
                setAnimate(!animating);
             }} className={`w-2/3 py-2.5 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${animating ? 'bg-green-100 text-green-700' : 'bg-green-500 text-white shadow-md shadow-green-200 hover:bg-green-400'}`}>
                {animating ? <><Pause size={16}/> Pause</> : <><Play fill="currentColor" size={16}/> Animate</>}
             </button>
             <div className="w-1/3 flex flex-col items-center opacity-80" style={{ pointerEvents: animating ? 'auto' : 'none' }}>
                <label className="text-[9px] font-bold text-gray-500 mb-1 uppercase">Speed {animSpeed}x</label>
                <input type="range" min="0.2" max="5" step="0.2" value={animSpeed} onChange={(e) => setAnimSpeed(parseFloat(e.target.value))} className="w-full accent-green-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
             </div>
          </div>
          
          <div className="flex gap-2">
              <button onClick={downloadSingleTile} className="flex-1 py-2 px-3 rounded-xl border-2 border-blue-500 text-blue-500 hover:bg-blue-50 text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95">
                <Frame size={14}/> Save Tile
              </button>
              <button onClick={downloadFullPattern} className="flex-1 py-2 px-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold shadow-md shadow-blue-200 flex items-center justify-center gap-1 transition-all active:scale-95">
                <Download size={14}/> Save Wallpaper
              </button>
          </div>
        </div>

      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default App;