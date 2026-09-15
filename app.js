const STEPS = [
  {
    n: 1,
    title: 'User enters username',
    web: 'login',
    server: [],
    app: 'idle'
  },
  {
    n: 2,
    title: 'Server checks for registered Passkeys',
    web: 'login-checking',
    server: [
      { t: 'req', msg: 'POST /auth/check-user\n{ "username": "j.doe@cvs.com" }' },
      { t: 'res', msg: '200 OK\n{ "hasPasskey": true,\n  "offerMobileAuth": true }' }
    ],
    app: 'idle'
  },
  {
    n: 3,
    title: 'Mobile app login option presented',
    web: 'login-options',
    server: [],
    app: 'idle'
  },
  {
    n: 4,
    title: 'User selects "Use CVS App" — QR code generated',
    web: 'qr-code',
    server: [
      { t: 'req', msg: 'POST /auth/mobile-session/init' },
      { t: 'res', msg: '200 OK\n{ "webToken": "wst_a8f2b1c3d4",\n  "qrPayload": "cvs://auth?t=apt_x9k1d4e7" }' }
    ],
    app: 'idle'
  },
  {
    n: 5,
    title: 'QR scanned — CVS App opens via deep link',
    web: 'qr-waiting',
    server: [
      { t: 'req', msg: 'POST /auth/verify-app-token\n{ "appToken": "apt_x9k1d4e7f2" }' },
      { t: 'res', msg: '200 OK\n{ "valid": true,\n  "webSession": "wst_a8f2b1c3d4" }' }
    ],
    app: 'deeplink'
  },
  {
    n: 6,
    title: 'User confirms web login in app',
    web: 'qr-waiting',
    server: [],
    app: 'confirm'
  },
  {
    n: 7,
    title: 'Passkey authentication completes in app',
    web: 'qr-completing',
    server: [
      { t: 'evt', msg: 'HYPR → auth.app.complete\n{ "appToken": "apt_x9k1d4e7f2" }' },
      { t: 'req', msg: 'Authenticating web session via app token…' },
      { t: 'res', msg: '200 OK\n{ "access_token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJqLmRv..." }' }
    ],
    app: 'passkey'
  },
  {
    n: 8,
    title: 'Access token delivered to web session',
    web: 'receiving-token',
    server: [],
    app: 'app-success'
  },
  {
    n: 9,
    title: 'User successfully authenticated',
    web: 'authenticated',
    server: [
      { t: 'res', msg: 'Session established.\nIdentity: j.doe@cvs.com\nMethod: CVS App Passkey (HYPR)' }
    ],
    app: 'app-success'
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

  document.getElementById('webScreen').innerHTML = webScreen(s.web);
  document.getElementById('appScreen').innerHTML = appScreen(s.app);

  s.server.forEach(e => logs.push(e));
  renderLog();

  if (s.web === 'qr-code' || s.web === 'qr-waiting' || s.web === 'qr-completing') {
    setTimeout(() => { const c = document.getElementById('qrCanvas'); if (c) drawQR(c); }, 0);
  }
}

function renderLog() {
  const el = document.getElementById('serverLog');
  if (!logs.length) {
    el.innerHTML = '<p class="srv-idle">Awaiting requests…</p>';
    return;
  }
  el.innerHTML = logs.map(e =>
    `<div class="log-e ${e.t}">${e.msg}</div>`
  ).join('');
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
    case 'login':          return wLogin(false);
    case 'login-checking': return wLogin(true);
    case 'login-options':  return wOptions();
    case 'qr-code':        return wQR(false, false);
    case 'qr-waiting':     return wQR(true, false);
    case 'qr-completing':  return wQR(true, true);
    case 'receiving-token':return wReceiving();
    case 'authenticated':  return wAuthed();
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

function wOptions() {
  return `<div class="ws">
    <div class="ws-mark">CVS</div>
    <h2>Choose sign-in method</h2>
    <p class="sub" style="color:#10b981">&#10003; Passkey registered for this account</p>
    <div class="opt-card" style="cursor:default">
      <div class="opt-icon gray">&#128273;</div>
      <div>
        <div class="opt-label">Passkey (this device)</div>
        <div class="opt-sub">Use biometrics on this device</div>
      </div>
      <span class="opt-arrow">&#8250;</span>
    </div>
    <div class="opt-card selected">
      <div class="opt-icon red">CVS</div>
      <div>
        <div class="opt-label">CVS App <span class="opt-new">NEW</span></div>
        <div class="opt-sub">Authenticate via your mobile app</div>
      </div>
      <span class="opt-arrow" style="color:var(--red)">&#8250;</span>
    </div>
  </div>`;
}

function wQR(waiting, completing) {
  const inner = completing
    ? `<div style="width:148px;height:148px;display:flex;align-items:center;justify-content:center">
        <div class="spin" style="width:44px;height:44px;border-width:4px"></div>
       </div>`
    : `<canvas id="qrCanvas" class="qr-canvas" width="148" height="148"></canvas>`;

  const status = waiting
    ? `<div class="qr-waiting-pill"><div class="dot3"><span></span><span></span><span></span></div>Waiting for app</div>`
    : `<div class="qr-tag"><div class="pulse"></div>Expires in 2:47</div>`;

  return `<div class="ws">
    <div class="ws-mark">CVS</div>
    <h2>${completing ? 'Authenticating…' : 'Scan with CVS App'}</h2>
    <p class="sub">${completing ? 'Verifying your identity' : 'Open CVS App and scan this code'}</p>
    <div class="ws-qr-wrap">
      ${inner}
      ${status}
      <p class="qr-url">cvs://auth?t=wst_a8f2b1c3&s=apt_x9k1d4e7</p>
    </div>
  </div>`;
}

function wReceiving() {
  return `<div class="ws" style="justify-content:center;gap:.75rem">
    <div class="spin" style="width:44px;height:44px;border-width:4px"></div>
    <h2 style="font-size:1.05rem">Completing sign-in</h2>
    <p style="font-size:.78rem;color:#9ca3af">Receiving authentication token…</p>
    <div class="token-box">access_token: eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJqLmRvZUBjdnMuY29tIiwiaWF0IjoxNzI2Mzg0MDAwfQ...</div>
  </div>`;
}

function wAuthed() {
  return `<div class="ws" style="justify-content:center">
    <div class="check-circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h2>Welcome back!</h2>
    <p class="sub" style="margin-bottom:.25rem">You&#39;re signed in to CVS Health</p>
    <div class="user-card">
      <div class="avatar">JD</div>
      <div>
        <div class="u-name">John Doe</div>
        <div class="u-sub">j.doe@cvs.com &middot; Employee</div>
      </div>
      <svg style="margin-left:auto;color:#10b981;width:18px;height:18px" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"/>
      </svg>
    </div>
    <div class="auth-method">&#128274; Authenticated via CVS App Passkey (HYPR)</div>
  </div>`;
}

/* ── APP SCREENS ── */
function appScreen(id) {
  switch (id) {
    case 'idle':        return aIdle();
    case 'deeplink':    return aDeepLink();
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

function aDeepLink() {
  return `<div class="as as-deeplink">
    <div class="app-icon">CVS</div>
    <h3>Opening CVS App</h3>
    <p>Deep link received</p>
    <p class="dl-token">cvs://auth?t=apt_x9k1d4e7…</p>
    <div class="spin" style="width:22px;height:22px;border-color:rgba(255,255,255,.15);border-top-color:#fff;margin-top:.25rem"></div>
  </div>`;
}

function aConfirm() {
  return `<div class="as as-confirm">
    <div class="app-topbar">
      <span class="app-topbar-logo">CVS</span>
      <span class="app-topbar-sub">health</span>
    </div>
    <div class="confirm-body">
      <div class="web-icon">&#127760;</div>
      <h3>Sign in to CVS.com?</h3>
      <p>A sign-in request was received from your web browser.</p>
      <div class="site-badge">
        <span class="lock-green">&#128274;</span>
        <span class="site-url">cvs.com</span>
        <span class="site-ok">Verified</span>
      </div>
      <p class="conf-note">Signed in as j.doe@cvs.com</p>
    </div>
    <div class="app-actions">
      <button class="app-btn primary">Continue with Passkey</button>
      <button class="app-btn ghost">Cancel</button>
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
    <p class="pk-sub">Authenticating…</p>
    <p class="hypr-tag">HYPR Passkey</p>
  </div>`;
}

function aSuccess() {
  return `<div class="as as-success">
    <div class="success-ring">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h3>Authentication Complete</h3>
    <p>Web login verified successfully</p>
    <div class="token-returned">access_token returned to web</div>
  </div>`;
}

/* ── QR CODE CANVAS ── */
function drawQR(canvas) {
  const ctx = canvas.getContext('2d');
  const N = 21;
  const cell = Math.floor(canvas.width / N);

  const grid = [];
  let seed = 0xdeadbeef;
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
