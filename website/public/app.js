const releaseTargets = document.querySelectorAll('[data-release]');
const statsTargets = document.querySelectorAll('[data-stat]');
const lastUpdatedNode = document.querySelector('[data-last-updated]');
const emptyStatsNode = document.querySelector('[data-empty-stats]');
const chartNode = document.querySelector('[data-usage-chart]');
const chartEmptyNode = document.querySelector('[data-chart-empty]');

function formatNumber(value) {
  return Number(value).toLocaleString('de-DE');
}

function formatMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function animateCount(element, value) {
  const target = Number(value);
  const duration = 650;
  const start = performance.now();

  function tick(ts) {
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatNumber(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function renderChart(series, hasData) {
  if (!chartNode) return;
  chartNode.replaceChildren();
  if (chartEmptyNode) chartEmptyNode.classList.toggle('hidden', hasData);
  chartNode.classList.toggle('hidden', !hasData);
  if (!hasData) return;

  const maximum = Math.max(...series.map((item) => item.durationMinutes), 1);
  for (const item of series) {
    const column = document.createElement('div');
    column.className = 'usage-chart-item';
    const bar = document.createElement('div');
    bar.className = 'usage-chart-bar';
    bar.style.height = `${Math.max(4, (item.durationMinutes / maximum) * 170)}px`;
    bar.title = `${item.durationMinutes} Minuten · ${item.sessions} Sitzungen`;
    const value = document.createElement('span');
    value.textContent = `${item.durationMinutes}m`;
    const label = document.createElement('span');
    label.textContent = item.label;
    column.append(bar, value, label);
    chartNode.append(column);
  }
}

async function loadLatestRelease() {
  try {
    const response = await fetch('/api/release/latest');
    if (!response.ok) throw new Error(`Release data unavailable (HTTP ${response.status})`);
    const release = await response.json();

    releaseTargets.forEach((node) => {
      const attr = node.dataset.release;
      if (attr === 'version') node.textContent = release.version || 'Aktuell nicht verfügbar';
      if (attr === 'link') node.href = release.htmlUrl || 'https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases/latest';
      if (attr === 'installer') node.href = release.installer?.url || release.htmlUrl || 'https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases/latest';
      if (attr === 'name') node.textContent = release.installer?.name || 'Windows Installer';
    });

    const changelogNode = document.querySelector('[data-changelog]');
    if (changelogNode) {
      changelogNode.replaceChildren();
      const notes = typeof release.notes === 'string' ? release.notes.split(/\r?\n/).filter(Boolean).slice(0, 6) : [];
      for (const note of notes.length ? notes : ['Für dieses Release sind keine Notizen hinterlegt.']) {
        const item = document.createElement('li');
        item.textContent = note.replace(/^\s*[#*-]+\s*/, '');
        changelogNode.append(item);
      }
    }
  } catch (error) {
    releaseTargets.forEach((node) => {
      if (node.dataset.release === 'version') node.textContent = 'Aktuell nicht verfügbar';
    });
    console.warn('Release information unavailable:', error);
  }
}

async function loadStats(period = 'day') {
  if (!statsTargets.length && !chartNode) return;
  try {
    const response = await fetch(`/api/stats?period=${encodeURIComponent(period)}`);
    if (!response.ok) throw new Error(`Stats unavailable (HTTP ${response.status})`);
    const data = await response.json();
    const hasData = data.isReady === true;
    if (emptyStatsNode) emptyStatsNode.classList.toggle('hidden', hasData);

    const values = {
      totalInstallations: data.totalInstallations,
      activeUsers: data.activeUsers,
      currentUsers: data.currentUsers,
      usersToday: data.usersToday,
      avgDailyUsageMinutes: data.avgDailyUsageMinutes,
      avgSessionMinutes: data.avgSessionMinutes,
      totalTrackedHours: data.totalTrackedHours,
      avgUsagePerUserMinutes: data.avgUsagePerUserMinutes,
    };

    statsTargets.forEach((node) => {
      const key = node.dataset.stat;
      const value = values[key];
      if (!hasData || value === null || value === undefined || !Number.isFinite(Number(value))) {
        node.textContent = '—';
      } else if (['avgDailyUsageMinutes', 'avgSessionMinutes', 'avgUsagePerUserMinutes'].includes(key)) {
        node.textContent = formatMinutes(value);
      } else if (key === 'totalTrackedHours') {
        node.textContent = `${Number(value).toFixed(1)} h`;
      } else {
        animateCount(node, value);
      }
    });

    if (lastUpdatedNode) {
      lastUpdatedNode.textContent = data.lastUpdated
        ? new Date(data.lastUpdated).toLocaleString('de-DE')
        : 'Noch keine Daten';
    }
    renderChart(Array.isArray(data.series) ? data.series : [], hasData && Array.isArray(data.series) && data.series.length > 0);
  } catch (error) {
    console.warn('Stats unavailable:', error);
    statsTargets.forEach((node) => { node.textContent = '—'; });
    if (emptyStatsNode) {
      emptyStatsNode.textContent = 'Statistiken sind momentan nicht erreichbar.';
      emptyStatsNode.classList.remove('hidden');
    }
    if (lastUpdatedNode) lastUpdatedNode.textContent = 'Nicht verfügbar';
    renderChart([], false);
  }
}

document.querySelectorAll('[data-period]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-period]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    void loadStats(button.dataset.period);
  });
});

void loadLatestRelease();
void loadStats();
