/* ═══════════════════════════════════════════════════════════════
   AI Chat → Open WebUI Importer  —  content.js  v2.4
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

/* ─── UUID ─── */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ═══════════════════════════════════════════════════════════════
   OVERLAY
   ═══════════════════════════════════════════════════════════════ */
let _overlay = null;

function showOverlay(text) {
  if (_overlay) { updateOverlay(text); return; }
  _overlay = document.createElement('div');
  _overlay.id = 'owui-overlay';
  _overlay.style.cssText = `
    position:fixed;inset:0;z-index:2147483647;
    background:rgba(0,0,0,0.78);backdrop-filter:blur(4px);
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:16px;
    pointer-events:all;cursor:not-allowed;
  `;
  if (!document.getElementById('owui-kf')) {
    const s = document.createElement('style'); s.id='owui-kf';
    s.textContent = `@keyframes owui-spin{to{transform:rotate(360deg)}} @keyframes owui-pulse{0%,100%{opacity:.5}50%{opacity:1}}`;
    document.head.appendChild(s);
  }
  const spinner = document.createElement('div');
  spinner.style.cssText = `width:52px;height:52px;border:4px solid rgba(255,255,255,.1);border-top-color:#10b981;border-radius:50%;animation:owui-spin .75s linear infinite;`;
  const lbl = document.createElement('div'); lbl.id='owui-lbl';
  lbl.style.cssText = `color:#e2e8f0;font:700 15px/-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;max-width:340px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,sans-serif;`;
  lbl.textContent = text;
  const sub = document.createElement('div');
  sub.style.cssText = `color:rgba(255,255,255,.38);font:12px -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;animation:owui-pulse 2s ease-in-out infinite;`;
  sub.textContent = 'Please wait — do not touch the page';
  const track = document.createElement('div');
  track.style.cssText = `width:260px;height:5px;background:rgba(255,255,255,.1);border-radius:999px;overflow:hidden;margin-top:4px;`;
  const fill = document.createElement('div'); fill.id='owui-fill';
  fill.style.cssText = `height:100%;width:0%;background:linear-gradient(90deg,#059669,#10b981);border-radius:999px;transition:width .3s ease;`;
  track.appendChild(fill);
  _overlay.append(spinner,lbl,sub,track);
  document.body.appendChild(_overlay);
}
function updateOverlay(text, pct) {
  const l=document.getElementById('owui-lbl'); if(l) l.textContent=text;
  if(pct!==undefined){const f=document.getElementById('owui-fill');if(f)f.style.width=pct+'%';}
}
function hideOverlay(){if(_overlay){_overlay.remove();_overlay=null;}}

/* ═══════════════════════════════════════════════════════════════
   SMART SCROLL — finds the element that ACTUALLY scrolls

   Perplexity uses a deeply-nested overflow div as its scroll
   container.  We probe every ancestor of the first .prose node
   plus several known candidates, pick whichever one has a non-zero
   scrollHeight > clientHeight, and use that for ALL scroll calls.
   If nothing is found we fall back to window / document.body.
   ═══════════════════════════════════════════════════════════════ */

function findRealScrollContainer() {
  /* Walk up from the first prose/answer element */
  const anchor =
    document.querySelector('.prose, [data-testid="answer-text"], [class*="answerText"]');

  if (anchor) {
    let el = anchor.parentElement;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 10) {
        const style = getComputedStyle(el);
        if (['auto','scroll','overlay'].includes(style.overflowY)) return el;
      }
      el = el.parentElement;
    }
  }

  /* Fallback candidates */
  const candidates = [
    document.querySelector('[class*="thread"]'),
    document.querySelector('[class*="conversation"]'),
    document.querySelector('[class*="chat"]'),
    document.querySelector('main'),
    document.documentElement,
    document.body,
  ];
  for (const c of candidates) {
    if (c && c.scrollHeight > c.clientHeight + 10) return c;
  }
  return document.documentElement;
}

/* Scroll a specific container OR window, whichever is real */
function scrollTo(el, top) {
  if (el === document.documentElement || el === document.body) {
    window.scrollTo({ top, behavior: 'smooth' });
  } else {
    el.scrollTo({ top, behavior: 'smooth' });
  }
  /* belt-and-suspenders: also scroll window in case el wasn’t the right one */
  window.scrollTo({ top, behavior: 'smooth' });
}

