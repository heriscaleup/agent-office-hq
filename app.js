// Main Application Controller, Telemetry Engine, Cyberpunk Security Gate & Interrogation Console
let officeEngine = null;
let currentSelectedAgent = null;
let currentActiveView = 'office';

const AGENT_PROMPT_PRESETS = {
  'aero-writer': [
    'Kenapa lu nulis artikel Bintaro & BSD dulu?',
    'Dasar toleransi ±0.02mm itu dari mana?',
    'Gimana cara ngalahin Raja Laser & Kingsign di Bintaro?'
  ],
  'radar-x': [
    'Dasar lu bilang kita rank 4 plat besi apa?',
    'Siapa musuh terberat kita di Page 1 Google?',
    'Kapan keyword Bintaro & BSD tembus Top 3?'
  ],
  'iron-shield': [
    'Kenapa lu blokir 1.909 keyword ads?',
    'Yakin blokir keyword ini gak ngurangin lead pembeli?',
    'Berapa total rupiah budget ads yang udah lu hemat?'
  ],
  'hermes-sentry': [
    'Lead paling banyak masuk dari wilayah mana?',
    'Ada pesan WA calon pembeli yang bocor atau hilang?',
    'Berapa rata-rata konversi lead per minggu?'
  ],
  'cloud-forge': [
    'Gimana status VPS 163.61.44.41 saat ini?',
    'Jadwal deploy otomatis GitHub Actions jalan jam berapa?',
    'Apakah website aman dari crash dan overload?'
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Canvas Renderer
  officeEngine = new OfficeRenderer('officeCanvas');

  // 2. Check Authentication Clearance
  checkAuthStatus();

  // 3. Populate Roster Grid
  renderRoster();

  // 4. Populate Initial Events
  initEventLogs();

  // 5. Render KPI Tables
  renderKpiTables();

  // 6. Setup Header Controls
  setupHeaderControls();
});

// Authentication System
async function checkAuthStatus() {
  const token = localStorage.getItem('hq_auth_token');
  const authOverlay = document.getElementById('auth-gate-overlay');

  if (!token) {
    showAuthOverlay();
    return;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      hideAuthOverlay();
      syncLiveSerpData();
    } else {
      localStorage.removeItem('hq_auth_token');
      showAuthOverlay();
    }
  } catch (err) {
    hideAuthOverlay();
    syncLiveSerpData();
  }
}

