/* ═══════════════════════════════════════════════════════════════
   AI Chat → Open WebUI Importer  —  content.js  v2.2
   Platforms : Perplexity · ChatGPT · Google Gemini · Claude
   ═══════════════════════════════════════════════════════════════ */

/* ─── Platform Detection ─── */
const PLATFORM = (() => {
  const h = location.hostname;
  if (h.includes('perplexity.ai'))                           return 'perplexity';
  if (h.includes('chatgpt.com') || h.includes('openai.com')) return 'chatgpt';
  if (h.includes('gemini.google.com'))                       return 'gemini';
  if (h.includes('claude.ai'))                               return 'claude';
  return null;
})();

/* ─── UUID Helper ─── */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ═══════════════════════════════════════════════════════════════
   OVERLAY — blocks all interaction while auto-scroll runs
   ═══════════════════════════════════════════════════════════════ */

let _overlay = null;

function showOverlay(statusText) {
  if (_overlay) { updateOverlay(statusText); return; }

  _overlay = document.createElement('div');
  _overlay.id = 'owui-overlay';
  _overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(3px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    pointer-events: all;
    cursor: not-allowed;
  `;

  /* Spinner */
  const spinner = document.createElement('div');
  spinner.id = 'owui-spinner';
  spinner.style.cssText = `
    width: 52px; height: 52px;
    border: 4px solid rgba(255,255,255,0.15);
    border-top-color: #10b981;
    border-radius: 50%;
    animation: owui-spin 0.8s linear infinite;
  `;

  /* inject keyframes once */
  if (!document.getElementById('owui-keyframes')) {
    const style = document.createElement('style');
    style.id = 'owui-keyframes';
    style.textContent = `@keyframes owui-spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  /* Status label */
  const label = document.createElement('div');
  label.id = 'owui-overlay-label';
  label.style.cssText = `
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    max-width: 320px;
    line-height: 1.5;
  `;
  label.textContent = statusText || 'Loading all messages…';

  /* Sub-label */
  const sub = document.createElement('div');
  sub.style.cssText = `
    color: rgba(255,255,255,0.45);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 12px;
    text-align: center;
  `;
  sub.textContent = 'Please wait — do not click or scroll';

  _overlay.appendChild(spinner);
  _overlay.appendChild(label);
  _overlay.appendChild(sub);
  document.body.appendChild(_overlay);
}

function updateOverlay(text) {
  const el = document.getElementById('owui-overlay-label');
  if (el) el.textContent = text;
}

function hideOverlay() {
  if (_overlay) { _overlay.remove(); _overlay = null; }
}

/* ─── HTML → Markdown (shared) ─── */
function htmlToMarkdown(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = node.tagName.toLowerCase();
  const inner = () => Array.from(node.childNodes).map(htmlToMarkdown).join('');
  switch (tag) {
    case 'h1': return `# ${inner().trim()}\n\n`;
    case 'h2': return `## ${inner().trim()}\n\n`;
    case 'h3': return `### ${inner().trim()}\n\n`;
    case 'h4': return `#### ${inner().trim()}\n\n`;
    case 'h5': return `##### ${inner().trim()}\n\n`;
    case 'h6': return `###### ${inner().trim()}\n\n`;
    case 'strong': case 'b': return `**${inner()}**`;
    case 'em':     case 'i': return `*${inner()}*`;
    case 'del':    case 's': return `~~${inner()}~~`;
    case 'mark': return `==${inner()}==`;
    case 'sub':  return `~${inner()}~`;
    case 'sup': {
      const sc = inner().trim();
      if (/^\[\d+\]$/.test(sc)) return sc;
      return sc ? `^${sc}^` : '';
    }
    case 'a': {
      const href = node.getAttribute('href') || '';
      const text = inner().trim();
      if (/^\d+$/.test(text) && href.startsWith('http')) return `[${text}]`;
      const stripped = text.replace(/^\./, '');
      if (stripped.length >= 3 && stripped.length <= 10 && /^[a-z0-9]+$/.test(stripped)) return '';
      if (!text.includes(' ') && text.includes('.') && /^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/.test(text)) return '';
      return href ? `[${text}](${href})` : text;
    }
    case 'img': {
      const alt = node.getAttribute('alt') || '';
      const src = node.getAttribute('src') || '';
      return `![${alt}](${src})`;
    }
    case 'code': {
      if (node.parentElement?.tagName.toLowerCase() === 'pre') return node.textContent;
      return `\`${node.textContent}\``;
    }
    case 'pre': {
      const codeEl = node.querySelector('code');
      const rawCode = codeEl ? codeEl.textContent : node.textContent;
      const lang = ((codeEl?.className || '').match(/(?:language|lang)-(\w+)/) || [])[1] || '';
      return `\`\`\`${lang}\n${rawCode.trimEnd()}\n\`\`\`\n\n`;
    }
    case 'ul': {
      const items = Array.from(node.children)
        .filter(el => el.tagName.toLowerCase() === 'li')
        .map(li => `- ${htmlToMarkdown(li).trim()}`).join('\n');
      return items + '\n\n';
    }
    case 'ol': {
      const items = Array.from(node.children)
        .filter(el => el.tagName.toLowerCase() === 'li')
        .map((li, i) => `${i + 1}. ${htmlToMarkdown(li).trim()}`).join('\n');
      return items + '\n\n';
    }
    case 'li': return inner();
    case 'blockquote':
      return inner().trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
    case 'table': {
      const rows = Array.from(node.querySelectorAll('tr'));
      if (!rows.length) return inner();
      let md = '';
      rows.forEach((row, ri) => {
        const cells = Array.from(row.querySelectorAll('th,td'))
          .map(c => c.innerText.trim().replace(/\|/g, '\\|'));
        md += '| ' + cells.join(' | ') + ' |\n';
        if (ri === 0) md += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
      });
      return md + '\n';
    }
    case 'br': return '\n';
    case 'hr': return '\n---\n\n';
    case 'p': { const t = inner().trim(); return t ? `${t}\n\n` : ''; }
    case 'div': case 'section': case 'article': case 'main':
    case 'aside': case 'header': case 'footer': case 'figure': case 'figcaption':
      return inner();
    case 'script': case 'style': case 'noscript': case 'button': case 'svg': case 'nav':
      return '';
    default: return inner();
  }
}

function cleanMarkdown(md) {
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

/* ══════════════════════════════════════════════════════════
   PERPLEXITY SCRAPER
   ══════════════════════════════════════════════════════════ */

/**
 * Scrolls the page from top → bottom in chunks so Perplexity's
 * virtual DOM mounts every chat turn. Updates the overlay label
 * with a live step counter so the user knows progress.
 */
async function scrollToLoadAll() {
  /* Try the inner scrollable thread container first, fall back to window */
  const container =
    document.querySelector('[class*="thread"], [class*="conversation"], main') ||
    document.documentElement;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ── Step 1: jump to very top to mount oldest messages ── */
  updateOverlay('📜 Scrolling to top to load oldest messages…');
  container.scrollTo({ top: 0, behavior: 'smooth' });
  await sleep(1400);

  /* ── Step 2: scroll down in 10 equal steps ── */
  const STEPS = 10;
  for (let step = 1; step <= STEPS; step++) {
    /* Re-read scrollHeight every iteration — it can grow as new turns mount */
    const pos = Math.ceil((container.scrollHeight / STEPS) * step);
    updateOverlay(`📜 Loading messages… (${step}/${STEPS})`);
    container.scrollTo({ top: pos, behavior: 'smooth' });
    await sleep(700);
  }

  /* ── Step 3: land at absolute bottom and give a final settle ── */
  updateOverlay('⏳ Finalising…');
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  await sleep(900);
}

/** Click every "Show More" button inside user messages */
async function expandAllShowMore() {
  updateOverlay('🔍 Expanding collapsed messages…');
  const btns = Array.from(document.querySelectorAll('button'))
    .filter(b => /^show\s*more$/i.test(b.innerText.trim()));
  for (const b of btns) {
    b.click();
    await new Promise(r => setTimeout(r, 80));
  }
}

function isPerplexityUIText(text) {
  const t = text.trim();
  return (
    /^reviewed?\s+\d+\s+sources?\.?$/i.test(t) ||
    /^\d+\s+sources?\.?$/i.test(t) ||
    /^searching(\.\.\.)?$/i.test(t) ||
    /^generating(\.\.\.)?$/i.test(t) ||
    /^thinking(\.\.\.)?$/i.test(t) ||
    /^sources?:?$/i.test(t) ||
    /^related$/i.test(t) ||
    /^answer$/i.test(t) ||
    /^pro search$/i.test(t) ||
    /^focus:/i.test(t) ||
    /^\d+\s+steps?\s+completed/i.test(t) ||
    /^(🚀|⬇|⏳|✅|❌)/.test(t) ||
    t.length < 4
  );
}

function findQueryBefore(proseEl) {
  let current = proseEl;
  for (let depth = 0; depth < 25; depth++) {
    const parent = current.parentElement;
    if (!parent || parent === document.body) break;
    let sib = current.previousElementSibling;
    while (sib) {
      if (sib.id === 'owui-btn-container')                               { sib = sib.previousElementSibling; continue; }
      if (sib.querySelector('.prose') || sib.classList.contains('prose')){ sib = sib.previousElementSibling; continue; }
      if (['BUTTON','NAV','SCRIPT','STYLE','SVG'].includes(sib.tagName)) { sib = sib.previousElementSibling; continue; }
      const text = sib.innerText?.trim() || '';
      if (isPerplexityUIText(text)) { sib = sib.previousElementSibling; continue; }
      if (text.length > 4 && text.length < 3000) return text;
      sib = sib.previousElementSibling;
    }
    current = parent;
  }
  return null;
}

function findSourcesNear(proseEl) {
  const sources = [];
  let current = proseEl;
  for (let depth = 0; depth < 10; depth++) {
    const parent = current.parentElement;
    if (!parent || parent === document.body) break;
    Array.from(parent.children).forEach(sib => {
      if (sib === proseEl) return;
      Array.from(sib.querySelectorAll('a[href]')).forEach(a => {
        const href  = a.href;
        const label = a.innerText.trim() || a.getAttribute('aria-label') || new URL(href).hostname;
        if (href?.startsWith('http') && !href.includes('perplexity.ai') &&
            label && !sources.find(s => s.url === href))
          sources.push({ name: label.slice(0, 80), url: href });
      });
    });
    if (sources.length) break;
    current = parent;
  }
  return sources;
}

function scrapeSearchQueriesNear(proseEl) {
  let current = proseEl;
  for (let depth = 0; depth < 20; depth++) {
    const parent = current.parentElement;
    if (!parent || parent === document.body) break;
    let sib = current.previousElementSibling;
    while (sib) {
      const qs = Array.from(sib.querySelectorAll('p.px-two'))
        .map(e => e.textContent.trim()).filter(t => t.length > 3 && t.includes(' '));
      if (qs.length) return qs.slice(0, 6);
      sib = sib.previousElementSibling;
    }
    current = parent;
  }
  return [];
}

async function scrapePerplexity() {
  await scrollToLoadAll();
  await expandAllShowMore();

  updateOverlay('🔄 Reading messages…');
  await new Promise(r => setTimeout(r, 200));

  const messages = [], now = Math.floor(Date.now() / 1000);
  let proseEls = Array.from(document.querySelectorAll('.prose'))
    .filter(el => el.innerText.trim().length >= 10 && !el.parentElement?.closest('.prose'));
  if (!proseEls.length) {
    const alt = document.querySelectorAll(
      '[data-testid="answer-text"], .answer-content, [class*="answerText"]');
    if (!alt.length) return null;
    proseEls = Array.from(alt);
  }

  const usedQueries = new Set();
  proseEls.forEach((prose, i) => {
    let q = findQueryBefore(prose);
    if (!q && i === 0) q = document.title.replace(/[-|] Perplexity.*$/i, '').trim();
    if (q && !usedQueries.has(q)) {
      usedQueries.add(q);
      messages.push({ id: generateUUID(), role: 'user', content: q, timestamp: now + i * 10 });
    }
    const sources = findSourcesNear(prose);
    const msg = {
      id: generateUUID(), role: 'assistant',
      content: cleanMarkdown(htmlToMarkdown(prose)),
      timestamp: now + i * 10 + 5, done: true
    };
    if (sources.length) {
      msg.sources = sources.map(s => ({
        source: { id: s.url, name: s.url, url: s.url },
        document: [s.name], metadata: [{ source: s.url }], distances: []
      }));
      const qs = scrapeSearchQueriesNear(prose);
      msg.statusHistory = [
        { done: true, action: 'web_search', description: 'Searched {{count}} sites',
          urls: sources.map(s => s.url), items: sources.map(s => ({ title: s.name, url: s.url })) },
        { done: true, action: 'sources_retrieved',
          description: `Retrieved ${sources.length} sources`, count: sources.length },
        ...(qs.length
          ? [{ done: true, action: 'web_search_queries_generated', description: 'Searching', queries: qs }]
          : [{ done: true, action: 'sources_retrieved',
               description: `Retrieved ${sources.length} sources`, count: sources.length }])
      ];
    }
    messages.push(msg);
  });
  return messages.length ? messages : null;
}

function scrapeModelPerplexity() {
  for (const sel of [
    '[data-testid="model-selector-button"]', '[data-testid="model-name"]',
    '.model-selector button', 'button[aria-label*="sonar" i]'
  ]) {
    const el = document.querySelector(sel);
    if (el) { const t = el.innerText.trim(); if (t.length > 0 && t.length < 60) return t; }
  }
  const kw = ['claude','gpt','sonar','gemini','llama','mistral','deepseek','o1','o3','turbo'];
  for (const el of Array.from(document.querySelectorAll('span,button,div')).filter(e => !e.children.length)) {
    const t = el.innerText.trim().toLowerCase();
    if (t.length > 2 && t.length < 60 && kw.some(k => t.includes(k))) return el.innerText.trim();
  }
  return 'perplexity-sonar';
}

/* ══════════════════════════════════════════════════════════
   CHATGPT SCRAPER
   ══════════════════════════════════════════════════════════ */

function scrapeChatGPT() {
  const messages = [], now = Math.floor(Date.now() / 1000);
  const turns = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn"]'));
  if (!turns.length) return null;
  turns.forEach((turn, i) => {
    const roleEl = turn.querySelector('[data-message-author-role]');
    if (!roleEl) return;
    const role = roleEl.getAttribute('data-message-author-role');
    let content = '';
    if (role === 'user') {
      content = (roleEl.querySelector('.whitespace-pre-wrap') || roleEl).innerText.trim();
    } else if (role === 'assistant') {
      const mdEl = roleEl.querySelector('.markdown, [class*="prose"]') || roleEl;
      content = cleanMarkdown(htmlToMarkdown(mdEl));
    }
    if (content) messages.push({
      id: generateUUID(), role: role === 'assistant' ? 'assistant' : 'user',
      content, timestamp: now + i * 10,
      ...(role === 'assistant' ? { done: true } : {})
    });
  });
  return messages.length ? messages : null;
}

function scrapeModelChatGPT() {
  for (const sel of [
    'button[data-testid="model-switcher-dropdown-button"]',
    '[data-testid="model-name"]',
    'button[aria-haspopup="menu"][class*="text-token"]',
  ]) {
    const el = document.querySelector(sel);
    if (el) { const t = el.innerText.trim(); if (t.length > 0 && t.length < 60) return t; }
  }
  const m = document.title.match(/GPT-[\w\d.]+|o\d[\w]*/i);
  return m ? m[0] : 'gpt-4o';
}

/* ══════════════════════════════════════════════════════════
   GEMINI SCRAPER
   ══════════════════════════════════════════════════════════ */

function scrapeGemini() {
  const messages = [], now = Math.floor(Date.now() / 1000);
  const userEls  = Array.from(document.querySelectorAll(
    'user-query, [data-test-id="query-text"], .user-query-container, [class*="user-query"]'));
  const modelEls = Array.from(document.querySelectorAll(
    'model-response, message-content, .response-container, [class*="response-container"]'));
  const len = Math.max(userEls.length, modelEls.length);
  for (let i = 0; i < len; i++) {
    const uEl = userEls[i], mEl = modelEls[i];
    if (uEl) {
      const text = uEl.innerText.trim();
      if (text) messages.push({ id: generateUUID(), role: 'user', content: text, timestamp: now + i * 20 });
    }
    if (mEl) {
      const mdEl = mEl.querySelector('.markdown-main-panel, .response-content, [class*="markdown"], .formatted-text') || mEl;
      const content = cleanMarkdown(htmlToMarkdown(mdEl));
      if (content) messages.push({ id: generateUUID(), role: 'assistant', content, timestamp: now + i * 20 + 5, done: true });
    }
  }
  return messages.length ? messages : null;
}

function scrapeModelGemini() {
  for (const sel of ['[data-test-id="model-selector"] button','button[aria-label*="Gemini" i]','[class*="model-name"]']) {
    const el = document.querySelector(sel);
    if (el) { const t = el.innerText.trim(); if (t.length > 0 && t.length < 80) return t; }
  }
  for (const el of Array.from(document.querySelectorAll('span,div,button')).filter(e => !e.children.length)) {
    const t = el.innerText.trim();
    if (/^gemini[\s\-]/i.test(t) && t.length < 40) return t;
  }
  return 'gemini';
}

/* ══════════════════════════════════════════════════════════
   CLAUDE SCRAPER
   ══════════════════════════════════════════════════════════ */

function scrapeClaude() {
  const messages = [], now = Math.floor(Date.now() / 1000);
  const userEls = Array.from(document.querySelectorAll(
    '[data-testid="user-message"], .human-turn, [class*="HumanMessage"]'));
  const aiEls   = Array.from(document.querySelectorAll(
    '[data-testid="assistant-message"], .ai-turn, [class*="AssistantMessage"], .font-claude-message'));
  const len = Math.max(userEls.length, aiEls.length);
  for (let i = 0; i < len; i++) {
    const uEl = userEls[i], aEl = aiEls[i];
    if (uEl) {
      const text = uEl.innerText.trim();
      if (text) messages.push({ id: generateUUID(), role: 'user', content: text, timestamp: now + i * 20 });
    }
    if (aEl) {
      const proseEl = aEl.querySelector('.prose, [class*="prose"], .markdown') || aEl;
      const content = cleanMarkdown(htmlToMarkdown(proseEl));
      if (content) messages.push({ id: generateUUID(), role: 'assistant', content, timestamp: now + i * 20 + 5, done: true });
    }
  }
  return messages.length ? messages : null;
}

function scrapeModelClaude() {
  for (const sel of ['[data-testid="model-selector"]','button[aria-label*="claude" i]','[class*="ModelName"]','header [class*="model"]']) {
    const el = document.querySelector(sel);
    if (el) { const t = el.innerText.trim(); if (t.length > 0 && t.length < 60) return t; }
  }
  for (const el of Array.from(document.querySelectorAll('span,div,button')).filter(e => !e.children.length)) {
    const t = el.innerText.trim();
    if (/^claude[\s\-]/i.test(t) && t.length < 40) return t;
  }
  return 'claude';
}

/* ══════════════════════════════════════════════════════════
   UNIFIED DISPATCHER
   ══════════════════════════════════════════════════════════ */

async function scrapeChat() {
  switch (PLATFORM) {
    case 'perplexity': return await scrapePerplexity();
    case 'chatgpt':    return scrapeChatGPT();
    case 'gemini':     return scrapeGemini();
    case 'claude':     return scrapeClaude();
    default:           return null;
  }
}

function scrapeModelName() {
  switch (PLATFORM) {
    case 'perplexity': return scrapeModelPerplexity();
    case 'chatgpt':    return scrapeModelChatGPT();
    case 'gemini':     return scrapeModelGemini();
    case 'claude':     return scrapeModelClaude();
    default:           return 'unknown-model';
  }
}

function buildExportData(messages) {
  const modelName = scrapeModelName();
  const title = document.title
    .replace(/[-|]\s*(Perplexity|ChatGPT|Gemini|Claude).*$/i, '').trim() || 'Imported Chat';
  const chat = {
    id: generateUUID(), title,
    timestamp: Math.floor(Date.now() / 1000),
    models: [modelName],
    messages: messages.map(msg => ({
      ...msg, ...(msg.role === 'assistant' ? { model: modelName } : {})
    }))
  };
  return { chat, modelName };
}

/* ══════════════════════════════════════════════════════════
   BUTTONS
   ══════════════════════════════════════════════════════════ */

async function exportChat() {
  showOverlay('📜 Preparing to load all messages…');
  btn.innerText = '⏳ Loading…';
  try {
    const messages = await scrapeChat();
    hideOverlay();
    if (!messages || !messages.length) {
      alert('❌ No messages found!\n\nMake sure the full conversation is visible on screen.');
      btn.innerText = '⬇ Download JSON';
      return;
    }
    const { chat, modelName } = buildExportData(messages);
    const blob = new Blob([JSON.stringify([chat], null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `owui-${PLATFORM}-${Date.now()}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    btn.innerText = `✅ ${messages.length} msgs · ${modelName}`;
    setTimeout(() => { btn.innerText = '⬇ Download JSON'; }, 3500);
  } catch (e) {
    hideOverlay();
    btn.innerText = '⬇ Download JSON';
    alert(`❌ Export error:\n${e.message}`);
  }
}

/* ── Container ── */
const container = document.createElement('div');
container.id = 'owui-btn-container';
container.style.cssText = `
  position:fixed; bottom:28px; right:28px; z-index:999999;
  display:flex; flex-direction:column; gap:9px; align-items:flex-end;
`;

/* ── 🚀 Send to Open WebUI ── */
const sendBtn = document.createElement('button');
sendBtn.id = 'owui-send-btn';
sendBtn.innerText = '🚀 Send to Open WebUI';
sendBtn.style.cssText = `
  background:linear-gradient(135deg,#059669,#10b981);color:#fff;
  border:none;border-radius:12px;padding:11px 18px;
  font-size:13px;font-weight:700;cursor:pointer;
  box-shadow:0 6px 20px rgba(16,185,129,.4);
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  transition:transform .15s ease;letter-spacing:.3px;white-space:nowrap;
`;
sendBtn.onmouseenter = () => sendBtn.style.transform = 'scale(1.06)';
sendBtn.onmouseleave = () => sendBtn.style.transform = 'scale(1)';
sendBtn.onclick = async () => {
  if (!chrome?.storage?.sync) {
    alert('⚠ Extension context lost.\nPlease refresh the page (F5) and try again.');
    return;
  }
  try {
    const { owuiDomain, owuiToken } = await chrome.storage.sync.get(['owuiDomain', 'owuiToken']);
    if (!owuiDomain || !owuiToken) {
      alert('⚠ Open WebUI URL or API token not set!\nClick the extension icon → ⚙️ Settings to configure.');
      return;
    }

    showOverlay('📜 Preparing to load all messages…');
    sendBtn.disabled = true;
    sendBtn.innerText = '⏳ Loading…';

    const messages = await scrapeChat();

    if (!messages || !messages.length) {
      hideOverlay();
      sendBtn.disabled = false;
      sendBtn.innerText = '🚀 Send to Open WebUI';
      alert('❌ No messages found. Make sure the full chat is visible.');
      return;
    }

    updateOverlay(`✅ Got ${messages.length} messages — sending to Open WebUI…`);
    sendBtn.innerText = '⏳ Sending…';
    const { chat } = buildExportData(messages);

    chrome.runtime.sendMessage(
      { action: 'importToOWUI', domain: owuiDomain, token: owuiToken, chat },
      (response) => {
        hideOverlay();
        sendBtn.disabled = false;
        if (response?.success) {
          sendBtn.innerText = `✅ Sent! (${messages.length} msgs)`;
        } else {
          sendBtn.innerText = '❌ Failed — see alert';
          alert(`Import failed:\n\n${response?.error || 'Unknown error'}`);
        }
        setTimeout(() => { sendBtn.innerText = '🚀 Send to Open WebUI'; }, 4000);
      }
    );
  } catch (err) {
    hideOverlay();
    sendBtn.disabled = false;
    sendBtn.innerText = '🚀 Send to Open WebUI';
    if (err.message?.includes('Extension context invalidated') ||
        err.message?.includes('Cannot read properties of undefined')) {
      alert('⚠ Extension disconnected.\nPlease refresh the page (F5) and try again.');
    } else {
      alert(`❌ Unexpected error:\n${err.message}`);
    }
  }
};

/* ── ⬇ Download JSON ── */
const btn = document.createElement('button');
btn.id = 'owui-export-btn';
btn.innerText = '⬇ Download JSON';
btn.style.cssText = `
  background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;
  border:none;border-radius:12px;padding:11px 18px;
  font-size:13px;font-weight:700;cursor:pointer;
  box-shadow:0 6px 20px rgba(99,102,241,.4);
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  transition:transform .15s ease;letter-spacing:.3px;white-space:nowrap;
`;
btn.onmouseenter = () => btn.style.transform = 'scale(1.06)';
btn.onmouseleave = () => btn.style.transform = 'scale(1)';
btn.onclick = exportChat;

container.appendChild(sendBtn);
container.appendChild(btn);

/* ── Inject on load + re-inject on SPA navigation ── */
const inject = () => {
  if (!PLATFORM) return;
  if (!document.getElementById('owui-btn-container')) document.body.appendChild(container);
};
if (document.readyState === 'complete') inject();
else window.addEventListener('load', inject);

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(inject, 1500); }
}).observe(document.body, { childList: true, subtree: true });