function getScrollHeight(el) {
  return Math.max(el.scrollHeight, document.body.scrollHeight, document.documentElement.scrollHeight);
}

function countProseNodes() {
  return document.querySelectorAll('.prose,[data-testid="answer-text"],[class*="answerText"]').length;
}

async function doOnePass(el, passLabel, startPct, endPct, steps, delay) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  updateOverlay(`🔄 ${passLabel} — jumping to top…`, startPct);
  scrollTo(el, 0);
  await sleep(1400);   /* wait for top nodes to mount */

  for (let i = 1; i <= steps; i++) {
    const pct = Math.round(startPct + ((i / steps) * (endPct - startPct)));
    updateOverlay(`🔄 ${passLabel} — step ${i}/${steps}`, pct);
    const target = Math.ceil((getScrollHeight(el) / steps) * i);
    scrollTo(el, target);
    await sleep(delay);
  }

  /* hard-land at bottom */
  scrollTo(el, getScrollHeight(el));
  await sleep(900);
}

async function scrollToLoadAll() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const el = findRealScrollContainer();

  /* Pass 1 */
  await doOnePass(el, 'Pass 1/2', 2, 42, 14, 650);

  /* DOM stability check */
  updateOverlay('🔍 Checking DOM stability…', 44);
  const before = countProseNodes();
  await sleep(1300);
  const after  = countProseNodes();
  updateOverlay(
    after > before
      ? `⚠️ ${after - before} new blocks appeared — running pass 2…`
      : `✅ Stable: ${after} blocks — running confirmation pass…`,
    46
  );
  await sleep(500);

  /* Pass 2 */
  await doOnePass(el, 'Pass 2/2', 48, 84, 14, 580);

  /* Final settle at bottom, then back to top */
  updateOverlay('⏳ Settling…', 86);
  scrollTo(el, getScrollHeight(el));
  await sleep(1100);
  scrollTo(el, 0);
  await sleep(500);
}

/* ═══════════════════════════════════════════════════════════════
   HTML → MARKDOWN
   ═══════════════════════════════════════════════════════════════ */
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
    case 'sup': { const sc=inner().trim(); if(/^\[\d+\]$/.test(sc))return sc; return sc?`^${sc}^`:''; }
    case 'a': {
      const href=node.getAttribute('href')||'', text=inner().trim();
      if(/^\d+$/.test(text)&&href.startsWith('http')) return `[${text}]`;
      const s=text.replace(/^\./, '');
      if(s.length>=3&&s.length<=10&&/^[a-z0-9]+$/.test(s)) return '';
      if(!text.includes(' ')&&text.includes('.')&&/^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/.test(text)) return '';
      return href?`[${text}](${href})`:text;
    }
    case 'img': return `![${node.getAttribute('alt')||''}](${node.getAttribute('src')||''})`;
    case 'code': {
      if(node.parentElement?.tagName.toLowerCase()==='pre') return node.textContent;
      return `\`${node.textContent}\``;
    }
    case 'pre': {
      const c=node.querySelector('code'), raw=c?c.textContent:node.textContent;
      const lang=((c?.className||'').match(/(?:language|lang)-(\w+)/)||[])[1]||'';
      return `\`\`\`${lang}\n${raw.trimEnd()}\n\`\`\`\n\n`;
    }
    case 'ul': {
      const items=Array.from(node.children).filter(e=>e.tagName.toLowerCase()==='li').map(li=>`- ${htmlToMarkdown(li).trim()}`).join('\n');
      return items+'\n\n';
    }
    case 'ol': {
      const items=Array.from(node.children).filter(e=>e.tagName.toLowerCase()==='li').map((li,i)=>`${i+1}. ${htmlToMarkdown(li).trim()}`).join('\n');
      return items+'\n\n';
    }
    case 'li': return inner();
    case 'blockquote': return inner().trim().split('\n').map(l=>`> ${l}`).join('\n')+'\n\n';
    case 'table': {
      const rows=Array.from(node.querySelectorAll('tr')); if(!rows.length) return inner();
      let md='';
      rows.forEach((row,ri)=>{
        const cells=Array.from(row.querySelectorAll('th,td')).map(c=>c.innerText.trim().replace(/\|/g,'\\|'));
        md+='| '+cells.join(' | ')+' |\n';
        if(ri===0) md+='| '+cells.map(()=>'---').join(' | ')+' |\n';
      });
      return md+'\n';
    }
    case 'br': return '\n';
    case 'hr': return '\n---\n\n';
    case 'p': { const t=inner().trim(); return t?`${t}\n\n`:''; }
    case 'div':case 'section':case 'article':case 'main':
    case 'aside':case 'header':case 'footer':case 'figure':case 'figcaption': return inner();
    case 'script':case 'style':case 'noscript':case 'button':case 'svg':case 'nav': return '';
    default: return inner();
  }
}
function cleanMarkdown(md){return md.replace(/\n{3,}/g,'\n\n').trim();}

