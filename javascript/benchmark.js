const GAMES = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    genre: 'Open World RPG',
    icon: '',
    logo: 'https://upload.wikimedia.org/wikipedia/en/9/9f/Cyberpunk_2077_box_art.jpg',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.82,
    cpuWeight: 0.12,
    ramWeight: 0.06,
    baseFPS: 58,
    maxFPS: 165,
    rtMultiplier: 0.62,
    tags: ['Ray Tracing: ON', 'DLSS 3', 'Ultra Settings'],
    accent: '#ff6b35',
  },
  {
    id: 'rdr2',
    name: 'Red Dead Redemption 2',
    genre: 'Open World',
    icon: '',
    logo: 'https://static.wikia.nocookie.net/reddeadredemption/images/0/0a/Reddeadcover.jpg/revision/latest?cb=20180503145113',
    year: 2019,
    resolution: '1440p Ultra',
    gpuWeight: 0.70,
    cpuWeight: 0.22,
    ramWeight: 0.08,
    baseFPS: 68,
    maxFPS: 145,
    rtMultiplier: 1.0,
    tags: ['Ultra Settings', 'TAA', 'Advanced Graphics'],
    accent: '#cc8833',
  },
  {
    id: 'baldursgate',
    name: "Baldur's Gate 3",
    genre: 'RPG',
    icon: '',
    logo: 'https://image.api.playstation.com/vulcan/ap/rnd/202302/2321/ba706e54d68d10a0eb6ab7c36cdad9178c58b7fb7bb03d28.png?w=440',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.58,
    cpuWeight: 0.32,
    ramWeight: 0.10,
    baseFPS: 78,
    maxFPS: 160,
    rtMultiplier: 1.0,
    tags: ['Ultra Settings', 'Vulkan API'],
    accent: '#9966ff',
  },
  {
    id: 'elden_ring',
    name: 'Elden Ring',
    genre: 'Action RPG',
    icon: '',
    logo: 'https://static0.polygonimages.com/wordpress/wp-content/uploads/sharedimages/2024/12/mixcollage-08-dec-2024-02-50-pm-6945-1.jpg',
    year: 2022,
    resolution: '1440p Max',
    gpuWeight: 0.65,
    cpuWeight: 0.28,
    ramWeight: 0.07,
    baseFPS: 85,
    maxFPS: 155,
    rtMultiplier: 1.0,
    tags: ['Max Settings', 'FSR 2'],
    accent: '#eab308',
  },
  {
    id: 'cs2',
    name: 'Counter-Strike 2',
    genre: 'FPS / Competitive',
    icon: '',
    logo: 'https://media.printables.com/media/prints/993971/images/7567942_39fd2e55-5ff1-43ef-a3a2-532a95d43dd4_93a75339-5509-492d-bac0-9c0ca1ede73d/thumbs/cover/800x800/jpg/f75dd04fa12445a8ec43be65fa16ff1b8d2bf82e.jpg',
    year: 2023,
    resolution: '1080p Competitive',
    gpuWeight: 0.40,
    cpuWeight: 0.52,
    ramWeight: 0.08,
    baseFPS: 210,
    maxFPS: 550,
    rtMultiplier: 1.0,
    tags: ['Low Settings', 'High FPS Mode', 'Source 2'],
    accent: '#2563eb',
  },
  {
    id: 'starfield',
    name: 'Starfield',
    genre: 'Sci-Fi RPG',
    icon: '',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnqaTvMn-NTktBhWB8qcQ3Lv71C8lQjas_d9DoORP_xN5w0Hv-U3La1eSFuREmgzKeCA7t_g&s=10',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.60,
    cpuWeight: 0.32,
    ramWeight: 0.08,
    baseFPS: 62,
    maxFPS: 130,
    rtMultiplier: 1.0,
    tags: ['Ultra Settings', 'DirectX 12'],
    accent: '#4488ff',
  },
  {
    id: 'alan_wake2',
    name: 'Alan Wake 2',
    genre: 'Horror / Action',
    icon: '',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/ed/Alan_Wake_2_box_art.jpg',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.88,
    cpuWeight: 0.08,
    ramWeight: 0.04,
    baseFPS: 45,
    maxFPS: 120,
    rtMultiplier: 0.55,
    tags: ['Path Tracing', 'DLSS 3.5', 'Ultra+'],
    accent: '#88aaff',
  },
  {
    id: 'fortnite',
    name: 'Fortnite',
    genre: 'Battle Royale',
    icon: '',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Fortnite_F_lettermark_logo.png',
    year: 2024,
    resolution: '1080p Epic',
    gpuWeight: 0.55,
    cpuWeight: 0.35,
    ramWeight: 0.10,
    baseFPS: 145,
    maxFPS: 360,
    rtMultiplier: 0.70,
    tags: ['Epic Settings', 'Nanite', 'DirectX 12'],
    accent: '#22c55e',
  },
];