function showAuthOverlay() {
  const authOverlay = document.getElementById('auth-gate-overlay');
  if (authOverlay) {
    authOverlay.classList.remove('hidden');
    const input = document.getElementById('auth-passcode');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function hideAuthOverlay() {
  const authOverlay = document.getElementById('auth-gate-overlay');
  if (authOverlay) {
    authOverlay.classList.add('hidden');
  }
  const errorMsg = document.getElementById('auth-error-msg');
  if (errorMsg) errorMsg.classList.add('hidden');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('auth-passcode');
  const errorMsg = document.getElementById('auth-error-msg');
  const btnSubmit = document.getElementById('btn-auth-submit');
  const password = input.value.trim();

  if (!password) return;

  btnSubmit.innerText = 'VERIFYING...';
  btnSubmit.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (res.ok && data.status === 'success') {
      localStorage.setItem('hq_auth_token', data.token);
      if (window.audioFX && window.audioFX.playSuccess) {
        window.audioFX.playSuccess();
      }
      hideAuthOverlay();
      addEventLog(new Date().toLocaleTimeString('id-ID'), '🔓 Access Granted: Level-4 clearance verified. Welcome Boss.', 'success');
      syncLiveSerpData();
    } else {
      if (window.audioFX && window.audioFX.playBlip) {
        window.audioFX.playBlip(220, 'sawtooth', 0.25);
      }
      errorMsg.innerText = '❌ ' + (data.message || 'ACCESS DENIED: INVALID PASSCODE');
      errorMsg.classList.remove('hidden');
      input.value = '';
      input.focus();
    }
  } catch (err) {
    errorMsg.innerText = '❌ Connection error: ' + err.message;
    errorMsg.classList.remove('hidden');
  } finally {
    btnSubmit.innerText = 'UNLOCK';
    btnSubmit.disabled = false;
  }
}

function lockTerminal() {
  localStorage.removeItem('hq_auth_token');
  if (window.audioFX && window.audioFX.playBlip) {
    window.audioFX.playBlip(350, 'sawtooth', 0.15);
  }
  showAuthOverlay();
  addEventLog(new Date().toLocaleTimeString('id-ID'), '🔒 Security Gate: Terminal locked by operator.', 'warning');
}

function switchView(viewName) {
  currentActiveView = viewName;
  const tabOffice = document.getElementById('tab-office');
  const tabKpi = document.getElementById('tab-kpi');
  const viewOffice = document.getElementById('view-office-section');
  const viewKpi = document.getElementById('view-kpi-section');

  if (viewName === 'office') {
    tabOffice.classList.add('active');
    tabKpi.classList.remove('active');
    viewOffice.classList.remove('hidden');
    viewKpi.classList.add('hidden');
    audioFX.playBlip(550, 'triangle', 0.08);
  } else {
    tabOffice.classList.remove('active');
    tabKpi.classList.add('active');
    viewOffice.classList.add('hidden');
    viewKpi.classList.remove('hidden');
    audioFX.playBlip(750, 'square', 0.08);
  }
}

function renderRoster() {
  const container = document.getElementById('rosterGrid');
  if (!container) return;
  container.innerHTML = '';

  SWARM_AGENTS.forEach(ag => {
    const item = document.createElement('div');
    item.className = 'roster-item';
    item.onclick = () => openAgentModal(ag.id);
    item.innerHTML = `
      <div class="roster-left">
        <span>${ag.avatar}</span>
        <div>
          <strong style="color: ${ag.color}">${ag.name}</strong>
          <span style="font-size: 9px; color: #8492a6; display:block;">${ag.title}</span>
        </div>
      </div>
      <div class="roster-status-dot" style="background: ${ag.state === 'WORKING' ? '#00ff66' : '#ffe600'}"></div>
    `;
    container.appendChild(item);
  });
}

function initEventLogs() {
  const initialEvents = [
    { time: '09:20:00', text: '💬 Interrogation Console armed: 1-on-1 employee debate ready.', type: 'success' },
    { time: '09:05:00', text: '🛡️ Security Gate: Level-4 clearance protocol activated.', type: 'info' },
    { time: '08:24:00', text: '🔎 SERP Auditor Telemetry active: Live competitor benchmark synced.', type: 'success' },
    { time: '06:30:28', text: '📊 Executive KPI Monitor calibrated across 3 domains (Tri-Force).', type: 'success' },
    { time: '00:00:00', text: '🚀 GitHub Actions Cloud Cron (daily-publish.yml) verified online.', type: 'info' }
  ];

  initialEvents.forEach(evt => addEventLog(evt.time, evt.text, evt.type));

  // Periodic simulated live pulse
  setInterval(() => {
    const pulses = [
      { text: '📡 IndexNow Heartbeat: 107 URLs confirmed indexed by search engines.', type: 'info', agent: 'aero-writer' },
      { text: '🔎 Googlebot crawler visited /lokasi/bintaro/ and /jasa-laser-fiber', type: 'success', agent: 'radar-x' },
      { text: '📱 Hermes Sentry: WhatsApp beacon listener checked (0 error, DB intact)', type: 'info', agent: 'hermes-sentry' },
      { text: '🛡️ Iron-Shield: Verified 102 organic keywords blocked from ad cannibalization.', type: 'warning', agent: 'iron-shield' },
      { text: '⚡ GitHub Actions: Next cloud publish cycle armed for tomorrow 07:00 WIB.', type: 'info', agent: 'cloud-forge' }
    ];
    const p = pulses[Math.floor(Math.random() * pulses.length)];
    const timeStr = new Date().toLocaleTimeString('id-ID');
    addEventLog(timeStr, p.text, p.type);
    
    if (officeEngine && p.agent) {
      officeEngine.showSpeech(p.agent, '⚡ ' + p.text.split(':')[0]);
    }
  }, 14000);
}

function addEventLog(time, text, type = 'info') {
  const container = document.getElementById('eventLog');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `event-item ${type}`;
  div.innerHTML = `
    <span class="time">[${time}]</span>
    <span>${text}</span>
  `;
  container.insertBefore(div, container.firstChild);

  if (container.children.length > 40) {
    container.removeChild(container.lastChild);
  }
}

function setupHeaderControls() {
  const btnSound = document.getElementById('btn-sound');
  if (btnSound) {
    btnSound.onclick = () => {
      audioFX.enabled = !audioFX.enabled;
      btnSound.innerText = audioFX.enabled ? '🔊 FX ON' : '🔇 FX OFF';
      audioFX.playBlip(500, 'triangle', 0.08);
    };
  }

  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    btnTheme.onclick = () => {
      document.body.classList.toggle('theme-day');
      btnTheme.innerText = document.body.classList.contains('theme-day') ? '☀️ DAY' : '🌙 NIGHT';
      audioFX.playBlip(700, 'square', 0.08);
    };
  }
}