/* ═══════════════════════════════════════════════════════════════
   PERPLEXITY SCRAPER
   ═══════════════════════════════════════════════════════════════ */
async function expandAllShowMore() {
  updateOverlay('🔍 Expanding collapsed messages…', 89);
  const btns = Array.from(document.querySelectorAll('button'))
    .filter(b => /^show\s*more$/i.test(b.innerText.trim()));
  for (const b of btns) { b.click(); await new Promise(r=>setTimeout(r,80)); }
}

function isPerplexityUIText(t) {
  t = t.trim();
  return (/^reviewed?\s+\d+\s+sources?\.?$/i.test(t)||
    /^\d+\s+sources?\.?$/i.test(t)||/^searching(\.\.\.)?$/i.test(t)||
    /^generating(\.\.\.)?$/i.test(t)||/^thinking(\.\.\.)?$/i.test(t)||
    /^sources?:?$/i.test(t)||/^related$/i.test(t)||/^answer$/i.test(t)||
    /^pro search$/i.test(t)||/^focus:/i.test(t)||
    /^\d+\s+steps?\s+completed/i.test(t)||
    /^(🚀|⬇|⏳|✅|❌)/.test(t)||t.length<4);
}

function findQueryBefore(proseEl) {
  let cur = proseEl;
  for (let d=0;d<25;d++) {
    const par=cur.parentElement; if(!par||par===document.body) break;
    let sib=cur.previousElementSibling;
    while(sib){
      if(sib.id==='owui-btn-container'){sib=sib.previousElementSibling;continue;}
      if(sib.querySelector('.prose')||sib.classList.contains('prose')){sib=sib.previousElementSibling;continue;}
      if(['BUTTON','NAV','SCRIPT','STYLE','SVG'].includes(sib.tagName)){sib=sib.previousElementSibling;continue;}
      const text=sib.innerText?.trim()||'';
      if(isPerplexityUIText(text)){sib=sib.previousElementSibling;continue;}
      if(text.length>4&&text.length<3000) return text;
      sib=sib.previousElementSibling;
    }
    cur=par;
  }
  return null;
}

function findSourcesNear(proseEl) {
  const sources=[];
  let cur=proseEl;
  for(let d=0;d<10;d++){
    const par=cur.parentElement; if(!par||par===document.body) break;
    Array.from(par.children).forEach(sib=>{
      if(sib===proseEl) return;
      Array.from(sib.querySelectorAll('a[href]')).forEach(a=>{
        const href=a.href, label=a.innerText.trim()||a.getAttribute('aria-label')||new URL(href).hostname;
        if(href?.startsWith('http')&&!href.includes('perplexity.ai')&&label&&!sources.find(s=>s.url===href))
          sources.push({name:label.slice(0,80),url:href});
      });
    });
    if(sources.length) break;
    cur=par;
  }
  return sources;
}

function scrapeSearchQueriesNear(proseEl) {
  let cur=proseEl;
  for(let d=0;d<20;d++){
    const par=cur.parentElement; if(!par||par===document.body) break;
    let sib=cur.previousElementSibling;
    while(sib){
      const qs=Array.from(sib.querySelectorAll('p.px-two')).map(e=>e.textContent.trim()).filter(t=>t.length>3&&t.includes(' '));
      if(qs.length) return qs.slice(0,6);
      sib=sib.previousElementSibling;
    }
    cur=par;
  }
  return [];
}