/* ============================================================
   FPS CALCULATION ENGINE
============================================================ */

/**
 * Calculate FPS for a specific game given the current build.
 * Returns { fps, rt_fps, frametimeMs, grade, bottleneck }
 */
function calcGameFPS(game, build) {
  const _cpuProd = build.CPU ? (typeof getProduct === 'function' ? getProduct(build.CPU) : null) : null;
  const _gpuProd = build.GPU ? (typeof getProduct === 'function' ? getProduct(build.GPU) : null) : null;
  const _ramProd = build.RAM ? (typeof getProduct === 'function' ? getProduct(build.RAM) : null) : null;
  const _storProd = build.Storage ? (typeof getProduct === 'function' ? getProduct(build.Storage) : null) : null;

  /* Strict: only use actual benchScore — products without scores contribute 0 */
  const cpuScore = (_cpuProd?.benchScore && _cpuProd.benchScore > 0) ? _cpuProd.benchScore : 0;
  const gpuScore = (_gpuProd?.benchScore && _gpuProd.benchScore > 0) ? _gpuProd.benchScore : 0;
  const ramScore = (_ramProd?.benchScore && _ramProd.benchScore > 0) ? _ramProd.benchScore : 0;
  const storScore = (_storProd?.benchScore && _storProd.benchScore > 0) ? _storProd.benchScore : 0;

  // Weighted composite score for this game
  const composite = (
    gpuScore * game.gpuWeight +
    cpuScore * game.cpuWeight +
    ramScore * game.ramWeight +
    storScore * 0.02
  );

  // Map composite (0–100) to FPS range
  const t = Math.min(composite / 100, 1);
  const fps = Math.round(game.baseFPS + (game.maxFPS - game.baseFPS) * (t ** 0.85));

  // Apply a small random variance ±3% for realism
  const variance = 1 + (Math.random() - 0.5) * 0.06;
  const finalFPS = Math.round(fps * variance);

  // Raytracing FPS
  const rtFPS = Math.round(finalFPS * game.rtMultiplier);

  // Frame time
  const frametimeMs = (1000 / finalFPS).toFixed(1);

  // Grade
  const grade = finalFPS >= 144 ? 'S'
    : finalFPS >= 100 ? 'A'
      : finalFPS >= 60 ? 'B'
        : finalFPS >= 45 ? 'C'
          : 'D';

  // Bottleneck detection
  const cpuContrib = cpuScore * game.cpuWeight;
  const gpuContrib = gpuScore * game.gpuWeight;
  const bottleneck = cpuContrib > gpuContrib * 1.4 ? 'CPU'
    : gpuContrib > cpuContrib * 1.4 ? 'GPU'
      : 'Balanced';

  return { fps: finalFPS, rtFPS, frametimeMs, grade, bottleneck, composite };
}

/**
 * Compute an overall build score (0–100) and tier label.
 */
