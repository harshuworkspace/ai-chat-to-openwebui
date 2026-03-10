/* ─── Tab Switching ─── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

/* ─── Load Saved Settings ─── */
chrome.storage.sync.get(['owuiDomain', 'owuiToken'], (data) => {
  if (data.owuiDomain) {
    document.getElementById('owuiDomain').value = data.owuiDomain;
    updateDomainPreview(data.owuiDomain);
  }
  if (data.owuiToken) {
    document.getElementById('owuiToken').value = data.owuiToken;
  }
});

/* ─── Domain Preview ─── */
function updateDomainPreview(val) {
  const el = document.getElementById('domainPreview');
  try {
    const url = new URL(val);
    el.textContent = `✅ ${url.hostname}`;
    el.className = 'domain-preview valid';
  } catch {
    el.textContent = val ? '⚠ Invalid URL' : 'Enter your Open WebUI URL above';
    el.className = 'domain-preview';
  }
}

document.getElementById('owuiDomain').addEventListener('input', e => {
  updateDomainPreview(e.target.value.trim());
});

/* ─── Toggle Token Visibility ─── */
document.getElementById('toggleToken').addEventListener('click', () => {
  const input = document.getElementById('owuiToken');
  input.type = input.type === 'password' ? 'text' : 'password';
});

/* ─── Save Settings ─── */
document.getElementById('saveBtn').addEventListener('click', () => {
  const domain = document.getElementById('owuiDomain').value.trim().replace(/\/$/, '');
  const token  = document.getElementById('owuiToken').value.trim();

  if (!domain) {
    showStatus('settingsStatus', 'error', '⚠ Please enter your Open WebUI URL');
    return;
  }

  chrome.storage.sync.set({ owuiDomain: domain, owuiToken: token }, () => {
    const ind = document.getElementById('saveIndicator');
    ind.style.display = 'block';
    setTimeout(() => ind.style.display = 'none', 2500);
    hideStatus('settingsStatus');
  });
});

/* ─── File Handling ─── */
let selectedFiles = [];

const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json')));
});

fileInput.addEventListener('change', () => {
  handleFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

function handleFiles(newFiles) {
  newFiles.forEach(file => {
    if (!selectedFiles.find(f => f.name === file.name)) selectedFiles.push(file);
  });
  renderFileList();
}

function renderFileList() {
  const list      = document.getElementById('fileList');
  const importBtn = document.getElementById('importBtn');
  const clearBtn  = document.getElementById('clearBtn');

  list.innerHTML = '';
  selectedFiles.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span>📄 ${file.name}</span><button class="remove" data-index="${i}">✕</button>`;
    list.appendChild(item);
  });

  list.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(parseInt(btn.dataset.index), 1);
      renderFileList();
    });
  });

  importBtn.disabled = selectedFiles.length === 0;
  clearBtn.style.display = selectedFiles.length > 0 ? 'block' : 'none';
}

document.getElementById('clearBtn').addEventListener('click', () => {
  selectedFiles = [];
  renderFileList();
  hideStatus('importStatus');
});

/* ─── Import to Open WebUI ─── */
document.getElementById('importBtn').addEventListener('click', async () => {
  const { owuiDomain, owuiToken } = await chrome.storage.sync.get(['owuiDomain', 'owuiToken']);

  if (!owuiDomain) {
    showStatus('importStatus', 'error', '⚠ No Open WebUI URL set.\nGo to ⚙️ Settings tab first.');
    return;
  }
  if (!owuiToken) {
    showStatus('importStatus', 'error', '⚠ No API token set.\nGo to ⚙️ Settings tab first.');
    return;
  }

  const importBtn    = document.getElementById('importBtn');
  const progressBar  = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');

  importBtn.disabled = true;
  importBtn.textContent = 'Importing...';
  progressBar.style.display = 'block';
  progressFill.style.width  = '0%';
  hideStatus('importStatus');

  let successCount = 0, failCount = 0;
  const errors = [];

  // Read all files first
  let allChats = [];
  for (const file of selectedFiles) {
    try {
      const text   = await file.text();
      const parsed = JSON.parse(text);
      const chats  = Array.isArray(parsed) ? parsed : [parsed];
      allChats.push(...chats);
    } catch (err) {
      failCount++;
      errors.push(`${file.name}: Invalid JSON`);
    }
  }

  const total = allChats.length;

  // Send each chat via background (bypasses CORS)
  for (let i = 0; i < allChats.length; i++) {
    const chat = allChats[i];
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'importToOWUI', domain: owuiDomain, token: owuiToken, chat },
        (response) => {
          if (response && response.success) {
            successCount++;
          } else {
            failCount++;
            errors.push(`"${chat.title || `Chat ${i + 1}`}": ${(response && response.error) || 'Unknown error'}`);
          }
          progressFill.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
          resolve();
        }
      );
    });
  }

  importBtn.disabled  = false;
  importBtn.textContent = 'Import to Open WebUI';

  if (failCount === 0) {
    showStatus('importStatus', 'success',
      `✅ ${successCount} chat${successCount > 1 ? 's' : ''} imported successfully!`);
    selectedFiles = [];
    renderFileList();
  } else {
    showStatus('importStatus', 'error',
      `⚠ ${successCount} imported, ${failCount} failed.\n${errors.slice(0, 3).join('\n')}`);
  }

  setTimeout(() => { progressBar.style.display = 'none'; }, 1500);
});

/* ─── Helpers ─── */
function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.className  = `status ${type}`;
  el.textContent = msg;
}

function hideStatus(id) {
  const el = document.getElementById(id);
  el.className  = 'status';
  el.textContent = '';
}