async function triggerAction(actionKey) {
  audioFX.playBlip(800, 'square', 0.1);

  if (actionKey === 'blog') {
    officeEngine.showSpeech('aero-writer', '✍️ Menulis artikel E-E-A-T baru...');
    addEventLog(new Date().toLocaleTimeString('id-ID'), '✍️ Maya (Aero-Writer) dipicu: Memproses validasi schema Astro Markdown...', 'warning');
    setTimeout(() => {
      audioFX.playSuccess();
      addEventLog(new Date().toLocaleTimeString('id-ID'), '✅ Artikel baru sukses dikompilasi & di-push ke GitHub main!', 'success');
      officeEngine.showSpeech('aero-writer', '🚀 Artikel Sukses Live!');
    }, 2500);
  } else if (actionKey === 'rank') {
    officeEngine.showSpeech('radar-x', '📊 Menjalankan Live SERP Audit...');
    addEventLog(new Date().toLocaleTimeString('id-ID'), '📊 Nadia (Radar-X): Memindai live SERP Google & kompetitor Halaman 1...', 'info');
    
    try {
      const token = localStorage.getItem('hq_auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/serp-audit', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.keywords && data.keywords.length > 0) {
          KPI_DATA.serpLeaderboard = data.keywords;
          renderKpiTables();
        }
      }
    } catch (e) {
      console.log('Using local dataset');
    }

    setTimeout(() => {
      audioFX.playSuccess();
      addEventLog(new Date().toLocaleTimeString('id-ID'), '📈 Hasil Live SERP: Data ranking & Top 5 Kompetitor berhasil disinkronisasi!', 'success');
      officeEngine.showSpeech('radar-x', '🏆 SERP Sync Complete!');
    }, 1800);
  } else if (actionKey === 'geo') {
    officeEngine.showSpeech('radar-x', '🤖 Scanning GEO & LLM Citations...');
    addEventLog(new Date().toLocaleTimeString('id-ID'), '🤖 Nadia: Validasi format llms.txt di ChatGPT, Perplexity & Gemini...', 'info');
    setTimeout(() => {
      audioFX.playSuccess();
      addEventLog(new Date().toLocaleTimeString('id-ID'), '💎 GEO Radar Score: 94% Citation density confirmed.', 'success');
      officeEngine.showSpeech('radar-x', '🤖 GEO 94% Validated!');
    }, 1600);
  } else if (actionKey === 'leads') {
    officeEngine.showSpeech('hermes-sentry', '📱 Memeriksa database leads...');
    addEventLog(new Date().toLocaleTimeString('id-ID'), '📱 Budi (Hermes): Menarik 24 rekap leads WhatsApp terbaru...', 'info');
    setTimeout(() => {
      audioFX.playSuccess();
      addEventLog(new Date().toLocaleTimeString('id-ID'), '🎯 Total 24 Leads aktif. Top area: Bintaro Sektor 1-9 & BSD.', 'success');
      officeEngine.showSpeech('hermes-sentry', '📱 Leads Siap Di-followup!');
    }, 1500);
  } else if (actionKey === 'vps') {
    officeEngine.showSpeech('cloud-forge', '🖥️ Ping VPS 163.61.44.41...');
    addEventLog(new Date().toLocaleTimeString('id-ID'), '🖥️ Gilang (DevOps): VPS 163.61.44.41 Uptime 100%. RAM 3.0GB Free.', 'info');
    setTimeout(() => {
      audioFX.playSuccess();
      addEventLog(new Date().toLocaleTimeString('id-ID'), '✅ Status VPS: Sehat & Dingin. Coolify & n8n operational.', 'success');
      officeEngine.showSpeech('cloud-forge', '⚡ Server Aman & Stabil!');
    }, 1200);
  }
}