function calcBuildScore(build) {
  if (!build.CPU || !build.GPU) return null;

  const _cpuProd = typeof getProduct === 'function' ? getProduct(build.CPU) : null;
  const _gpuProd = typeof getProduct === 'function' ? getProduct(build.GPU) : null;
  const _ramProd = build.RAM     ? (typeof getProduct === 'function' ? getProduct(build.RAM)     : null) : null;
  const _storProd = build.Storage ? (typeof getProduct === 'function' ? getProduct(build.Storage) : null) : null;

  /* Strict: only use actual benchScore — 0 if no score */
  const cpuScore  = (_cpuProd?.benchScore && _cpuProd.benchScore > 0) ? _cpuProd.benchScore : 0;
  const gpuScore  = (_gpuProd?.benchScore && _gpuProd.benchScore > 0) ? _gpuProd.benchScore : 0;
  const ramScore  = (_ramProd?.benchScore && _ramProd.benchScore > 0) ? _ramProd.benchScore : 0;
  const storScore = (_storProd?.benchScore && _storProd.benchScore > 0) ? _storProd.benchScore : 0;

  /* Weighted composite: CPU 25% · GPU 50% · RAM 15% · Storage 10% */
  const score = Math.round(cpuScore * 0.25 + gpuScore * 0.50 + ramScore * 0.15 + storScore * 0.10);

  const tier = score >= 92 ? { label: 'GODTIER', color: '#ff6b35', glow: '#ff6b3566' }
    : score >= 80 ? { label: 'ULTRA', color: '#2563eb', glow: '#2563eb44' }
      : score >= 68 ? { label: 'HIGH-END', color: '#22c55e', glow: '#22c55e44' }
        : score >= 54 ? { label: 'MID-RANGE', color: '#eab308', glow: '#eab30844' }
          : { label: 'ENTRY-LEVEL', color: '#8899aa', glow: '#8899aa44' };

  // Detect overall bottleneck
  const diff = Math.abs(cpuScore - gpuScore);
  let bottleneck = 'Balanced — great component synergy';
  if (cpuScore < gpuScore - 20) bottleneck = `CPU bottleneck — your GPU is being held back by the ${build.CPU ? getProduct(build.CPU)?.name : 'CPU'}`;
  if (gpuScore < cpuScore - 20) bottleneck = `GPU bottleneck — consider upgrading your GPU`;

  return { score, tier, bottleneck, cpuScore, gpuScore, ramScore, storScore };
}

/* ============================================================
   BENCHMARK UI — ANIMATED RUNNER
============================================================ */

let benchmarkRunning = false;

/**
 * Entry point called from the builder page.
 * Validates build, then opens the benchmark modal.
 */
function openBenchmark() {
  const build = DB.getBuild();
  if (!build.CPU || !build.GPU) {
    showToast('Need at least a CPU and GPU to benchmark', 'error');
    return;
  }

  /* Validate benchmark scores exist for all selected components */
  const _benchParts = [
    { key: 'CPU', id: build.CPU },
    { key: 'GPU', id: build.GPU },
    { key: 'RAM', id: build.RAM },
    { key: 'Storage', id: build.Storage },
  ].filter(p => p.id);

  const missing = _benchParts.filter(p => {
    const prod = typeof getProduct === 'function' ? getProduct(p.id) : null;
    return !prod || !prod.benchScore || prod.benchScore <= 0;
  });

  if (missing.length) {
    const names = missing.map(p => p.key).join(', ');
    showToast('Missing benchmark scores for: ' + names + '. Add scores via Admin Panel.', 'error');
    return;
  }

  // Reset modal state
  document.getElementById('benchmarkModal').classList.add('open');
  document.getElementById('bmPreRun').style.display = 'block';
  document.getElementById('bmRunning').style.display = 'none';
  document.getElementById('bmResults').style.display = 'none';

  // Populate pre-run summary
  renderBenchmarkPreview(build);
}

function closeBenchmarkModal() {
  document.getElementById('benchmarkModal').classList.remove('open');
  benchmarkRunning = false;
}

/** Show a mini component preview before running. */
function renderBenchmarkPreview(build) {
  const parts = [
    { label: 'CPU',     id: build.CPU },
    { label: 'GPU',     id: build.GPU },
    { label: 'RAM',     id: build.RAM },
    { label: 'Storage', id: build.Storage },
  ].filter(p => p.id);

  const CAT_EMOJIS = {
    CPU: '⚡', GPU: '🎮', Motherboard: '📁', RAM: '💾', 
    Storage: '📀', PSU: '🔌', Cooling: '❄️', Case: '🖥️'
  };

  document.getElementById('bmBuildPreview').innerHTML = parts.map(p => {
    const prod = getProduct(p.id);
    if (!prod) return '';
    const emoji = prod.emoji || CAT_EMOJIS[prod.cat] || '📦';
    
    return `
      <div class="bm-part-chip">
        <span>${emoji}</span>
        <span>${prod.name}</span>
      </div>`;
  }).join('');
}

