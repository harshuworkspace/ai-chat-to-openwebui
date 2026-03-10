chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'importToOWUI') return;

  const { domain, token, chat } = request;

  const tryImport = async () => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const bodyFormats = [
      { chats: [chat] },
      { chat: chat },
      [chat],
    ];

    const endpoints = [
      `${domain}/api/v1/chats/import`,
      `${domain}/api/v1/chats/new`,
    ];

    for (const endpoint of endpoints) {
      for (const body of bodyFormats) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });

          if (res.ok) {
            console.log(`✅ Success: ${endpoint}`);
            return { success: true };
          }

          if (res.status === 401 || res.status === 403) {
            return {
              success: false,
              error: `Auth failed (${res.status}). Check your API token in Settings.\n\nOpen WebUI → Profile → Settings → Account → API Key`
            };
          }

          const errText = await res.text();
          console.warn(`❌ ${endpoint}: ${res.status} ${errText}`);

        } catch (netErr) {
          if (endpoint === endpoints[endpoints.length - 1] &&
              body === bodyFormats[bodyFormats.length - 1]) {
            return {
              success: false,
              error: `Cannot reach ${domain}.\n\nChecklist:\n• Is Tailscale / VPN connected?\n• Does the URL open in a normal Chrome tab?\n• Try http:// instead of https:// if no SSL cert\n\nDetail: ${netErr.message}`
            };
          }
        }
      }
    }

    return { success: false, error: 'All endpoint/format combinations failed.' };
  };

  tryImport().then(sendResponse);
  return true;
});