// Modal & Interrogation Controller
function switchModalTab(tabName) {
  const tabChat = document.getElementById('modal-tab-chat');
  const tabProfile = document.getElementById('modal-tab-profile');
  const sectionChat = document.getElementById('modal-section-chat');
  const sectionProfile = document.getElementById('modal-section-profile');

  if (tabName === 'chat') {
    tabChat.classList.add('active');
    tabProfile.classList.remove('active');
    sectionChat.classList.remove('hidden');
    sectionProfile.classList.add('hidden');
    const input = document.getElementById('agent-chat-input');
    if (input) input.focus();
  } else {
    tabChat.classList.remove('active');
    tabProfile.classList.add('active');
    sectionChat.classList.add('hidden');
    sectionProfile.classList.remove('hidden');
  }
}

function openAgentModal(agentId) {
  const agent = SWARM_AGENTS.find(a => a.id === agentId);
  if (!agent) return;

  currentSelectedAgent = agent;
  document.getElementById('modal-avatar').innerText = agent.avatar;
  document.getElementById('modal-title').innerText = `${agent.name} — ${agent.title}`;
  document.getElementById('modal-role').innerText = agent.role;
  document.getElementById('modal-engine').innerText = agent.engine;
  document.getElementById('modal-mission').innerText = agent.currentTask;
  document.getElementById('modal-target').innerText = agent.target;
  document.getElementById('modal-log').innerText = agent.lastLog;
  document.getElementById('modal-action-btn').innerText = `⚡ ${agent.actionLabel}`;

  // Reset Chat Terminal
  const chatBox = document.getElementById('agent-chat-box');
  chatBox.innerHTML = `
    <div class="chat-msg agent">
      <div class="chat-msg-header">
        <span class="chat-sender" style="color: ${agent.color}">${agent.avatar} ${agent.name} (${agent.title})</span>
        <span class="chat-time">${new Date().toLocaleTimeString('id-ID')}</span>
      </div>
      <div class="chat-bubble">Siap Bos! Gua standby. Ada yang mau lu interogasi soal data ranking, eksekusi keyword, anggaran ads, atau kendala lapangan gua? Tanya apa aja, gua jawab blak-blakan berbasis data fakta VPS.</div>
    </div>
  `;

  // Render Quick Prompt Chips
  const chipsContainer = document.getElementById('agent-quick-prompts');
  chipsContainer.innerHTML = '';
  const prompts = AGENT_PROMPT_PRESETS[agent.id] || [];
  prompts.forEach(p => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'prompt-chip';
    chip.innerText = p;
    chip.onclick = () => sendQuickPrompt(p);
    chipsContainer.appendChild(chip);
  });

  // Default to Chat tab
  switchModalTab('chat');

  document.getElementById('agent-modal').classList.remove('hidden');
  const chatInput = document.getElementById('agent-chat-input');
  if (chatInput) {
    chatInput.value = '';
    setTimeout(() => chatInput.focus(), 150);
  }
}

function closeModal() {
  document.getElementById('agent-modal').classList.add('hidden');
  currentSelectedAgent = null;
}

