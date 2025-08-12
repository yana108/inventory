const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Improve default text rendering
ctx.font = '16px "Noto Sans SC", system-ui, sans-serif';
ctx.textBaseline = 'middle';
ctx.fillStyle = '#e9e0d3';

const uiCoins = document.getElementById('coins');
const uiRating = document.getElementById('rating');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const ingredientsEl = document.getElementById('ingredients');
const ordersEl = document.getElementById('orders');

// Core game state
const GAME = {
  coins: 0,
  rating: 100,
  isPaused: false,
  time: 0,
  customersServed: 0,
};

const BOARD = {
  width: canvas.width,
  height: canvas.height,
  griddle: { x: 60, y: 80, width: 620, height: 380 },
  packArea: { x: 720, y: 120, width: 200, height: 320 },
};

const INGREDIENTS = [
  { id: 'batter', name: '面糊', emoji: '🥞', color: '#e8d1a7' },
  { id: 'egg', name: '鸡蛋', emoji: '🥚', color: '#f2d675' },
  { id: 'sauceSweet', name: '甜面酱', emoji: '🧂', color: '#6b3a2e' },
  { id: 'sauceSpicy', name: '辣酱', emoji: '🌶️', color: '#b32d2d' },
  { id: 'scallion', name: '葱花', emoji: '🧅', color: '#4caf50' },
  { id: 'cilantro', name: '香菜', emoji: '🌿', color: '#2e8b57' },
  { id: 'youtiao', name: '油条', emoji: '🥖', color: '#d9a441' },
  { id: 'ham', name: '火腿', emoji: '🍖', color: '#e37b7b' },
  { id: 'cracker', name: '薄脆', emoji: '🍘', color: '#e0c48b' },
];

const RECIPES = [
  { id: 'classic', name: '经典', items: ['batter','egg','sauceSweet','scallion','cracker'] },
  { id: 'spicy', name: '香辣', items: ['batter','egg','sauceSpicy','scallion','cracker'] },
  { id: 'ham', name: '火腿加倍', items: ['batter','egg','sauceSweet','ham','cracker'] },
  { id: 'youtiao', name: '油条香', items: ['batter','egg','sauceSweet','youtiao','cilantro','cracker'] },
];

const griddleCakes = [];
const activeOrders = [];

function createToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 1400);
}

function spawnOrder() {
  const recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  const timeout = 22000 + Math.random() * 8000;
  const order = {
    id: 'order_' + Math.random().toString(36).slice(2),
    recipe,
    createdAt: performance.now(),
    expireAt: performance.now() + timeout,
    served: false,
  };
  activeOrders.push(order);
  renderOrders();
}

function renderOrders() {
  ordersEl.innerHTML = '';
  for (const order of activeOrders) {
    if (order.served) continue;
    const li = document.createElement('li');
    li.className = 'order';
    const remain = Math.max(0, order.expireAt - performance.now());
    const progress = 1 - remain / (order.expireAt - order.createdAt);
    li.innerHTML = `
      <div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong>${order.recipe.name}</strong>
        <span class="badge">${Math.ceil(remain/1000)}s</span>
      </div>
      <div class="items">${order.recipe.items.map(id => `<span class="badge">${getIngredientById(id).name}</span>`).join('')}</div>
      <div style="height:6px;background:#f3eee6;border-radius:999px;margin-top:6px;overflow:hidden;">
        <div style="height:100%;width:${Math.min(100, Math.max(0, progress*100))}%;background:#2f7bff;"></div>
      </div>
    `;
    ordersEl.appendChild(li);
  }
}

function getIngredientById(id) {
  return INGREDIENTS.find(i => i.id === id);
}

function setupIngredientsUI() {
  ingredientsEl.innerHTML = '';
  for (const ing of INGREDIENTS) {
    const btn = document.createElement('button');
    btn.className = 'ingredient';
    btn.draggable = true;
    btn.innerHTML = `<span>${ing.emoji}</span><span>${ing.name}</span>`;
    btn.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('text/plain', ing.id);
    });
    ingredientsEl.appendChild(btn);
  }
}

canvas.addEventListener('dragover', ev => ev.preventDefault());
canvas.addEventListener('drop', ev => {
  ev.preventDefault();
  const id = ev.dataTransfer.getData('text/plain');
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  placeIngredientOnGriddle(id, x, y);
});

