const STEPS = [
  {
    n: 1,
    title: 'User enters username',
    web: 'login',
    url: 'cvs.com/account/login',
    server: [],
    app: 'idle'
  },
  {
    n: 2,
    title: 'Server checks for registered Passkeys',
    web: 'login-checking',
    url: 'cvs.com/account/login',
    server: [
      { t: 'req', msg: 'POST /auth/check-user\n{ "username": "j.doe@cvs.com" }' },
      { t: 'res', msg: '200 OK\n{ "hasPasskey": true,\n  "offerMobileAuth": true }' }
    ],
    app: 'idle'
  },
  {
    n: 3,
    title: 'User chooses "Log in and continue in the app"',
    web: 'choose-app',
    url: 'cvs.com/account/login',
    server: [],
    app: 'idle'
  },
  {
    n: 4,
    title: 'Session transfer QR code generated',
    web: 'qr-transfer',
    url: 'cvs.com/account/login',
    server: [
      { t: 'req', msg: 'POST /auth/session-transfer/init' },
      { t: 'res', msg: '200 OK\n{ "transferToken": "xfr_c7d9e2f1",\n  "qrPayload": "cvs://session-transfer?t=xfr_c7d9e2f1" }' }
    ],
    app: 'idle'
  },
  {
    n: 5,
    title: 'App scans QR — transfer request verified',
    web: 'qr-waiting',
    url: 'cvs.com/account/login',
    server: [
      { t: 'req', msg: 'POST /auth/verify-transfer\n{ "transferToken": "xfr_c7d9e2f1" }' },
      { t: 'res', msg: '200 OK\n{ "valid": true,\n  "origin": "cvs.com",\n  "user": "j.doe@cvs.com" }' }
    ],
    app: 'deeplink'
  },
  {
    n: 6,
    title: 'User confirms session transfer in app',
    web: 'qr-waiting',
    url: 'cvs.com/account/login',
    server: [],
    app: 'confirm-transfer'
  },
  {
    n: 7,
    title: 'Passkey auth completes — session being transferred',
    web: 'qr-authing',
    url: 'cvs.com/account/login',
    server: [
      { t: 'evt', msg: 'HYPR → passkey.complete\n{ "transferToken": "xfr_c7d9e2f1" }' },
      { t: 'req', msg: 'POST /auth/session-transfer/finalize' },
      { t: 'res', msg: '200 OK\n{ "appSessionToken": "ast_8b3f...",\n  "webEvent": "session_transferred",\n  "continueUrl": "cvs.com/home" }' }
    ],
    app: 'passkey'
  },
  {
    n: 8,
    title: 'Session transferred — continue in CVS App',
    web: 'handed-off',
    url: 'cvs.com/account/login',
    server: [
      { t: 'res', msg: 'Web notified: session_transferred\nApp session active for j.doe@cvs.com' }
    ],
    app: 'app-home'
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
  document.getElementById('urlBar').innerHTML = urlBarHTML(s.url, idx);

  STEPS.forEach((_, i) => {
    const d = document.getElementById('ds' + i);
    d.className = 'dot-step' + (i === idx ? ' active' : i < idx ? ' done' : '');
  });

  document.getElementById('btnPrev').disabled = idx === 0;
  document.getElementById('btnNext').disabled = idx === STEPS.length - 1;
  document.getElementById('btnNext').innerHTML = idx === STEPS.length - 2
    ? 'Finish &#10003;'
    : 'Next &#8594;';

  document.getElementById('webScreen').innerHTML = webScreen(s.web);
  document.getElementById('appScreen').innerHTML = appScreen(s.app);

  s.server.forEach(e => logs.push(e));
  renderLog();

  if (s.web === 'qr-transfer' || s.web === 'qr-waiting' || s.web === 'qr-authing') {
    setTimeout(() => { const c = document.getElementById('qrCanvas'); if (c) drawQR(c); }, 0);
  }
}

function urlBarHTML(url, idx) {
  const dimmed = idx === STEPS.length - 1;
  return `<svg class="lock" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="1.5" fill="${dimmed ? '#9ca3af' : '#22c55e'}"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="${dimmed ? '#9ca3af' : '#22c55e'}" stroke-width="1.5" fill="none"/></svg>${url}`;
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

/* ── WEB SCREENS ── */
function webScreen(id) {
  switch (id) {
    case 'login':           return wLogin(false);
    case 'login-checking':  return wLogin(true);
    case 'choose-app':      return wChooseApp();
    case 'qr-transfer':     return wQR(false);
    case 'qr-waiting':      return wQR(true, false);
    case 'qr-authing':      return wQR(true, true);
    case 'handed-off':      return wHandedOff();
    default: return '';
  }
}

function wLogin(checking) {
  return `<div class="ws">
    <div class="ws-mark">CVS</div>
    <h2>Sign In</h2>
    <p class="sub">CVS Health Account</p>
    ${checking ? `
      <div style="display:flex;flex-direction:column;align-items:center;gap:.75rem;margin-top:.5rem">
        <div class="spin"></div>
        <p style="font-size:.78rem;color:#9ca3af">Checking your account…</p>
      </div>
    ` : `
      <div class="ws-field" style="width:100%">
        <label>Email or Username</label>
        <input class="ws-input focused" value="j.doe@cvs.com" readonly />
      </div>
      <button class="ws-btn primary">Continue</button>
    `}
  </div>`;
}

function wChooseApp() {
  return `<div class="ws">
    <div class="ws-mark">CVS</div>
    <h2>How would you like to sign in?</h2>
    <p class="sub" style="color:#10b981;margin-bottom:.75rem">&#10003; Passkey registered for this account</p>

    <div class="opt-card" style="cursor:default">
      <div class="opt-icon gray">&#128273;</div>
      <div>
        <div class="opt-label">Sign in here</div>
        <div class="opt-sub">Use biometrics on this device</div>
      </div>
      <span class="opt-arrow">&#8250;</span>
    </div>

    <div class="opt-card" style="cursor:default">
      <div class="opt-icon gray">&#128233;</div>
      <div>
        <div class="opt-label">Email or SMS OTP</div>
        <div class="opt-sub">Send a one-time code to your email or phone</div>
      </div>
      <span class="opt-arrow">&#8250;</span>
    </div>

    <div class="opt-card selected-blue">
      <div class="opt-icon blue">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path d="M8 2a1 1 0 00-1 1v1H5a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1h-2V3a1 1 0 00-1-1H8zM7 6V4h6v2H7z"/>
        </svg>
      </div>
      <div>
        <div class="opt-label">Log in &amp; continue in app <span class="opt-new" style="background:#3b82f6">NEW</span></div>
        <div class="opt-sub">Transfer your session to the CVS App</div>
      </div>
      <span class="opt-arrow blue">&#8250;</span>
    </div>
  </div>`;
}

function wQR(waiting, authing) {
  if (authing) {
    return `<div class="ws">
      <div class="ws-mark">CVS</div>
      <h2>Authenticating in app…</h2>
      <p class="sub">Waiting for passkey confirmation</p>
      <div class="ws-qr-wrap" style="margin-top:.5rem">
        <div style="width:148px;height:148px;display:flex;align-items:center;justify-content:center">
          <div class="spin" style="width:44px;height:44px;border-width:4px"></div>
        </div>
        <div class="qr-waiting-pill"><div class="dot3"><span></span><span></span><span></span></div>Transferring session</div>
      </div>
    </div>`;
  }

  return `<div class="ws">
    <div class="ws-mark">CVS</div>
    <h2>${waiting ? 'Waiting for app…' : 'Scan to continue in the app'}</h2>
    <p class="sub">Open CVS App and scan this code to transfer your session</p>
    <div class="ws-transfer-tag">
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 4.5A1.5 1.5 0 014.5 3h7A1.5 1.5 0 0113 4.5v7a1.5 1.5 0 01-1.5 1.5H9v-1.5h2.5v-7h-7V7H3V4.5zM3 8l3-3v2h5v2H6v2L3 8z"/></svg>
      Session transfer
    </div>
    <div class="ws-qr-wrap">
      <canvas id="qrCanvas" class="qr-canvas" width="148" height="148"></canvas>
      ${waiting
        ? `<div class="qr-waiting-pill"><div class="dot3"><span></span><span></span><span></span></div>Waiting for app</div>`
        : `<div class="qr-tag"><div class="pulse"></div>Expires in 4:59</div>`
      }
      <p class="qr-url">cvs://session-transfer?t=xfr_c7d9e2f1</p>
    </div>
  </div>`;
}

function wHandedOff() {
  return `<div class="ws-handed-off">
    <div class="handoff-icon" style="margin-bottom:.85rem">
      <div class="handoff-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
      <div class="handoff-web">&#128187;</div>
      <div class="handoff-arrow">&#8594;</div>
      <div class="handoff-phone">CVS</div>
    </div>
    <h2>Session transferred</h2>
    <p class="sub">Your CVS.com session is now active in the CVS App. You can close this browser window.</p>

    <div class="handoff-info">
      <div class="handoff-info-row">
        <span class="label">Signed in as</span>
        <span class="val">j.doe@cvs.com</span>
      </div>
      <div class="handoff-info-row">
        <span class="label">Transferred to</span>
        <span class="val">CVS App (iPhone)</span>
      </div>
      <div class="handoff-info-row">
        <span class="label">Method</span>
        <span class="val">HYPR Passkey</span>
      </div>
    </div>
    <p class="close-hint">This browser session has ended</p>
  </div>`;
}

/* ── APP SCREENS ── */
function appScreen(id) {
  switch (id) {
    case 'idle':             return aIdle();
    case 'deeplink':         return aDeepLink();
    case 'confirm-transfer': return aConfirmTransfer();
    case 'passkey':          return aPasskey();
    case 'app-home':         return aHome();
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

function aDeepLink() {
  return `<div class="as as-deeplink">
    <div class="app-icon">CVS</div>
    <h3>Opening CVS App</h3>
    <p>Session transfer request</p>
    <p class="dl-token">cvs://session-transfer?t=xfr_c7d9e2f1</p>
    <div class="spin" style="width:22px;height:22px;border-color:rgba(255,255,255,.15);border-top-color:#fff;margin-top:.25rem"></div>
  </div>`;
}

function aConfirmTransfer() {
  return `<div class="as as-confirm-transfer">
    <div class="app-topbar">
      <span class="app-topbar-logo">CVS</span>
      <span class="app-topbar-sub">health</span>
    </div>
    <div class="transfer-body">
      <div class="transfer-icon">&#128260;</div>
      <h3>Continue session in app?</h3>
      <p>A session transfer was requested from your web browser. Authenticate to bring your session here.</p>
      <div class="transfer-from">
        <span class="from-lock">&#128274;</span>
        <span class="from-url">cvs.com</span>
        <span class="from-ok">Verified</span>
      </div>
      <p class="transfer-detail">Signed in as j.doe@cvs.com</p>
    </div>
    <div class="app-actions">
      <button class="app-btn primary">Continue with Passkey</button>
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
    <p class="pk-sub">Verifying identity…</p>
    <p class="hypr-tag">HYPR Passkey · Session Transfer</p>
  </div>`;
}

function aHome() {
  return `<div class="as as-home">
    <div class="home-topbar">
      <div class="home-topbar-row">
        <div class="home-logo">CVS <span>health</span></div>
        <div class="home-avatar-sm">JD</div>
      </div>
      <div class="home-greeting">Good morning, John &#128075;</div>
    </div>

    <div class="session-banner">
      <div class="session-dot-green"></div>
      <div class="session-banner-text">
        <strong>Web session transferred</strong>
        Signed in from cvs.com &#183; HYPR Passkey
      </div>
    </div>

    <div class="home-quick">
      <div class="quick-tile">
        <div class="qt-icon">&#128138;</div>
        <div class="qt-label">Prescriptions</div>
        <div class="qt-sub">2 ready for pickup</div>
      </div>
      <div class="quick-tile">
        <div class="qt-icon">&#11088;</div>
        <div class="qt-label">ExtraCare</div>
        <div class="qt-sub">4,210 pts</div>
      </div>
      <div class="quick-tile">
        <div class="qt-icon">&#128203;</div>
        <div class="qt-label">Health</div>
        <div class="qt-sub">Records &amp; history</div>
      </div>
      <div class="quick-tile">
        <div class="qt-icon">&#128205;</div>
        <div class="qt-label">Stores</div>
        <div class="qt-sub">Find nearby</div>
      </div>
    </div>

    <div class="home-footer-bar">
      <div class="tab-item active-tab"><div class="tab-icon">&#127968;</div>Home</div>
      <div class="tab-item"><div class="tab-icon">&#128138;</div>Rx</div>
      <div class="tab-item"><div class="tab-icon">&#128722;</div>Shop</div>
      <div class="tab-item"><div class="tab-icon">&#128100;</div>Account</div>
    </div>
  </div>`;
}

/* ── QR CODE CANVAS ── */
function drawQR(canvas) {
  const ctx = canvas.getContext('2d');
  const N = 21;
  const cell = Math.floor(canvas.width / N);

  const grid = [];
  let seed = 0xcafef00d;
  const rng = () => {
    seed = ((seed ^ (seed << 13)) >>> 0);
    seed = ((seed ^ (seed >> 7)) >>> 0);
    seed = ((seed ^ (seed << 5)) >>> 0);
    return (seed % 100) > 42;
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