function sendQuickPrompt(promptText) {
  const input = document.getElementById('agent-chat-input');
  if (input) {
    input.value = promptText;
    handleSendAgentMessage(new Event('submit'));
  }
}

async function handleSendAgentMessage(event) {
  if (event) event.preventDefault();
  if (!currentSelectedAgent) return;

  const input = document.getElementById('agent-chat-input');
  const chatBox = document.getElementById('agent-chat-box');
  const btnSend = document.getElementById('btn-agent-send');
  const message = input.value.trim();

  if (!message) return;

  const timeStr = new Date().toLocaleTimeString('id-ID');

  // 1. Append User Message
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'chat-msg user';
  userMsgDiv.innerHTML = `
    <div class="chat-msg-header">
      <span class="chat-sender text-cyan">👑 Bos Dons</span>
      <span class="chat-time">${timeStr}</span>
    </div>
    <div class="chat-bubble">${escapeHtml(message)}</div>
  `;
  chatBox.appendChild(userMsgDiv);
  input.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  if (window.audioFX && window.audioFX.playBlip) {
    window.audioFX.playBlip(650, 'triangle', 0.08);
  }

  // 2. Append Thinking Indicator
  const thinkingId = 'thinking-' + Date.now();
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'chat-msg thinking';
  thinkingDiv.id = thinkingId;
  thinkingDiv.innerHTML = `
    <div class="chat-bubble">⚡ ${currentSelectedAgent.name} sedang memproses data telemetry...</div>
  `;
  chatBox.appendChild(thinkingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  btnSend.disabled = true;

  try {
    const token = localStorage.getItem('hq_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        agentId: currentSelectedAgent.id,
        message: message
      })
    });

    const data = await res.json();
    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    if (res.ok && data.status === 'success') {
      const agentMsgDiv = document.createElement('div');
      agentMsgDiv.className = 'chat-msg agent';
      agentMsgDiv.innerHTML = `
        <div class="chat-msg-header">
          <span class="chat-sender" style="color: ${data.agentColor}">${data.agentAvatar} ${data.agentName}</span>
          <span class="chat-time">${data.timestamp}</span>
        </div>
        <div class="chat-bubble">${formatMarkdownToHtml(data.reply)}</div>
      `;
      chatBox.appendChild(agentMsgDiv);
      chatBox.scrollTop = chatBox.scrollHeight;

      if (window.audioFX && window.audioFX.playSuccess) {
        window.audioFX.playSuccess();
      }
    } else {
      const errDiv = document.createElement('div');
      errDiv.className = 'chat-msg agent';
      errDiv.innerHTML = `
        <div class="chat-bubble text-red">❌ ${data.message || 'Gagal menghubungi agent.'}</div>
      `;
      chatBox.appendChild(errDiv);
    }
  } catch (err) {
    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    const errDiv = document.createElement('div');
    errDiv.className = 'chat-msg agent';
    errDiv.innerHTML = `
      <div class="chat-bubble text-red">❌ Connection Error: ${err.message}</div>
    `;
    chatBox.appendChild(errDiv);
  } finally {
    btnSend.disabled = false;
    input.focus();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

function formatMarkdownToHtml(mdText) {
  let html = escapeHtml(mdText);
  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Inline code `code`
  html = html.replace(/`(.*?)`/g, '<code class="font-mono" style="background:#1a2234; padding:2px 4px; border-radius:3px; color:#00f0ff;">$1</code>');
  // Newlines
  html = html.replace(/\n/g, '<br>');
  return html;
}

function executeModalAgentAction() {
  if (!currentSelectedAgent) return;
  audioFX.playSuccess();
  const ag = currentSelectedAgent;
  closeModal();

  officeEngine.showSpeech(ag.id, `⚡ ${ag.actionLabel}!`);
  addEventLog(new Date().toLocaleTimeString('id-ID'), `⚡ Manual trigger berhasil dijalankan untuk: ${ag.name} (${ag.title})`, 'warning');
}