async function scrapePerplexity() {
  await scrollToLoadAll();
  await expandAllShowMore();
  updateOverlay('🔄 Reading all messages…', 93);
  await new Promise(r=>setTimeout(r,300));

  const messages=[], now=Math.floor(Date.now()/1000);
  let proseEls=Array.from(document.querySelectorAll('.prose'))
    .filter(el=>el.innerText.trim().length>=10&&!el.parentElement?.closest('.prose'));
  if(!proseEls.length){
    const alt=document.querySelectorAll('[data-testid="answer-text"],.answer-content,[class*="answerText"]');
    if(!alt.length) return null;
    proseEls=Array.from(alt);
  }
  const usedQueries=new Set();
  proseEls.forEach((prose,i)=>{
    let q=findQueryBefore(prose);
    if(!q&&i===0) q=document.title.replace(/[-|] Perplexity.*$/i,'').trim();
    if(q&&!usedQueries.has(q)){
      usedQueries.add(q);
      messages.push({id:generateUUID(),role:'user',content:q,timestamp:now+i*10});
    }
    const sources=findSourcesNear(prose);
    const msg={id:generateUUID(),role:'assistant',content:cleanMarkdown(htmlToMarkdown(prose)),timestamp:now+i*10+5,done:true};
    if(sources.length){
      msg.sources=sources.map(s=>({source:{id:s.url,name:s.url,url:s.url},document:[s.name],metadata:[{source:s.url}],distances:[]}));
      const qs=scrapeSearchQueriesNear(prose);
      msg.statusHistory=[
        {done:true,action:'web_search',description:'Searched {{count}} sites',urls:sources.map(s=>s.url),items:sources.map(s=>({title:s.name,url:s.url}))},
        {done:true,action:'sources_retrieved',description:`Retrieved ${sources.length} sources`,count:sources.length},
        ...(qs.length?[{done:true,action:'web_search_queries_generated',description:'Searching',queries:qs}]
          :[{done:true,action:'sources_retrieved',description:`Retrieved ${sources.length} sources`,count:sources.length}])
      ];
    }
    messages.push(msg);
  });
  return messages.length?messages:null;
}

function scrapeModelPerplexity(){
  for(const sel of['[data-testid="model-selector-button"]','[data-testid="model-name"]','.model-selector button','button[aria-label*="sonar" i]']){
    const el=document.querySelector(sel); if(el){const t=el.innerText.trim();if(t.length>0&&t.length<60)return t;}
  }
  const kw=['claude','gpt','sonar','gemini','llama','mistral','deepseek','o1','o3','turbo'];
  for(const el of Array.from(document.querySelectorAll('span,button,div')).filter(e=>!e.children.length)){
    const t=el.innerText.trim().toLowerCase();
    if(t.length>2&&t.length<60&&kw.some(k=>t.includes(k))) return el.innerText.trim();
  }
  return 'perplexity-sonar';
}

/* ════════════════════ CHATGPT ════════════════════ */
function scrapeChatGPT(){
  const messages=[],now=Math.floor(Date.now()/1000);
  const turns=Array.from(document.querySelectorAll('article[data-testid^="conversation-turn"]'));
  if(!turns.length) return null;
  turns.forEach((turn,i)=>{
    const roleEl=turn.querySelector('[data-message-author-role]'); if(!roleEl) return;
    const role=roleEl.getAttribute('data-message-author-role');
    let content='';
    if(role==='user') content=(roleEl.querySelector('.whitespace-pre-wrap')||roleEl).innerText.trim();
    else if(role==='assistant'){const mdEl=roleEl.querySelector('.markdown,[class*="prose"]')||roleEl;content=cleanMarkdown(htmlToMarkdown(mdEl));}
    if(content) messages.push({id:generateUUID(),role:role==='assistant'?'assistant':'user',content,timestamp:now+i*10,...(role==='assistant'?{done:true}:{})});
  });
  return messages.length?messages:null;
}
function scrapeModelChatGPT(){
  for(const sel of['button[data-testid="model-switcher-dropdown-button"]','[data-testid="model-name"]','button[aria-haspopup="menu"][class*="text-token"]']){
    const el=document.querySelector(sel);if(el){const t=el.innerText.trim();if(t.length>0&&t.length<60)return t;}
  }
  const m=document.title.match(/GPT-[\w\d.]+|o\d[\w]*/i);return m?m[0]:'gpt-4o';
}

