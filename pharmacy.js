const STEPS = [
  {
    n: 1,
    title: 'QR code displayed at pharmacy sale counter',
    pos: 'pickup-qr',
    server: [],
    app: 'idle',
    lights: { green: true, amber: false }
  },
  {
    n: 2,
    title: 'Customer scans QR with CVS App',
    pos: 'pickup-qr',
    server: [
      { t: 'req', msg: 'POST /pharmacy/scan\n{ "posToken": "pos_f3a2e1b4",\n  "terminalId": "POS-003",\n  "store": "7841" }' },
      { t: 'res', msg: '200 OK\n{ "valid": true,\n  "store": "CVS #7841 – Woonsocket, RI",\n  "sessionId": "pharm_9x2kd4f1" }' }
    ],
    app: 'scanning',
    lights: { green: true, amber: true }
  },
  {
    n: 3,
    title: 'App prompts customer to confirm identity',
    pos: 'waiting',
    server: [],
    app: 'confirm',
    lights: { green: true, amber: true }
  },
  {
    n: 4,
    title: 'Passkey authentication completes',
    pos: 'authenticating',
    server: [
      { t: 'evt', msg: 'HYPR → passkey.complete\n{ "sessionId": "pharm_9x2kd4f1" }' },
      { t: 'req', msg: 'POST /pharmacy/auth-complete\n{ "sessionId": "pharm_9x2kd4f1",\n  "customerId": "xc_8821f4a3" }' },
      { t: 'res', msg: '200 OK\n{ "verified": true,\n  "customer": "John Doe",\n  "extraCare": "•••• •••• 4821",\n  "rxReady": 2,\n  "rxItems": ["Lisinopril 10mg", "Atorvastatin 20mg"] }' }
    ],
    app: 'passkey',
    lights: { green: true, amber: true }
  },
  {
    n: 5,
    title: 'Customer verified — prescriptions ready for pickup',
    pos: 'verified',
    server: [
      { t: 'res', msg: 'POS-003 notified: customer verified\nAuthorized: 2 Rx for John Doe\nExtraCare applied: ending 4821' }
    ],
    app: 'app-success',
    lights: { green: true, amber: false }
  }
];

let cur = 0;
let logs = [];

window.addEventListener('DOMContentLoaded', () => {
  buildDots();
  render(0);
});

function buildDots() {
  const el = document.getElementById('dots');
  STEPS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot-step';
    d.id = 'ds' + i;
    el.appendChild(d);
  });
}

function render(idx) {
  const s = STEPS[idx];

  document.getElementById('stepCounter').textContent = `Step ${s.n} of ${STEPS.length}`;
  document.getElementById('stepTitle').textContent = s.title;
  document.getElementById('progressFill').style.width = `${(s.n / STEPS.length) * 100}%`;

  STEPS.forEach((_, i) => {
    const d = document.getElementById('ds' + i);
    d.className = 'dot-step' + (i === idx ? ' active' : i < idx ? ' done' : '');
  });

  document.getElementById('btnPrev').disabled = idx === 0;
  document.getElementById('btnNext').disabled = idx === STEPS.length - 1;
  document.getElementById('btnNext').innerHTML = idx === STEPS.length - 2
    ? 'Finish &#10003;'
    : 'Next &#8594;';

  // Terminal status lights
  const gl = document.getElementById('tLightGreen');
  const al = document.getElementById('tLightAmber');
  if (gl) gl.className = 't-light green' + (s.lights.green ? '' : ' off');
  if (al) al.className = 't-light amber' + (s.lights.amber ? ' blink' : '');

  document.getElementById('posScreen').innerHTML = posScreen(s.pos);
  document.getElementById('appScreen').innerHTML = appScreen(s.app);

  s.server.forEach(e => logs.push(e));
  renderLog();

  if (s.pos === 'pickup-qr') {
    setTimeout(() => {
      const c = document.getElementById('posQR');
      if (c) drawQR(c, 0xabcdef12);
      const g = document.getElementById('ghostQR');
      if (g) drawQR(g, 0xabcdef12);
    }, 0);
  }
}

