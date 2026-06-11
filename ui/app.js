// Lightweight UI logic extended to group videos, channels, and playlists.
// - parse a dropped JSON file (array or object with items)
// - detect type per-item (video, channel, playlist, unknown)
// - group and render with filters and export options

const youtubeUrlInput = document.getElementById('youtubeUrl');
const recoverBtn = document.getElementById('recoverBtn');
const fileInput = document.getElementById('fileInput');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const exportVisibleBtn = document.getElementById('exportVisibleBtn');
const exportAllBtn = document.getElementById('exportAllBtn');
const filterButtons = Array.from(document.querySelectorAll('.filter'));

let allItems = []; // flat list of normalized items
let currentFilter = 'all';

function setStatus(text, isError=false){
  statusEl.textContent = text || '';
  statusEl.style.color = isError ? 'var(--danger)' : '';
}

function normalizeInput(input){
  // If root is an object with items array or similar, try to extract common arrays
  if (Array.isArray(input)) return input;
  if (input == null) return [];
  // look for common keys
  const possibilities = ['items', 'results', 'videos', 'channels', 'playlists'];
  for (const k of possibilities) {
    if (Array.isArray(input[k])) return input[k];
  }
  // otherwise return object itself as single item array
  return [input];
}

function detectType(item){
  // check common explicit fields
  if (!item) return 'unknown';
  const keys = Object.keys(item).map(k=>k.toLowerCase());
  if (item.videoId || item.videoID || /video/i.test(item.kind) || keys.includes('videoid')) return 'video';
  if (item.playlistId || /playlist/i.test(item.kind) || keys.includes('playlistid')) return 'playlist';
  if (item.channelId || /channel/i.test(item.kind) || keys.includes('channelid')) return 'channel';

  // try parsing urls
  const url = item.url || item.link || item.web || item.videoUrl;
  if (url && typeof url === 'string') {
    const parsed = parseYouTubeUrl(url);
    if (parsed.type) return parsed.type;
  }

  return 'unknown';
}

function parseYouTubeUrl(url){
  try {
    const u = new URL(url, 'https://example.com');
    const hostname = u.hostname.toLowerCase();
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) {
      // youtu.be short link -> video ID in pathname
      if (hostname.includes('youtu.be')) {
        const id = u.pathname.slice(1);
        if (id) return { type: 'video', id };
      }
      // /watch?v=...
      const v = u.searchParams.get('v');
      if (v) return { type: 'video', id: v };
      const list = u.searchParams.get('list');
      if (list) return { type: 'playlist', id: list };
      // /channel/ID or /c/NAME or /user/NAME
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'channel' && parts[1]) return { type: 'channel', id: parts[1] };
      // fallback: if path has playlist
      if (parts.includes('playlist') && u.searchParams.get('list')) return { type: 'playlist', id: u.searchParams.get('list') };
    }
  } catch (e) {
    // ignore
  }
  return {};
}

function normalizeItem(raw){
  const type = detectType(raw);
  // derive id and title
  let id = raw.videoId || raw.playlistId || raw.channelId || raw.id || raw.ID || raw.url || raw.link || '';
  if (typeof id === 'object') id = id.toString();
  // try parse id from url if not present
  if ((!id || id === '') && (raw.url || raw.link)) {
    const parsed = parseYouTubeUrl(raw.url || raw.link);
    if (parsed.id) id = parsed.id;
  }
  const title = raw.title || raw.name || raw.videoTitle || raw.channelTitle || raw.playlistTitle || '';
  return {
    raw,
    type,
    id: String(id || ''),
    title: String(title || '') || (raw.url ? raw.url : `Item`),
  };
}

function groupItems(items){
  const groups = { video: [], channel: [], playlist: [], unknown: [] };
  items.forEach(it => {
    const n = normalizeItem(it);
    groups[n.type] = groups[n.type] || [];
    groups[n.type].push(n);
  });
  return groups;
}

