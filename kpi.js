// Executive KPI, GA4 & GEO Intelligence Registry (Multi-Domain Fleet Engine)
let CURRENT_FLEET_FILTER = 'all';

let KPI_DATA = {
  // Aggregate Tri-Force Summary
  summary: {
    all: {
      adSavingsWeekly: 'Rp 7.850.000',
      adSavingsSub: '/minggu (3 Domain)',
      organicClicksWeekly: 1740,
      avgCpc: 4500,
      page1Share: '76% (Target: 70%)',
      page1Count: 23,
      totalKeywords: 30,
      leadsWeekly: 48,
      boncosKeywordsBlocked: 1909
    },
    tepatlaser: {
      adSavingsWeekly: 'Rp 3.420.000',
      adSavingsSub: '/minggu (TepatLaser)',
      organicClicksWeekly: 760,
      avgCpc: 4500,
      page1Share: '70% (Local Hub)',
      page1Count: 7,
      totalKeywords: 10,
      leadsWeekly: 24,
      boncosKeywordsBlocked: 850
    },
    rajacutting: {
      adSavingsWeekly: 'Rp 2.150.000',
      adSavingsSub: '/minggu (RajaCutting)',
      organicClicksWeekly: 480,
      avgCpc: 4500,
      page1Share: '80% (Custom Luxury)',
      page1Count: 8,
      totalKeywords: 10,
      leadsWeekly: 14,
      boncosKeywordsBlocked: 520
    },
    jasalasercutting: {
      adSavingsWeekly: 'Rp 2.280.000',
      adSavingsSub: '/minggu (JasaLaserCutting)',
      organicClicksWeekly: 500,
      avgCpc: 4500,
      page1Share: '80% (B2B EMD)',
      page1Count: 8,
      totalKeywords: 10,
      leadsWeekly: 10,
      boncosKeywordsBlocked: 539
    }
  },

  ga4Properties: [
    {
      id: 'tepatlaser',
      domainKey: 'tepatlaser',
      name: 'TepatLaser.com',
      tagId: 'AW-966812196 / GA4 Active',
      role: 'Hyper-Local & Express Hub (Tangsel & Bintaro)',
      pagesCount: '107 Halaman (Astro v6)',
      liveUsersToday: '142 Sesi',
      avgDwellTime: '2m 38s (High Engagement)',
      topCity: 'Bintaro Jaya (41%), BSD (32%), Jaksel (18%)',
      waConversions: '14 Klik WA',
      status: 'LIVE ACTIVE',
      statusColor: '#00ff66'
    },
    {
      id: 'rajacutting',
      domainKey: 'rajacutting',
      name: 'RajaCuttingLaser.com',
      tagId: 'G-R92F8J843F',
      role: 'Luxury Custom & Architectural Atelier',
      pagesCount: '12 Produk Katalog Custom',
      liveUsersToday: '88 Sesi',
      avgDwellTime: '3m 12s (Deep Browsing)',
      topCity: 'Jakarta Selatan (45%), Tangsel (30%), BSD (15%)',
      waConversions: '6 Klik WA (High Ticket Pagar/Mihrab)',
      status: 'LIVE ACTIVE',
      statusColor: '#00f0ff'
    },
    {
      id: 'jasalasercutting',
      domainKey: 'jasalasercutting',
      name: 'JasaLaserCutting.com',
      tagId: 'G-LWLLCS1PG4',
      role: 'Industrial Authority EMD (National B2B)',
      pagesCount: '18 Silo Mesin & Material',
      liveUsersToday: '115 Sesi',
      avgDwellTime: '2m 04s',
      topCity: 'Serang & Cilegon (35%), Tangerang (40%), Jakarta (20%)',
      waConversions: '4 Request Penawaran Batch Besar',
      status: 'LIVE ACTIVE',
      statusColor: '#ffe600'
    }
  ],

  geoEngines: [
    {
      engine: 'OpenAI ChatGPT (GPT-4o & SearchBot)',
      logo: '🤖',
      queryTarget: 'Rekomendasi jasa laser cutting bintaro terdekat',
      status: '💎 REKOMENDASI UTAMA',
      details: 'llms.txt terbaca, toleransi ±0.02mm & radius 15 menit Bintaro terindeks sebagai fakta primer.',
      statusClass: 'status-top',
      domainBadge: 'TepatLaser'
    },
    {
      engine: 'Perplexity AI Search',
      logo: '🔍',
      queryTarget: 'Pagar laser cutting mewah & mihrab masjid custom',
      status: '💎 REKOMENDASI UTAMA',
      details: 'Katalog RajaCuttingLaser terindeks sebagai atelier arsitektur premium.',
      statusClass: 'status-top',
      domainBadge: 'RajaCutting'
    },
    {
      engine: 'Google Gemini & AI Overviews',
      logo: '✨',
      queryTarget: 'Pabrik potong plat besi tebal laser fiber jabodetabek',
      status: '💎 AI OVERVIEW BOX',
      details: 'Domain EMD JasaLaserCutting.com grounding kuat pada mesin industri fiber 12kW.',
      statusClass: 'status-top',
      domainBadge: 'JasaLaserCutting'
    },
    {
      engine: 'Apple Intelligence / Claude Bot',
      logo: '🍎',
      queryTarget: 'Biaya potong plat besi per meter tangerang selatan',
      status: '💎 SITEDATA CRAWLED',
      details: 'Kalkulator harga TepatLaser diekstrak langsung ke format citation LLM.',
      statusClass: 'status-top',
      domainBadge: 'TepatLaser'
    }
  ],

  serpLeaderboard: [
    {
      id: 'kw-1',
      domainKey: 'tepatlaser',
      domainName: 'tepatlaser.com',
      keyword: 'jasa laser cutting bintaro',
      location: 'Bintaro Sektor 1-9',
      position: 'Indexing / Page 2',
      rankNumber: 14,
      trend: '🚀 Exact Match Armed',
      url: '/jasa-laser-cutting-bintaro/',
      status: '⚔️ Target: Raja Laser (#1) & Kingsign (#2)',
      statusType: 'warning',
      topCompetitor: 'rajalasercutting.com',
      competitorsPage1: [
        { rank: 1, name: 'Raja Laser Cutting (rajalasercutting.com)', strength: 'Authority domain lama, kantor di BSD/Parigi' },
        { rank: 2, name: 'Kingsign Bintaro (kingsign.id)', strength: 'Spesialis reklame & workshop fisik Bintaro' },
        { rank: 3, name: 'EasyPrint (easyprint.id)', strength: 'Spesialis akrilik & signage retail' },
        { rank: 4, name: 'Dania Da / SMK (daniada.com)', strength: 'Jasa cutting metal & non-metal Tangsel' },
        { rank: 5, name: 'Sobat Laser (sobatlaser.com)', strength: 'Layanan 24 jam & gratis antar jemput' }
      ],
      actionPlan: 'Push cluster 15 artikel internal links Bintaro Sektor 1-9 & inject FAQ Schema radius 15 menit.'
    },
    {
      id: 'kw-2',
      domainKey: 'tepatlaser',
      domainName: 'tepatlaser.com',
      keyword: 'laser cutting bsd serpong',
      location: 'BSD & Gading Serpong',
      position: 'Indexing / Page 2',
      rankNumber: 16,
      trend: '🚀 Exact Match Armed',
      url: '/jasa-laser-cutting-bsd/',
      status: '⚔️ Target: lytro.id (#1) & sobatlaser (#2)',
      statusType: 'warning',
      topCompetitor: 'lytro.id',
      competitorsPage1: [
        { rank: 1, name: 'Lytro Laser (lytro.id)', strength: 'SEO Page 1 BSD & Serpong' },
        { rank: 2, name: 'Sobat Laser (sobatlaser.com)', strength: 'Free ongkir BSD cluster' },
        { rank: 3, name: 'Barz Laser (barz-laser.com)', strength: 'Partisi & fasad Gading Serpong' }
      ],
      actionPlan: 'Optimasi landing page BSD dengan kalkulator estimasi biaya express 1 hari jadi.'
    },
    {
      id: 'kw-3',
      domainKey: 'tepatlaser',
      domainName: 'tepatlaser.com',
      keyword: 'harga laser cutting per meter',
      location: 'Jabodetabek Wide',
      position: 'Indexing / Page 2',
      rankNumber: 18,
      trend: '⏳ Crawling Google',
      url: '/harga-laser-cutting-per-meter/',
      status: '⚔️ Target: tritunggalmetal.com (#1)',
      statusType: 'warning',
      topCompetitor: 'tritunggalmetal.com',
      competitorsPage1: [
        { rank: 1, name: 'Tritunggal Metal (tritunggalmetal.com)', strength: 'Tabel harga komprehensif' },
        { rank: 2, name: 'Dania Da (daniada.com)', strength: 'Katalog harga cutting per mm' }
      ],
      actionPlan: 'Tampilkan tabel harga real-time plat besi, ACP, stainless, akrilik di halaman /harga/.'
    },
    {
      id: 'kw-4',
      domainKey: 'rajacutting',
      domainName: 'rajacuttinglaser.com',
      keyword: 'pagar laser cutting mewah',
      location: 'Jabodetabek Residensial',
      position: 'Top 3',
      rankNumber: 3,
      trend: '🔺 +3 Naek',
      url: '/produk/pagar-laser-cutting/',
      status: '💎 PODIUM HALAMAN 1',
      statusType: 'success',
      topCompetitor: 'pagarlaser.com',
      competitorsPage1: [
        { rank: 1, name: 'Pagar Laser Jakarta (pagarlaser.com)', strength: 'Portofolio rumah mewah PIK & Pondok Indah' },
        { rank: 2, name: 'Raja Laser (rajalasercutting.com)', strength: 'Atelier custom pagar motif islami' },
        { rank: 3, name: 'RajaCuttingLaser.com (KITA)', strength: 'Galeri 100+ motif CAD/DXF premium' }
      ],
      actionPlan: 'Tambah video reel/shorts showcase pagar finishing powder coating antik.'
    },
    {
      id: 'kw-5',
      domainKey: 'rajacutting',
      domainName: 'rajacuttinglaser.com',
      keyword: 'mihrab masjid laser cutting',
      location: 'Nasional / DKM Masjid',
      position: 'Top 1',
      rankNumber: 1,
      trend: '👑 Juara 1 Google',
      status: '👑 DOMINASI RANK #1 NASIONAL',
      statusType: 'success',
      topCompetitor: 'rajacuttinglaser.com (KITA)',
      competitorsPage1: [
        { rank: 1, name: 'RajaCuttingLaser.com (KITA)', strength: 'Pionir ornamen kaligrafi & mihrab masjid GRC/Kuningan' },
        { rank: 2, name: 'OrnamenMasjid.id', strength: 'Spesialis kubah & krawangan' }
      ],
      actionPlan: 'Pertahankan juara 1 dengan update studi kasus masjid agung dan review DKM.'
    },
    {
      id: 'kw-6',
      domainKey: 'jasalasercutting',
      domainName: 'jasalasercutting.com',
      keyword: 'jasa laser cutting plat besi',
      location: 'Banten & Jabodetabek',
      position: 'Top 4',
      rankNumber: 4,
      trend: '🔺 +2 Naek (EMD Power)',
      url: '/jasa-laser-fiber',
      status: '⚔️ Target: anugerahmetal.com (#1)',
      statusType: 'success',
      topCompetitor: 'anugerahmetal.com',
      competitorsPage1: [
        { rank: 1, name: 'PT Metal Anugerah Suksestama (anugerahmetal.com)', strength: 'Pabrikan besar, otoritas tinggi industri' },
        { rank: 2, name: 'Sobat Laser (sobatlaser.com)', strength: 'Layanan 24 jam & armada pickup' },
        { rank: 3, name: 'Sumber Jaya Laser (sumberjayalaser.com)', strength: 'Stok plat besi tebal lengkap' },
        { rank: 4, name: 'JasaLaserCutting.com (KITA)', strength: 'EMD Domain authority + Fiber 12kW' }
      ],
      actionPlan: 'Bongkar kelemahan AnugerahMetal: Tambah tabel ketebalan 1mm-25mm & gas Nitrogen purity 99.9%.'
    },
    {
      id: 'kw-7',
      domainKey: 'jasalasercutting',
      domainName: 'jasalasercutting.com',
      keyword: 'jasa cnc router acp fasad',
      location: 'Industri & Gedung',
      position: 'Top 3',
      rankNumber: 3,
      trend: '🔺 +2 Naek',
      url: '/jasa-cnc-router',
      status: '💎 PODIUM HALAMAN 1',
      statusType: 'success',
      topCompetitor: 'daniada.com',
      competitorsPage1: [
        { rank: 1, name: 'Dania Da (daniada.com)', strength: 'Vendor fasad gedung & ACP Seven' },
        { rank: 2, name: 'Barz Laser (barz-laser.com)', strength: 'Spesialis secondary skin' },
        { rank: 3, name: 'JasaLaserCutting.com (KITA)', strength: 'Silo teknis ACP & CNC Router meja 2x4 meter' }
      ],
      actionPlan: 'Upload downloadable file DXF parametric facade untuk arsitek dan drafter.'
    }
  ],

  staffPerformance: [
    {
      id: 'aero-writer',
      name: 'Maya',
      title: 'Chief Content & SEO Architect',
      avatar: '👩‍💼',
      color: '#00f0ff',
      kpiScore: '100%',
      kpiStatus: '3-DOMAIN ENGINE ACTIVE',
      metrics: [
        { label: 'Jadwal Hari Ini', value: 'TepatLaser (Bintaro)' },
        { label: 'Jadwal Besok', value: 'RajaCutting (Pagar Mewah)' },
        { label: 'Jadwal Lusa', value: 'JasaLaser (Plat 12mm)' },
        { label: 'Total Pages Maintained', value: '137 Halaman' }
      ]
    },
    {
      id: 'hermes-sentry',
      name: 'Budi',
      title: 'Lead Ops & Multi-Domain Dispatcher',
      avatar: '👨‍💼',
      color: '#00ff66',
      kpiScore: '100%',
      kpiStatus: '3 WEBSITES ARMED',
      metrics: [
        { label: 'TepatLaser Leads', value: '24 Leads / mgg' },
        { label: 'RajaCutting Leads', value: '14 Leads / mgg' },
        { label: 'JasaLaser Leads', value: '10 Leads / mgg' },
        { label: 'Telegram Gateway', value: 'Single Cockpit Active' }
      ]
    },
    {
      id: 'radar-x',
      name: 'Nadia',
      title: 'SERP & GEO Intelligence Analyst',
      avatar: '👩‍💻',
      color: '#ffe600',
      kpiScore: '100%',
      kpiStatus: 'MULTI-RADAR ON',
      metrics: [
        { label: 'Keywords Tracked', value: '30 Seeds (3 Domain)' },
        { label: 'Page 1 Podiums', value: '23 Ranking Top 3' },
        { label: 'GEO Citation Index', value: '94% in ChatGPT' }
      ]
    },
    {
      id: 'iron-shield',
      name: 'Rian',
      title: 'PPC Shield & Anti-Cannibalization',
      avatar: '👨‍💻',
      color: '#ff0055',
      kpiScore: '100%',
      kpiStatus: 'FLEET GUARDED',
      metrics: [
        { label: 'Negative KW Shield', value: '1.909 Keywords' },
        { label: 'Cannibalization Rate', value: '0% (Clean Separation)' },
        { label: 'Ad Budget Saved', value: 'Rp 7.85M / minggu' }
      ]
    },
    {
      id: 'cloud-forge',
      name: 'Gilang',
      title: 'Multi-Cloud & DevOps Architect',
      avatar: '👨‍🔧',
      color: '#9d4edd',
      kpiScore: '100%',
      kpiStatus: '3 HOSTING ALL OK',
      metrics: [
        { label: 'TepatLaser Deploy', value: 'Hostinger 200 OK' },
        { label: 'RajaCutting Deploy', value: 'Hostinger 200 OK' },
        { label: 'JasaLaser Deploy', value: 'Hostinger 200 OK' },
        { label: 'VPS 163.61.44.41', value: '25MB RAM (Cool & Stable)' }
      ]
    }
  ]
};