/* ════════════════════ GEMINI ════════════════════ */
function scrapeGemini(){
  const messages=[],now=Math.floor(Date.now()/1000);
  const userEls=Array.from(document.querySelectorAll('user-query,[data-test-id="query-text"],.user-query-container,[class*="user-query"]'));
  const modelEls=Array.from(document.querySelectorAll('model-response,message-content,.response-container,[class*="response-container"]'));
  const len=Math.max(userEls.length,modelEls.length);
  for(let i=0;i<len;i++){
    const uEl=userEls[i],mEl=modelEls[i];
    if(uEl){const text=uEl.innerText.trim();if(text)messages.push({id:generateUUID(),role:'user',content:text,timestamp:now+i*20});}
    if(mEl){const mdEl=mEl.querySelector('.markdown-main-panel,.response-content,[class*="markdown"],.formatted-text')||mEl;const content=cleanMarkdown(htmlToMarkdown(mdEl));if(content)messages.push({id:generateUUID(),role:'assistant',content,timestamp:now+i*20+5,done:true});}
  }
  return messages.length?messages:null;
}
function scrapeModelGemini(){
  for(const sel of['[data-test-id="model-selector"] button','button[aria-label*="Gemini" i]','[class*="model-name"]']){
    const el=document.querySelector(sel);if(el){const t=el.innerText.trim();if(t.length>0&&t.length<80)return t;}
  }
  for(const el of Array.from(document.querySelectorAll('span,div,button')).filter(e=>!e.children.length)){const t=el.innerText.trim();if(/^gemini[\s\-]/i.test(t)&&t.length<40)return t;}
  return 'gemini';
}

/* ════════════════════ CLAUDE ════════════════════ */
function scrapeClaude(){
  const messages=[],now=Math.floor(Date.now()/1000);
  const userEls=Array.from(document.querySelectorAll('[data-testid="user-message"],.human-turn,[class*="HumanMessage"]'));
  const aiEls=Array.from(document.querySelectorAll('[data-testid="assistant-message"],.ai-turn,[class*="AssistantMessage"],.font-claude-message'));
  const len=Math.max(userEls.length,aiEls.length);
  for(let i=0;i<len;i++){
    const uEl=userEls[i],aEl=aiEls[i];
    if(uEl){const text=uEl.innerText.trim();if(text)messages.push({id:generateUUID(),role:'user',content:text,timestamp:now+i*20});}
    if(aEl){const p=aEl.querySelector('.prose,[class*="prose"],.markdown')||aEl;const content=cleanMarkdown(htmlToMarkdown(p));if(content)messages.push({id:generateUUID(),role:'assistant',content,timestamp:now+i*20+5,done:true});}
  }
  return messages.length?messages:null;
}
function scrapeModelClaude(){
  for(const sel of['[data-testid="model-selector"]','button[aria-label*="claude" i]','[class*="ModelName"]','header [class*="model"]']){
    const el=document.querySelector(sel);if(el){const t=el.innerText.trim();if(t.length>0&&t.length<60)return t;}
  }
  for(const el of Array.from(document.querySelectorAll('span,div,button')).filter(e=>!e.children.length)){const t=el.innerText.trim();if(/^claude[\s\-]/i.test(t)&&t.length<40)return t;}
  return 'claude';
}

/* ════════════════════ DISPATCHER ════════════════════ */
async function scrapeChat(){
  switch(PLATFORM){
    case 'perplexity': return await scrapePerplexity();
    case 'chatgpt':    return scrapeChatGPT();
    case 'gemini':     return scrapeGemini();
    case 'claude':     return scrapeClaude();
    default:           return null;
  }
}
function scrapeModelName(){
  switch(PLATFORM){
    case 'perplexity': return scrapeModelPerplexity();
    case 'chatgpt':    return scrapeModelChatGPT();
    case 'gemini':     return scrapeModelGemini();
    case 'claude':     return scrapeModelClaude();
    default:           return 'unknown-model';
  }
}
function buildExportData(messages){
  const modelName=scrapeModelName();
  const title=document.title.replace(/[-|]\s*(Perplexity|ChatGPT|Gemini|Claude).*$/i,'').trim()||'Imported Chat';
  return{chat:{id:generateUUID(),title,timestamp:Math.floor(Date.now()/1000),models:[modelName],messages:messages.map(m=>({...m,...(m.role==='assistant'?{model:modelName}:{})}))},modelName};
}

/* ═══════════════════════════════════════════════════════════════
   BUTTONS
   ═══════════════════════════════════════════════════════════════ */
