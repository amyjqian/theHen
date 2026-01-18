console.log("theHen Content Script Loaded");
// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content received message:", request);
  if (request.action === 'SHOW_INTERVENTION') {
    showOverlay(request.data);
  }
});

function showOverlay(data) {
  // Check if overlay already exists
  if (document.getElementById('ai-accountability-host')) return;

  // Create Shadow Host
  const host = document.createElement('div');
  host.id = 'ai-accountability-host';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647'; // Max z-index
  host.style.top = '20px';
  host.style.right = '20px';
  host.style.width = '320px';
  host.style.fontFamily = 'sans-serif';

  const shadow = host.attachShadow({ mode: 'open' });

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      padding: 16px;
      border: 1px solid #e2e8f0;
      animation: slideIn 0.5s ease-out;
    }
    @keyframes slideIn {
      from { transform: translateX(120%); }
      to { transform: translateX(0); }
    }
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    }
    .avatar {
      width: 32px;
      height: 32px;
      background-color: #6366f1;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 10px;
      font-size: 14px;
    }
    .name {
      font-weight: 700;
      color: #1e293b;
      font-size: 14px;
    }
    .message {
      color: #475569;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      flex: 1;
      padding: 8px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    .btn-close {
      background-color: #ef4444;
      color: white;
    }
    .btn-ignore {
      background-color: #f1f5f9;
      color: #64748b;
    }
  `;

  // HTML Content
  const container = document.createElement('div');
  container.className = 'card';
  // Previous avatar line:
  // <div class="avatar">${data.personaName.substring(0, 2).toUpperCase()}</div>
  container.innerHTML = `
    <div class="header">
      <div class="avatar"><img src="${chrome.runtime.getURL('assets/' + (data.gif || 'example.gif'))}" alt="Persona Hen" style="width: 32px; height: 32px; border-radius: 50%;"></div>
      <div class="name">${data.personaName}</div>
    </div>
    <div class="message">
      ${data.message}
    </div>
    <div class="actions">
      <button class="btn-close" id="close-tab">Close Tab</button>
      <button class="btn-ignore" id="ignore">Ignore</button>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // Event Listeners
  const closeBtn = container.querySelector('#close-tab');
  const ignoreBtn = container.querySelector('#ignore');

  closeBtn.addEventListener('click', () => {
    // We cannot close the tab from content script directly without permission issues sometimes,
    // but we can try window.close() or ask background.
    // Actually, content scripts can't close tabs easily if not opened by script.
    // Better to send message to background to close tab.
    chrome.runtime.sendMessage({ action: 'CLOSE_TAB' });
  });

  ignoreBtn.addEventListener('click', () => {
    host.remove();
  });

  document.body.appendChild(host);
}