function renderGroups(groups){
  // update export buttons
  const total = Object.values(groups).reduce((s,a)=>s + a.length,0);
  exportAllBtn.disabled = total === 0;
  exportVisibleBtn.disabled = total === 0;

  resultsEl.innerHTML = '';
  if (total === 0) {
    resultsEl.textContent = 'No results yet.';
    return;
  }

  const order = ['video','channel','playlist','unknown'];
  order.forEach(type => {
    const list = groups[type];
    if (!list || list.length === 0) return;
    // apply filter
    if (currentFilter !== 'all' && currentFilter !== type) return;

    const grp = document.createElement('div');
    grp.className = 'group';
    grp.innerHTML = `<h3>${capitalize(type)}s (${list.length})</h3>`;
    list.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'item';
      const link = createYouTubeLink(item);
      itemEl.innerHTML = `
        <div class="meta">
          <div><strong>${escapeHtml(item.title)}</strong></div>
          <div class="kv">${escapeHtml(item.id)}</div>
          <div style="margin-top:6px;"><pre style="margin:0;white-space:pre-wrap;">${escapeHtml(JSON.stringify(item.raw, null, 2))}</pre></div>
        </div>
        <div class="actions">
          <button class="small-btn" data-link="${escapeHtml(link)}">Open</button>
          <button class="small-btn ghost" data-copy="${escapeHtml(link)}">Copy</button>
        </div>
      `;
      // attach action handlers
      itemEl.querySelector('[data-link]').addEventListener('click', (e) => {
        const href = e.currentTarget.getAttribute('data-link');
        window.open(href, '_blank', 'noopener');
      });
      itemEl.querySelector('[data-copy]').addEventListener('click', (e) => {
        const href = e.currentTarget.getAttribute('data-copy');
        navigator.clipboard?.writeText(href).then(()=> setStatus('Link copied to clipboard.')).catch(()=> setStatus('Failed to copy.', true));
      });
      grp.appendChild(itemEl);
    });
    resultsEl.appendChild(grp);
  });
}

function createYouTubeLink(item){
  if (!item || !item.type) return '';
  if (item.type === 'video') return `https://www.youtube.com/watch?v=${item.id}`;
  if (item.type === 'playlist') return `https://www.youtube.com/playlist?list=${item.id}`;
  if (item.type === 'channel') return `https://www.youtube.com/channel/${item.id}`;
  // fallback: try raw.url or raw.link
  return item.raw?.url || item.raw?.link || '';
}

function escapeHtml(s){
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function capitalize(s){ return s.slice(0,1).toUpperCase() + s.slice(1); }

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  setStatus(`Reading ${file.name}...`);
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const items = normalizeInput(json);
    allItems = items;
    const groups = groupItems(items);
    renderGroups(groups);
    setStatus(`Loaded ${file.name} (${items.length} items).`);
  } catch (err) {
    console.error(err);
    setStatus('Failed to parse JSON file.', true);
  }
});

recoverBtn.addEventListener('click', async () => {
  const url = youtubeUrlInput.value.trim();
  if (!url) { setStatus('Please enter a YouTube URL or drop a recovery JSON file.', true); return; }

  // If you have a backend, change endpoint below to your API (e.g., /api/recover)
  const endpoint = '/api/recover';

  setStatus('Attempting to recover from URL...');
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!resp.ok) {
      // fallback: local parse of the URL
      setStatus(`Backend returned ${resp.status}. Showing local parse.`);
      const parsed = parseYouTubeUrl(url);
      const localItem = parsed.id ? [{ id: parsed.id, url, type: parsed.type || 'unknown', title: url }] : [{ url, type: 'unknown', title: url }];
      allItems = localItem;
      renderGroups(groupItems(allItems));
      return;
    }

    const data = await resp.json();
    const items = normalizeInput(data);
    allItems = items;
    renderGroups(groupItems(items));
    setStatus('Recovered items from backend.');
  } catch (err) {
    console.warn('Fetch to backend failed, falling back to local parse', err);
    const parsed = parseYouTubeUrl(url);
    const localItem = parsed.id ? [{ id: parsed.id, url, type: parsed.type || 'unknown', title: url }] : [{ url, type: 'unknown', title: url }];
    allItems = localItem;
    renderGroups(groupItems(allItems));
    setStatus('No backend reachable — local parse shown.');
  }
});

exportVisibleBtn.addEventListener('click', () => {
  const groups = groupItems(allItems);
  const visible = [];
  Object.keys(groups).forEach(k => {
    if (currentFilter === 'all' || currentFilter === k) {
      visible.push(...groups[k]);
    }
  });
  doExport(visible, 'recovered-visible.json');
});

exportAllBtn.addEventListener('click', () => {
  const groups = groupItems(allItems);
  const all = Object.values(groups).flat();
  doExport(all, 'recovered-all.json');
});

function doExport(items, filename){
  if (!items || items.length === 0) { setStatus('No items to export.', true); return; }
  const blob = new Blob([JSON.stringify(items.map(i=>i.raw), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${items.length} items.`);
}

// Filters
filterButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterButtons.forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    currentFilter = e.currentTarget.getAttribute('data-filter');
    renderGroups(groupItems(allItems));
  });
});

// initial
setStatus('Ready. Paste a URL or drop a JSON file.');