function placeIngredientOnGriddle(id, x, y) {
  if (!pointInRect(x, y, BOARD.griddle)) {
    // Drop to pack area to finish if a cake exists
    if (pointInRect(x, y, BOARD.packArea)) {
      tryPackNearestCake();
    }
    return;
  }

  const now = performance.now();
  if (id === 'batter') {
    griddleCakes.push(createNewCake(x, y));
    return;
  }

  const cake = findNearestCake(x, y);
  if (!cake) return;

  if (id === 'egg' && !cake.added.egg) {
    cake.added.egg = true;
    cake.events.push({ t: now, type: 'egg' });
    createToast('打蛋 +1');
    return;
  }
  if (id.startsWith('sauce') && !cake.added.sauce) {
    cake.added.sauce = id;
    cake.events.push({ t: now, type: id });
    createToast('抹酱 +1');
    return;
  }
  if (['scallion','cilantro','youtiao','ham','cracker'].includes(id)) {
    cake.added[id] = (cake.added[id] || 0) + 1;
    cake.events.push({ t: now, type: id });
    createToast(`${getIngredientById(id).name} +1`);
    return;
  }
}

function createNewCake(x, y) {
  const radius = 70 + Math.random() * 30;
  return {
    id: 'cake_' + Math.random().toString(36).slice(2),
    x, y, radius,
    createdAt: performance.now(),
    heat: 0,
    cooked: 0,
    burned: 0,
    folded: false,
    packed: false,
    added: { egg: false, sauce: null },
    events: [],
  };
}

function findNearestCake(x, y) {
  let nearest = null;
  let bestDist = Infinity;
  for (const cake of griddleCakes) {
    if (cake.packed) continue;
    const dx = x - cake.x;
    const dy = y - cake.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist && Math.sqrt(d2) <= cake.radius * 1.2) {
      bestDist = d2;
      nearest = cake;
    }
  }
  return nearest;
}

function tryPackNearestCake() {
  const cake = griddleCakes.find(c => !c.packed && c.folded);
  if (!cake) return;
  const score = evaluateCake(cake);
  const price = Math.max(1, Math.round(score * 12));
  GAME.coins += price;
  GAME.customersServed += 1;
  uiCoins.textContent = GAME.coins.toString();
  cake.packed = true;
  matchOrderWithCake(score, cake);
  createToast(`出餐 +${price} 金币`);
}

function matchOrderWithCake(score, cake) {
  for (const order of activeOrders) {
    if (order.served) continue;
    // Simple matching: recipe items subset of cake items
    const need = new Set(order.recipe.items);
    const has = new Set(Object.keys(cake.added).filter(k => cake.added[k] && cake.added[k] !== 0));
    if ([...need].every(i => has.has(i) || (i==='sauceSweet'&&cake.added.sauce==='sauceSweet') || (i==='sauceSpicy'&&cake.added.sauce==='sauceSpicy'))) {
      order.served = true;
      const remain = Math.max(0, order.expireAt - performance.now());
      const timeBonus = Math.min(10, Math.round(remain / 2000));
      const ratingDelta = Math.round(score * 10) + timeBonus;
      GAME.rating = Math.min(100, GAME.rating + ratingDelta);
      uiRating.textContent = GAME.rating.toString();
      createToast(`订单完成 +评分${ratingDelta}`);
      break;
    }
  }
  renderOrders();
}

function evaluateCake(cake) {
  // Cooking score based on cooked vs burned
  const cookScore = Math.max(0, Math.min(1, cake.cooked - cake.burned * 0.7));
  // Ingredients completeness vs one of recipes
  const bestMatch = RECIPES.reduce((best, r) => {
    const needed = new Set(r.items);
    let have = 0;
    for (const item of needed) {
      if (item === 'sauceSweet' || item === 'sauceSpicy') {
        if (cake.added.sauce === item) have++;
      } else if (cake.added[item]) {
        have++;
      }
    }
    const ratio = have / needed.size;
    return ratio > best ? ratio : best;
  }, 0);
  const ingredientScore = bestMatch;
  const foldScore = cake.folded ? 1 : 0.4;
  const total = Math.max(0, Math.min(1, cookScore * 0.5 + ingredientScore * 0.35 + foldScore * 0.15));
  return total;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Griddle
  const g = BOARD.griddle;
  const grd = ctx.createLinearGradient(0, g.y, 0, g.y + g.height);
  grd.addColorStop(0, '#444');
  grd.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = grd;
  roundRect(ctx, g.x, g.y, g.width, g.height, 16);
  ctx.fill();

  // Pack area
  const p = BOARD.packArea;
  ctx.strokeStyle = '#c9b8a2';
  ctx.setLineDash([6, 6]);
  roundRect(ctx, p.x, p.y, p.width, p.height, 10);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#c9b8a2';
  ctx.fillText('打包区', p.x + 36, p.y + 20);

  // Cakes
  for (const cake of griddleCakes) {
    drawCake(cake);
  }

  // UI hints
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, g.x + 10, g.y + 10, 220, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#f1e9dc';
  ctx.fillText('从右侧拖“面糊”到铁板开始', g.x + 22, g.y + 28);
}