function renderLog() {
  const el = document.getElementById('serverLog');
  if (!logs.length) {
    el.innerHTML = '<p class="srv-idle">Awaiting requests…</p>';
    return;
  }
  el.innerHTML = logs.map(e => `<div class="log-e ${e.t}">${e.msg}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function nextStep() { if (cur < STEPS.length - 1) { cur++; render(cur); } }
function prevStep() {
  if (cur > 0) {
    cur--;
    logs = [];
    for (let i = 0; i <= cur; i++) STEPS[i].server.forEach(e => logs.push(e));
    render(cur);
  }
}

/* ── POS SCREENS ── */
function posScreen(id) {
  switch (id) {
    case 'pickup-qr':     return posPickupQR();
    case 'waiting':       return posWaiting();
    case 'authenticating':return posAuthenticating();
    case 'verified':      return posVerified();
    default: return '';
  }
}

function posPickupQR() {
  return `
    <div class="pos-hdr">
      <div class="pos-hdr-row">
        <div class="pos-hdr-logo">CVS <span>pharmacy</span></div>
        <div class="pos-terminal-id">POS-003</div>
      </div>
      <div class="pos-store">CVS #7841 &mdash; 1 CVS Dr, Woonsocket, RI</div>
    </div>
    <div class="pos-pickup">
      <div class="pos-rx-card">
        <div class="pos-rx-icon">&#128138;</div>
        <div>
          <div class="pos-rx-name">Prescription Pickup</div>
          <div class="pos-rx-sub">Patient: ••• Doe &nbsp;|&nbsp; DOB: ••/••/19••</div>
        </div>
        <div class="pos-rx-count">2 Rx</div>
      </div>
      <div class="pos-divider"></div>
      <div class="pos-scan-label">Scan with CVS App to verify your identity</div>
      <div class="pos-qr-zone">
        <canvas id="posQR" width="148" height="148" style="border-radius:4px"></canvas>
        <div class="pos-qr-instruction">
          <div class="pos-qr-pulse"></div>
          QR active &nbsp;&middot;&nbsp; pos_f3a2e1b4
        </div>
      </div>
      <div class="pos-alt">Or verify with date of birth at the counter</div>
    </div>
  `;
}

function posWaiting() {
  return `
    <div class="pos-hdr">
      <div class="pos-hdr-row">
        <div class="pos-hdr-logo">CVS <span>pharmacy</span></div>
        <div class="pos-terminal-id">POS-003</div>
      </div>
      <div class="pos-store">CVS #7841 &mdash; 1 CVS Dr, Woonsocket, RI</div>
    </div>
    <div class="pos-waiting">
      <div class="pos-wait-ring"></div>
      <h3>QR scanned</h3>
      <p>Waiting for customer to<br>confirm in CVS App&hellip;</p>
      <div class="pos-session-tag">pharm_9x2kd4f1</div>
    </div>
  `;
}

function posAuthenticating() {
  return `
    <div class="pos-hdr">
      <div class="pos-hdr-row">
        <div class="pos-hdr-logo">CVS <span>pharmacy</span></div>
        <div class="pos-terminal-id">POS-003</div>
      </div>
      <div class="pos-store">CVS #7841 &mdash; 1 CVS Dr, Woonsocket, RI</div>
    </div>
    <div class="pos-authing">
      <div class="spin" style="width:38px;height:38px;border-width:3.5px;border-color:#f0f0f0;border-top-color:var(--red)"></div>
      <h3>Authenticating&hellip;</h3>
      <p>Passkey verification in progress</p>
      <div class="pos-auth-steps">
        <div class="pos-auth-step done">
          <span class="step-check">&#10003;</span>
          QR token verified
        </div>
        <div class="pos-auth-step done">
          <span class="step-check">&#10003;</span>
          Session linked to terminal
        </div>
        <div class="pos-auth-step active">
          <div class="step-spin"></div>
          Passkey authentication
        </div>
        <div class="pos-auth-step wait">
          <div class="step-dot"></div>
          Release prescriptions
        </div>
      </div>
    </div>
  `;
}

function posVerified() {
  return `
    <div class="pos-verified-screen">
      <div class="pos-verified-hdr">
        <div class="pos-verified-hdr-row">
          <div class="pos-verified-logo">CVS <span>pharmacy</span></div>
          <div class="pos-verified-badge">&#10003; Verified</div>
        </div>
        <div class="pos-verified-sub">CVS #7841 &mdash; POS-003</div>
      </div>
      <div class="pos-verified-body">
        <div class="pos-customer-card">
          <div class="pos-cust-avatar">JD</div>
          <div>
            <div class="pos-cust-name">John Doe</div>
            <div class="pos-cust-sub">ExtraCare &nbsp;&#183;&nbsp; ending 4821</div>
          </div>
        </div>
        <div class="pos-rx-list-hdr">Ready for pickup</div>
        <div class="pos-rx-item">
          <span class="pos-rx-pill-icon">&#128138;</span>
          <div>
            <div class="pos-rx-drug">Lisinopril 10mg</div>
            <div class="pos-rx-detail">30-day supply &nbsp;&#183;&nbsp; Rx #4481209</div>
          </div>
          <span class="pos-rx-ready">Ready</span>
        </div>
        <div class="pos-rx-item">
          <span class="pos-rx-pill-icon">&#128138;</span>
          <div>
            <div class="pos-rx-drug">Atorvastatin 20mg</div>
            <div class="pos-rx-detail">90-day supply &nbsp;&#183;&nbsp; Rx #4481210</div>
          </div>
          <span class="pos-rx-ready">Ready</span>
        </div>
      </div>
      <div class="pos-action-bar">Hand prescriptions to customer &rarr;</div>
    </div>
  `;
}

/* ── APP SCREENS ── */
function appScreen(id) {
  switch (id) {
    case 'idle':        return aIdle();
    case 'scanning':    return aScanning();
    case 'confirm':     return aConfirm();
    case 'passkey':     return aPasskey();
    case 'app-success': return aSuccess();
    default: return '';
  }
}

function aIdle() {
  return `<div class="as as-idle">
    <div class="as-time">9:41</div>
    <div class="as-date">Mon, Sep 15</div>
    <div class="as-lock">
      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    </div>
    <div class="as-app-name">CVS Health</div>
  </div>`;
}

function aScanning() {
  return `<div class="as as-scanner">
    <div class="scan-cvs-logo">CVS health</div>
    <div class="scan-frame">
      <div class="scan-corner tl"></div>
      <div class="scan-corner tr"></div>
      <div class="scan-corner bl"></div>
      <div class="scan-corner br"></div>
      <canvas class="scan-qr-ghost" id="ghostQR" width="118" height="118"></canvas>
      <div class="scan-line"></div>
    </div>
    <h3>Scanning&hellip;</h3>
    <p>Point at the QR code on the<br>pharmacy terminal</p>
  </div>`;
}

function aConfirm() {
  return `<div class="as as-pharm-confirm">
    <div class="pharm-topbar">
      <div class="pharm-topbar-row">
        <div class="pharm-logo">CVS <span class="pharm-logo-sub">pharmacy</span></div>
        <div class="pharm-topbar-icon">&#128138;</div>
      </div>
      <div class="pharm-store-tag">CVS #7841 &mdash; Woonsocket, RI</div>
    </div>
    <div class="pharm-confirm-body">
      <div class="pharm-counter-icon">&#127978;</div>
      <h3>Verify at pharmacy counter?</h3>
      <p>A verification request was received from the sale counter. Authenticate to confirm your identity and release your prescriptions.</p>
      <div class="pharm-store-badge">
        <span class="badge-icon">&#128205;</span>
        <div>
          <div class="pharm-store-name">CVS Pharmacy #7841</div>
          <div class="pharm-store-addr">1 CVS Dr, Woonsocket, RI</div>
        </div>
        <div class="pharm-terminal-tag">POS-003</div>
      </div>
      <div class="pharm-rx-preview">
        &#128138;&nbsp; 2 prescriptions ready for pickup
      </div>
    </div>
    <div class="app-actions">
      <button class="app-btn primary">Verify with Passkey</button>
      <button class="app-btn ghost">Decline</button>
    </div>
  </div>`;
}

function aPasskey() {
  return `<div class="as as-passkey">
    <div class="faceid">
      <svg viewBox="0 0 80 80" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.5">
        <ellipse cx="40" cy="36" rx="17" ry="20"/>
        <line x1="32" y1="33" x2="32" y2="39"/>
        <line x1="48" y1="33" x2="48" y2="39"/>
        <path d="M40 40 L37 47 L43 47"/>
        <path d="M34 52 Q40 57 46 52"/>
      </svg>
    </div>
    <h3>Face ID</h3>
    <p class="pk-sub">Verifying identity&hellip;</p>
    <p class="hypr-tag">HYPR Passkey &middot; Pharmacy Auth</p>
  </div>`;
}

function aSuccess() {
  return `<div class="as as-pharm-success">
    <div class="pharm-success-ring">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h3>Identity Verified</h3>
    <p>Authenticated at CVS Pharmacy</p>
    <div class="pharm-success-card">
      <div class="pharm-sc-row">
        <span class="k">Store</span>
        <span class="v">CVS #7841, Woonsocket</span>
      </div>
      <div class="pharm-sc-row">
        <span class="k">Terminal</span>
        <span class="v">POS-003</span>
      </div>
      <div class="pharm-sc-row">
        <span class="k">Rx released</span>
        <span class="v">2 prescriptions &#10003;</span>
      </div>
    </div>
    <div class="pharm-extra-care">
      <span class="ec-star">&#11088;</span>
      ExtraCare ending 4821 &nbsp;&middot;&nbsp; 4,210 pts
    </div>
  </div>`;
}

/* ── QR CODE CANVAS ── */
function drawQR(canvas, seed) {
  const ctx = canvas.getContext('2d');
  const N = 21;
  const cell = Math.floor(canvas.width / N);

  const grid = [];
  let s = seed >>> 0;
  const rng = () => {
    s = ((s ^ (s << 13)) >>> 0);
    s = ((s ^ (s >> 7)) >>> 0);
    s = ((s ^ (s << 5)) >>> 0);
    return (s % 100) > 42;
  };
  for (let r = 0; r < N; r++) { grid[r] = []; for (let c = 0; c < N; c++) grid[r][c] = rng(); }

  function finder(row, col) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        grid[row + r][col + c] = (r === 0 || r === 6 || c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
    }
    for (let i = 0; i < 8 && row + 7 < N; i++) grid[row + 7][col + i] = false;
    for (let i = 0; i < 8 && col + 7 < N; i++) grid[row + i][col + 7] = false;
  }

  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) { grid[6][i] = i % 2 === 0; grid[i][6] = i % 2 === 0; }

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      ctx.fillStyle = grid[r][c] ? '#111' : '#fff';
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
}