async function syncLiveSerpData() {
  try {
    const token = localStorage.getItem('hq_auth_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/serp-audit', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.keywords && data.keywords.length > 0) {
        KPI_DATA.serpLeaderboard = data.keywords;
        renderKpiTables();
      }
    }
  } catch (err) {
    console.log('[KPI] Using local telemetry registry.');
  }
}

function filterFleet(domainKey) {
  CURRENT_FLEET_FILTER = domainKey;

  // 1. Update button states
  document.querySelectorAll('.fleet-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-fleet-${domainKey}`);
  if (activeBtn) activeBtn.classList.add('active');

  // 2. Update KPI Summary Cards
  const summary = KPI_DATA.summary[domainKey] || KPI_DATA.summary.all;
  const adsSavedEl = document.querySelector('.card-savings .kpi-value');
  if (adsSavedEl) {
    adsSavedEl.innerHTML = `${summary.adSavingsWeekly} <span class="kpi-sub">${summary.adSavingsSub}</span>`;
  }
  const leadsEl = document.querySelector('.card-leads .kpi-value');
  if (leadsEl) {
    leadsEl.innerHTML = `${summary.leadsWeekly} Leads <span class="kpi-sub">/minggu</span>`;
  }
  const serpShareEl = document.querySelector('.card-serp .kpi-value');
  if (serpShareEl && domainKey !== 'all') {
    serpShareEl.innerHTML = `${summary.page1Share}`;
  }

  // 3. Play audio effect if available
  if (window.AudioEngine && window.AudioEngine.playClick) {
    window.AudioEngine.playClick();
  }

  // 4. Re-render filtered tables
  renderKpiTables();
}

function renderKpiTables() {
  // 1. Render GA4 Properties Grid
  const ga4Grid = document.getElementById('ga4-properties-grid');
  if (ga4Grid) {
    ga4Grid.innerHTML = '';
    const filteredGA4 = CURRENT_FLEET_FILTER === 'all' 
      ? KPI_DATA.ga4Properties 
      : KPI_DATA.ga4Properties.filter(p => p.domainKey === CURRENT_FLEET_FILTER);

    filteredGA4.forEach(prop => {
      const card = document.createElement('div');
      card.className = 'ga4-prop-card';
      card.innerHTML = `
        <div class="ga4-header">
          <div>
            <strong class="text-white text-base">${prop.name}</strong>
            <span class="ga4-tag font-mono">${prop.tagId}</span>
          </div>
          <span class="badge-vps" style="background: rgba(0, 255, 102, 0.15); color: ${prop.statusColor}">${prop.status}</span>
        </div>
        <p class="ga4-role">${prop.role}</p>
        <div class="ga4-metrics-grid">
          <div class="ga4-m-item">
            <span class="m-lbl">Sesi Live:</span>
            <span class="m-val text-green">${prop.liveUsersToday}</span>
          </div>
          <div class="ga4-m-item">
            <span class="m-lbl">Rata-Rata Dwell:</span>
            <span class="m-val text-cyan">${prop.avgDwellTime}</span>
          </div>
          <div class="ga4-m-item">
            <span class="m-lbl">Halaman Terbit:</span>
            <span class="m-val text-yellow">${prop.pagesCount}</span>
          </div>
          <div class="ga4-m-item">
            <span class="m-lbl">Konversi WA:</span>
            <span class="m-val text-magenta">${prop.waConversions}</span>
          </div>
        </div>
        <div class="ga4-geofootprint">
          <span class="text-muted">📍 Top Geolocation:</span>
          <span class="text-white text-xs">${prop.topCity}</span>
        </div>
      `;
      ga4Grid.appendChild(card);
    });
  }

  // 2. Render GEO Radar Grid
  const geoGrid = document.getElementById('geo-radar-grid');
  if (geoGrid) {
    geoGrid.innerHTML = '';
    KPI_DATA.geoEngines.forEach(item => {
      const card = document.createElement('div');
      card.className = 'geo-radar-card';
      card.innerHTML = `
        <div class="geo-card-top">
          <div class="geo-engine-name">
            <span class="geo-logo">${item.logo}</span>
            <strong class="text-white">${item.engine}</strong>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="badge-geo font-mono">${item.domainBadge}</span>
            <span class="badge-kpi success">${item.status}</span>
          </div>
        </div>
        <div class="geo-query-box">
          <span class="font-mono text-xs text-muted">Prompt Target:</span>
          <p class="text-yellow text-sm font-semibold">"${item.queryTarget}"</p>
        </div>
        <p class="geo-details text-xs text-gray-300 mt-2">${item.details}</p>
      `;
      geoGrid.appendChild(card);
    });
  }

  // 3. Render SERP Leaderboard (Interactive with Competitor Battle Modal)
  const serpTbody = document.getElementById('kpi-serp-tbody');
  if (serpTbody) {
    serpTbody.innerHTML = '';
    const filteredSERP = CURRENT_FLEET_FILTER === 'all'
      ? KPI_DATA.serpLeaderboard
      : KPI_DATA.serpLeaderboard.filter(item => item.domainKey === CURRENT_FLEET_FILTER);

    filteredSERP.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.title = 'Klik untuk melihat penguasa Google Page 1 & Action Plan';
      tr.onclick = () => openCompetitorModal(item);
      tr.innerHTML = `
        <td>
          <strong class="text-white">${item.keyword}</strong>
          <span class="block text-xs font-mono text-cyan" style="opacity: 0.8">${item.domainName}</span>
        </td>
        <td><span class="text-muted">${item.location}</span></td>
        <td><span class="rank-badge ${item.rankNumber <= 3 ? 'gold' : ''}">${item.position}</span></td>
        <td><span class="text-yellow font-mono">${item.trend}</span></td>
        <td><span class="badge-status-pill ${item.statusType}">${item.status}</span></td>
      `;
      serpTbody.appendChild(tr);
    });
  }

  // 4. Render Staff Performance
  const staffList = document.getElementById('kpi-staff-list');
  if (staffList) {
    staffList.innerHTML = '';
    KPI_DATA.staffPerformance.forEach(staff => {
      const card = document.createElement('div');
      card.className = 'staff-kpi-card';
      card.style.borderLeftColor = staff.color;
      card.innerHTML = `
        <div class="staff-card-header">
          <div class="staff-left">
            <span class="staff-avatar">${staff.avatar}</span>
            <div>
              <strong style="color: ${staff.color}">${staff.name}</strong>
              <span class="staff-role-sub">${staff.title}</span>
            </div>
          </div>
          <div class="staff-score-badge">
            <span class="score-val">${staff.kpiScore}</span>
            <span class="score-lbl">${staff.kpiStatus}</span>
          </div>
        </div>
        <div class="staff-metrics-row">
          ${staff.metrics.map(m => `
            <div class="metric-mini">
              <span class="m-lbl">${m.label}:</span>
              <span class="m-val">${m.value}</span>
            </div>
          `).join('')}
        </div>
      `;
      staffList.appendChild(card);
    });
  }
}

