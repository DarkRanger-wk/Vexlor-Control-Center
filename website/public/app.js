const releaseTargets = document.querySelectorAll('[data-release]');
const statsTargets = document.querySelectorAll('[data-stat]');
const lastUpdatedNode = document.querySelector('[data-last-updated]');
const emptyStatsNode = document.querySelector('[data-empty-stats]');
const chartNode = document.querySelector('[data-usage-chart]');
const chartEmptyNode = document.querySelector('[data-chart-empty]');

function initializeRevealAnimations() {
  const targets = document.querySelectorAll(
    'main .section-header, main .feature-card, main .stat-card, main .download-panel, main .faq-item, main .changelog-item, main .info-card, main .legal-card, main .chart-panel, main .page-header, footer .footer-grid > div',
  );
  if (!targets.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  targets.forEach((element, index) => {
    element.classList.add('reveal-on-scroll');
    element.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
  });

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });

  targets.forEach((element) => observer.observe(element));
}

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

function cleanReleaseNotes(markdown) {
  return markdown
    .replace(/<[^>]*>/g, '')
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/, '')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/^\s{0,3}#{1,6}\s*/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/(\*\*|__|~~|`)/g, '')
      .trim())
    .filter((line) => line && !/^full changelog\b/i.test(line));
}

function localizeReleaseChange(change) {
  const translations = {
    'feat: publish vexlor website and opt-in telemetry': 'Vexlor-Website und optionale Telemetrie veröffentlicht',
    'fix: preserve install location during updates': 'Der Installationsort bleibt bei Updates erhalten',
    'feat: add screenshot and floating timer tools': 'Screenshot-Werkzeug und schwebendes Timer-Fenster hinzugefügt',
    'ci: automate github releases': 'GitHub-Veröffentlichungen automatisiert',
    'fix: disable implicit publishing during installer build': 'Unbeabsichtigte Veröffentlichung beim Erstellen des Installers deaktiviert',
  };
  return translations[change.toLowerCase()] || change;
}

function renderReleaseHistory(releases) {
  const container = document.querySelector('[data-release-history]');
  if (!container) return;
  container.replaceChildren();

  if (!releases.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Es sind noch keine veröffentlichten Changelogs vorhanden.';
    container.append(empty);
    return;
  }

  releases.forEach((release) => {
    const article = document.createElement('article');
    article.className = 'changelog-item';

    const version = document.createElement('span');
    version.className = 'badge';
    version.textContent = release.version;

    const heading = document.createElement('h2');
    heading.textContent = release.name || release.version;

    article.append(version, heading);
    if (release.publishedAt) {
      const date = document.createElement('time');
      date.className = 'release-date';
      date.dateTime = release.publishedAt;
      const parsedDate = new Date(release.publishedAt);
      date.textContent = Number.isNaN(parsedDate.getTime())
        ? ''
        : parsedDate.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
      if (date.textContent) article.append(date);
    }

    const notes = cleanReleaseNotes(release.notes || '');
    const changes = Array.isArray(release.changes)
      ? cleanReleaseNotes(release.changes.join('\n')).map(localizeReleaseChange)
      : [];
    const displayedNotes = notes.length ? notes : changes;
    if (displayedNotes.length) {
      const list = document.createElement('ul');
      list.className = 'release-notes';
      displayedNotes.forEach((note) => {
        const item = document.createElement('li');
        item.textContent = note;
        list.append(item);
      });
      article.append(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'section-copy';
      empty.textContent = 'Für diese Version wurden keine Änderungsnotizen veröffentlicht.';
      article.append(empty);
    }

    container.append(article);
  });
}

async function loadReleaseHistory() {
  const container = document.querySelector('[data-release-history]');
  if (!container) return;

  const savedHistoryPromise = fetch('/release-history.json')
    .then(async (response) => {
      if (!response.ok) throw new Error(`Saved release history unavailable (HTTP ${response.status})`);
      const releases = await response.json();
      if (!Array.isArray(releases)) throw new Error('Invalid saved release history');
      return releases;
    })
    .catch((error) => {
      console.warn('Saved release history unavailable:', error);
      return [];
    });

  try {
    const response = await fetch('/api/releases?history=2');
    if (!response.ok) throw new Error(`Release history unavailable (HTTP ${response.status})`);
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Invalid release history response');
    const savedReleases = await savedHistoryPromise;
    const savedByVersion = new Map(savedReleases.map((release) => [release.version, release]));
    renderReleaseHistory(releases.map((release) => {
      if (cleanReleaseNotes(release.notes || '').length) return release;
      const savedRelease = savedByVersion.get(release.version);
      return savedRelease ? { ...release, changes: savedRelease.changes } : release;
    }));
  } catch (error) {
    console.warn('Release history unavailable:', error);
    const releases = await savedHistoryPromise;
    if (releases.length) {
      renderReleaseHistory(releases);
    } else {
      container.replaceChildren();
      const message = document.createElement('p');
      message.className = 'empty-state';
      message.textContent = 'Die Changelogs sind momentan nicht erreichbar. Bitte versuche es später erneut.';
      container.append(message);
    }
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
      const notes = typeof release.notes === 'string' ? cleanReleaseNotes(release.notes).slice(0, 6) : [];
      for (const note of notes.length ? notes : ['Für dieses Release wurden keine Änderungsnotizen veröffentlicht.']) {
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

initializeRevealAnimations();
void loadLatestRelease();
void loadReleaseHistory();
void loadStats();