async function exportChat(){
  showOverlay('📜 Starting — ~30s for long chats…');
  btn.innerText='⏳ Loading…';
  try{
    const messages=await scrapeChat();
    updateOverlay(`✅ Found ${messages?.length??0} messages — saving file…`,98);
    await new Promise(r=>setTimeout(r,300));
    hideOverlay();
    if(!messages||!messages.length){alert('❌ No messages found!\n\nMake sure the full conversation is visible.');btn.innerText='⬇ Download JSON';return;}
    const{chat,modelName}=buildExportData(messages);
    const blob=new Blob([JSON.stringify([chat],null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`owui-${PLATFORM}-${Date.now()}.json`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    btn.innerText=`✅ ${messages.length} msgs · ${modelName}`;
    setTimeout(()=>{btn.innerText='⬇ Download JSON';},3500);
  }catch(e){hideOverlay();btn.innerText='⬇ Download JSON';alert(`❌ Export error:\n${e.message}`);}
}

const container=document.createElement('div');
container.id='owui-btn-container';
container.style.cssText=`position:fixed;bottom:28px;right:28px;z-index:999999;display:flex;flex-direction:column;gap:9px;align-items:flex-end;`;

const sendBtn=document.createElement('button');
sendBtn.id='owui-send-btn';
sendBtn.innerText='🚀 Send to Open WebUI';
sendBtn.style.cssText=`background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;border-radius:12px;padding:11px 18px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(16,185,129,.4);font-family:-apple-system,BlinkMacSystemFont,sans-serif;transition:transform .15s ease;letter-spacing:.3px;white-space:nowrap;`;
sendBtn.onmouseenter=()=>sendBtn.style.transform='scale(1.06)';
sendBtn.onmouseleave=()=>sendBtn.style.transform='scale(1)';
sendBtn.onclick=async()=>{
  if(!chrome?.storage?.sync){alert('⚠ Extension context lost.\nRefresh the page (F5) and try again.');return;}
  try{
    const{owuiDomain,owuiToken}=await chrome.storage.sync.get(['owuiDomain','owuiToken']);
    if(!owuiDomain||!owuiToken){alert('⚠ Open WebUI URL or API token not set!\nClick the extension icon → ⚙️ Settings.');return;}
    showOverlay('📜 Starting — ~30s for long chats…');
    sendBtn.disabled=true;sendBtn.innerText='⏳ Loading…';
    const messages=await scrapeChat();
    if(!messages||!messages.length){hideOverlay();sendBtn.disabled=false;sendBtn.innerText='🚀 Send to Open WebUI';alert('❌ No messages found.');return;}
    updateOverlay(`✅ Found ${messages.length} messages — sending…`,98);
    sendBtn.innerText='⏳ Sending…';
    const{chat}=buildExportData(messages);
    chrome.runtime.sendMessage({action:'importToOWUI',domain:owuiDomain,token:owuiToken,chat},(response)=>{
      hideOverlay();sendBtn.disabled=false;
      if(response?.success){sendBtn.innerText=`✅ Sent! (${messages.length} msgs)`;}
      else{sendBtn.innerText='❌ Failed — see alert';alert(`Import failed:\n\n${response?.error||'Unknown error'}`);}      
      setTimeout(()=>{sendBtn.innerText='🚀 Send to Open WebUI';},4000);
    });
  }catch(err){
    hideOverlay();sendBtn.disabled=false;sendBtn.innerText='🚀 Send to Open WebUI';
    if(err.message?.includes('Extension context invalidated')||err.message?.includes('Cannot read properties of undefined'))
      alert('⚠ Extension disconnected.\nRefresh the page (F5) and try again.');
    else alert(`❌ Unexpected error:\n${err.message}`);
  }
};

const btn=document.createElement('button');
btn.id='owui-export-btn';btn.innerText='⬇ Download JSON';
btn.style.cssText=`background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:12px;padding:11px 18px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(99,102,241,.4);font-family:-apple-system,BlinkMacSystemFont,sans-serif;transition:transform .15s ease;letter-spacing:.3px;white-space:nowrap;`;
btn.onmouseenter=()=>btn.style.transform='scale(1.06)';
btn.onmouseleave=()=>btn.style.transform='scale(1)';
btn.onclick=exportChat;

container.appendChild(sendBtn);
container.appendChild(btn);

const inject=()=>{if(!PLATFORM)return;if(!document.getElementById('owui-btn-container'))document.body.appendChild(container);};
if(document.readyState==='complete')inject();
else window.addEventListener('load',inject);

let lastUrl=location.href;
new MutationObserver(()=>{if(location.href!==lastUrl){lastUrl=location.href;setTimeout(inject,1500);}}).observe(document.body,{childList:true,subtree:true});