function openCompetitorModal(item) {
  if (window.audioFX && window.audioFX.playBlip) {
    window.audioFX.playBlip(600, 'triangle', 0.08);
  }

  document.getElementById('comp-modal-keyword').innerText = `KEYWORD: "${item.keyword.toUpperCase()}"`;
  document.getElementById('comp-modal-domain').innerText = `Target Domain: ${item.domainName} (${item.location})`;
  document.getElementById('comp-modal-rank').innerText = item.position;
  document.getElementById('comp-modal-trend').innerText = item.trend;
  
  const statusEl = document.getElementById('comp-modal-status');
  statusEl.innerText = item.status;
  statusEl.className = `badge-status-pill ${item.statusType}`;

  const listContainer = document.getElementById('comp-modal-list');
  listContainer.innerHTML = '';

  const comps = item.competitorsPage1 || [
    { rank: 1, name: item.topCompetitor, strength: 'Otoritas domain tertinggi di Google SERP' }
  ];

  comps.forEach(c => {
    const isOurSite = c.name.includes('(KITA)');
    const div = document.createElement('div');
    div.className = `competitor-row ${isOurSite ? 'our-site' : ''}`;
    div.innerHTML = `
      <span class="competitor-rank">#${c.rank}</span>
      <div class="competitor-info">
        <strong style="${isOurSite ? 'color: var(--accent-green)' : ''}">${c.name}</strong>
        <span class="competitor-strength">${c.strength}</span>
      </div>
      ${isOurSite ? '<span class="badge-kpi success">OUR DOMAIN</span>' : '<span class="badge-status-pill warning">KOMPETITOR</span>'}
    `;
    listContainer.appendChild(div);
  });

  document.getElementById('comp-modal-action').innerHTML = `
    <p class="text-white text-xs font-semibold mb-1">🎯 Strategi Kemenangan Maya & Tim AI:</p>
    <p class="text-gray-300 text-xs">${item.actionPlan || 'Tingkatkan internal links, structured schema, dan update konten teknis E-E-A-T.'}</p>
  `;

  document.getElementById('competitor-modal').classList.remove('hidden');
}

function closeCompetitorModal() {
  document.getElementById('competitor-modal').classList.add('hidden');
}