/** Start the animated benchmark sequence. */
async function startBenchmark() {
  if (benchmarkRunning) return;
  benchmarkRunning = true;

  const build = DB.getBuild();

  document.getElementById('bmPreRun').style.display = 'none';
  document.getElementById('bmRunning').style.display = 'block';
  document.getElementById('bmResults').style.display = 'none';

  const progressBar = document.getElementById('bmProgressBar');
  const progressPct = document.getElementById('bmProgressPct');
  const bmCurrentGame = document.getElementById('bmCurrentGame');
  const bmCurrentFPS = document.getElementById('bmCurrentFPS');
  const bmLiveLog = document.getElementById('bmLiveLog');

  bmLiveLog.innerHTML = '';
  progressBar.style.width = '0%';

  const results = [];
  const total = GAMES.length;

  for (let i = 0; i < total; i++) {
    if (!benchmarkRunning) break;

    const game = GAMES[i];
    const pct = Math.round(((i) / total) * 100);

    // Update header
    bmCurrentGame.textContent = `Testing: ${game.name}`;
    progressBar.style.width = pct + '%';
    progressPct.textContent = pct + '%';
    bmCurrentFPS.textContent = '...';

    // Simulate benchmark loading phase
    bmLiveLog.innerHTML += `<div class="bm-log-line loading"> Loading ${game.name}...</div>`;
    bmLiveLog.scrollTop = bmLiveLog.scrollHeight;
    await sleep(400 + Math.random() * 300);

    // Animate FPS counting up
    const result = calcGameFPS(game, build);
    let displayFPS = Math.round(result.fps * 0.3);
    const step = Math.ceil(result.fps / 20);

    while (displayFPS < result.fps) {
      displayFPS = Math.min(displayFPS + step, result.fps);
      bmCurrentFPS.textContent = displayFPS + ' FPS';
      await sleep(35);
    }

    // Log result
    const gradeClass = { S: 'grade-s', A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d' }[result.grade];
    bmLiveLog.innerHTML += `
      <div class="bm-log-line done">
        <img class="bm-log-logo" src="${game.logo}" alt="${game.name}"
             onerror="this.style.display='none'">
        ${game.name}
        <span class="bm-log-fps">${result.fps} avg FPS</span>
        <span class="bm-grade ${gradeClass}">${result.grade}</span>
      </div>`;
    bmLiveLog.scrollTop = bmLiveLog.scrollHeight;

    results.push({ game, result });
    await sleep(250);
  }

  // Final progress
  progressBar.style.width = '100%';
  progressPct.textContent = '100%';
  bmCurrentGame.textContent = 'Benchmark Complete!';
  bmCurrentFPS.textContent = '';

  await sleep(600);

  // Show full results
  benchmarkRunning = false;
  renderBenchmarkResults(build, results);
}

/** Render the full results report. */
function renderBenchmarkResults(build, results) {
  document.getElementById('bmRunning').style.display = 'none';
  document.getElementById('bmResults').style.display = 'block';

  const buildScore = calcBuildScore(build);
  const cpu  = getProduct(build.CPU);
  const gpu  = getProduct(build.GPU);
  const ram  = build.RAM     ? getProduct(build.RAM)     : null;
  const stor = build.Storage ? getProduct(build.Storage) : null;

  //  Overall score banner 
  document.getElementById('bmScoreBanner').innerHTML = `
    <div class="bm-tier-badge" style="color:${buildScore.tier.color};box-shadow:0 0 30px ${buildScore.tier.glow}">
      ${buildScore.tier.label}
    </div>
    <div class="bm-overall-score" style="color:${buildScore.tier.color}">
      ${buildScore.score}<span>/100</span>
    </div>
    <div class="bm-bottleneck-note">
      ${buildScore.bottleneck === 'Balanced — great component synergy'
      ? `<span style="color:var(--green)"> ${buildScore.bottleneck}</span>`
      : `<span style="color:var(--yellow)"> ${buildScore.bottleneck}</span>`}
    </div>
    <div class="bm-component-scores">
      ${_scoreBar('CPU',     buildScore.cpuScore,  cpu?.name  || '—', '#2563eb')}
      ${_scoreBar('GPU',     buildScore.gpuScore,  gpu?.name  || '—', '#7c3aed')}
      ${_scoreBar('RAM',     buildScore.ramScore,  ram?.name  || '—', '#ff6b35')}
      ${_scoreBar('Storage', buildScore.storScore, stor?.name || '—', '#06b6d4')}
    </div>
    
    <!-- Power Report Section -->
    <div class="bm-power-report" style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border)">
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:0.5rem">Power Delivery Check</div>
      ${(function() {
        const psu = build.PSU ? getProduct(build.PSU) : null;
        const draw = (cpu?.tdp || 125) + (gpu?.power || 200) + 75;
        const cap = psu?.wattage || 0;
        const pct = cap > 0 ? Math.round((draw / cap) * 100) : 0;
        const color = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#22c55e';
        const stLabel = pct > 90 ? 'Critical' : pct > 75 ? 'Caution' : 'Safe';
        
        return `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:0.85rem">
              <span style="color:var(--text2)">Est. Total Draw:</span> 
              <strong style="color:var(--text)">${draw}W</strong>
            </div>
            <div style="font-size:0.85rem">
              <span style="color:var(--text2)">PSU Capacity:</span> 
              <strong style="color:var(--text)">${cap > 0 ? cap + 'W' : 'No PSU Selected'}</strong>
            </div>
          </div>
          <div style="margin-top:0.6rem;height:6px;border-radius:3px;background:var(--border);overflow:hidden">
            <div style="height:100%;width:${Math.min(100, pct)}%;background:${color}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-top:0.35rem">
            <span style="color:var(--text3)">${pct}% utilization</span>
            <span style="color:${color};font-weight:700">${stLabel}</span>
          </div>
        `;
      })()}
    </div>`;

  //  Per-game results 
  document.getElementById('bmGameResults').innerHTML = results.map(({ game, result }) => {
    const fpsBarWidth = Math.min((result.fps / game.maxFPS) * 100, 100);
    const gradeClass = { S: 'grade-s', A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d' }[result.grade];

    // FPS target lines
    const targets = [
      { fps: 60, label: '60', pct: (60 / game.maxFPS) * 100 },
      { fps: 120, label: '120', pct: (120 / game.maxFPS) * 100 },
      { fps: 165, label: '165', pct: (165 / game.maxFPS) * 100 },
    ].filter(t => t.pct <= 105);

    return `
      <div class="bm-game-card">
        <div class="bm-game-header">
          <div class="bm-game-icon">
            <img class="bm-game-logo-img" src="${game.logo}" alt="${game.name}"
                 onerror="this.style.display='none';this.parentElement.innerHTML='<span class=bm-game-icon-fallback>${game.icon}</span>'">
          </div>
          <div class="bm-game-meta">
            <div class="bm-game-name">${game.name}</div>
            <div class="bm-game-genre">${game.genre} · ${game.resolution}</div>
            <div class="bm-game-tags">
              ${game.tags.map(t => `<span class="bm-tag">${t}</span>`).join('')}
            </div>
          </div>
          <div class="bm-game-fps-block">
            <div class="bm-fps-num" style="color:${game.accent}">${result.fps}</div>
            <div class="bm-fps-label">avg FPS</div>
            <div class="bm-fps-frametime">${result.frametimeMs}ms</div>
          </div>
          <div class="bm-grade ${gradeClass}">${result.grade}</div>
        </div>
        <div class="bm-fps-bar-wrap">
          ${targets.map(t => `
            <div class="bm-fps-target-line" style="left:${t.pct}%">
              <span>${t.label}</span>
            </div>`).join('')}
          <div class="bm-fps-bar-bg">
            <div class="bm-fps-bar-fill" style="width:${fpsBarWidth}%;background:${game.accent}"
                 data-target="${fpsBarWidth}"></div>
          </div>
        </div>
        ${game.rtMultiplier < 1 ? `
          <div class="bm-rt-row">
            <span> With Ray Tracing / Path Tracing</span>
            <span style="color:var(--yellow)">${result.rtFPS} FPS</span>
          </div>` : ''}
        <div class="bm-bottleneck-chip ${result.bottleneck === 'Balanced' ? 'bal' : result.bottleneck.toLowerCase()}">
          ${result.bottleneck === 'Balanced' ? ' Balanced' : `${result.bottleneck === 'CPU' ? '' : ''} ${result.bottleneck} Bound`}
        </div>
      </div>`;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.bm-fps-bar-fill').forEach((bar, i) => {
      setTimeout(() => {
        bar.style.transition = 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        bar.style.width = bar.dataset.target + '%';
      }, i * 80);
    });
  });

  //  Avg FPS summary 
  const avgFPS = Math.round(results.reduce((s, r) => s + r.result.fps, 0) / results.length);
  document.getElementById('bmAvgFPS').innerHTML = `
    <span style="font-size:2rem;font-weight:700;color:var(--accent)">${avgFPS}</span>
    <span style="color:var(--text2);font-size:0.85rem">avg FPS across all games</span>`;
}

/*  helpers  */
function _scoreBar(label, score, name, color) {
  return `
    <div class="bm-comp-score-row">
      <span class="bm-comp-label">${label}</span>
      <div class="bm-comp-bar-bg">
        <div class="bm-comp-bar-fill" style="width:${score}%;background:${color}"></div>
      </div>
      <span class="bm-comp-val">${score}</span>
      <span class="bm-comp-name">${name}</span>
    </div>`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}