function drawCake(cake) {
  const baseColor = '#e9cf9a';
  const cookedTint = Math.min(1, cake.cooked);
  const burnedTint = Math.min(1, cake.burned);
  const tint = lerpColor(baseColor, '#7b4e2b', cookedTint * 0.6 + burnedTint * 0.4);
  ctx.fillStyle = tint;
  ellipse(ctx, cake.x, cake.y, cake.radius, cake.radius * 0.8);
  ctx.fill();

  // Egg
  if (cake.added.egg) {
    ctx.fillStyle = '#fffbd1';
    ellipse(ctx, cake.x + 10, cake.y, cake.radius * 0.4, cake.radius * 0.3);
    ctx.fill();
    ctx.fillStyle = '#ffd464';
    ellipse(ctx, cake.x + 10, cake.y, cake.radius * 0.15, cake.radius * 0.12);
    ctx.fill();
  }

  // Sauce smear
  if (cake.added.sauce) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = cake.added.sauce === 'sauceSweet' ? '#6b3a2e' : '#b32d2d';
    ellipse(ctx, cake.x - 8, cake.y + 4, cake.radius * 0.6, cake.radius * 0.4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Toppings dots
  const toppingMap = {
    scallion: '#4caf50',
    cilantro: '#2e8b57',
    youtiao: '#d9a441',
    ham: '#e37b7b',
    cracker: '#e0c48b',
  };
  for (const [key, color] of Object.entries(toppingMap)) {
    const count = cake.added[key] || 0;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = color;
      const angle = (i / (count + 1)) * Math.PI * 2;
      const rx = cake.x + Math.cos(angle) * cake.radius * 0.4;
      const ry = cake.y + Math.sin(angle) * cake.radius * 0.3;
      ellipse(ctx, rx, ry, 6, 4);
      ctx.fill();
    }
  }

  // Fold state
  if (!cake.folded) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cake.x - cake.radius, cake.y);
    ctx.lineTo(cake.x + cake.radius, cake.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('按 F 对折', cake.x - 24, cake.y + 16);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText('已对折', cake.x - 16, cake.y + 16);
  }
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const b2 = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${b2})`;
}
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function update(dt) {
  if (GAME.isPaused) return;
  GAME.time += dt;

  // Spawn orders periodically
  if (activeOrders.length < 3 && Math.random() < dt * 0.0007) {
    spawnOrder();
  }

  // Heat and cook
  const heatRate = 0.00012;
  const burnRate = 0.00006;
  for (const cake of griddleCakes) {
    if (cake.packed) continue;
    cake.heat += dt * heatRate;
    cake.cooked = Math.min(1.6, cake.cooked + dt * heatRate);
    if (cake.cooked > 1.0) {
      cake.burned = Math.min(2.0, cake.burned + dt * burnRate);
      if (cake.burned > 1.3) {
        GAME.rating = Math.max(0, GAME.rating - 0.03 * dt);
        uiRating.textContent = Math.round(GAME.rating).toString();
      }
    }
  }

  // Expire orders
  for (const order of activeOrders) {
    if (!order.served && performance.now() > order.expireAt) {
      order.served = true; // mark as processed
      GAME.rating = Math.max(0, GAME.rating - 8);
      uiRating.textContent = Math.round(GAME.rating).toString();
      createToast('订单超时 -评分8');
    }
  }
}

let lastTs = performance.now();
function loop(ts) {
  const dt = ts - lastTs;
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Controls
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'f') {
    const cake = griddleCakes.find(c => !c.folded && !c.packed);
    if (cake) cake.folded = true;
  }
  if (e.key === ' ') {
    GAME.isPaused = !GAME.isPaused;
  }
});

pauseBtn.addEventListener('click', () => {
  GAME.isPaused = !GAME.isPaused;
  pauseBtn.textContent = GAME.isPaused ? '继续' : '暂停';
});

restartBtn.addEventListener('click', () => {
  griddleCakes.length = 0;
  activeOrders.length = 0;
  GAME.coins = 0; GAME.rating = 100; GAME.time = 0; GAME.customersServed = 0; GAME.isPaused = false;
  uiCoins.textContent = '0'; uiRating.textContent = '100';
  renderOrders();
});

setupIngredientsUI();
spawnOrder();
renderOrders();