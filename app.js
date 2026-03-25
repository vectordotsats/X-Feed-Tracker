// ── XMON v2 — App Logic ──

const STORAGE = {
  keywords: 'xmon_keywords',
  tweets: 'xmon_tweets',
  chat: 'xmon_chat',
};

const DEFAULT_KEYWORDS = ['rUSD', 'wsrUSD', 'Reservoir', 'DAM', 'IPOR', 'Morpho'];

const SYSTEM_PROMPT = `You are XMON, an AI analyst built for a DeFi community manager running the @ReservoirIntern account on X (Reservoir Protocol).

Your job:
- Analyze pasted tweets/threads for sentiment, narrative, and engagement signals
- Draft reply suggestions in the ReservoirIntern voice: degen-native, slightly unhinged intern energy, concise, occasionally self-deprecating, always on-brand for Reservoir Protocol
- Track narratives around: rUSD (PSM-backed stablecoin), wsrUSD (ERC4626 yield token, primary yield product), DAM (governance token), integrations (Morpho, IPOR Fusion, Stargate, LayerZero)
- Flag engagement opportunities, FUD to address, or alpha to amplify
- When drafting replies, give 2-3 options: one safe/professional, one full degen intern energy, one somewhere between

Protocol context:
- rUSD = PSM-backed stablecoin by Reservoir Protocol
- wsrUSD = wrapped staked rUSD, ERC4626, the primary yield product (replaced srUSD)
- trUSD = term-based product, NOT YET LIVE — never reference publicly
- DAM = governance token
- Key integrations: Morpho (lending markets), IPOR Fusion (wsrUSD as vault asset), LayerZero + Stargate (cross-chain), Steakhouse
- Season 3 points are live, Season 2 claims happened via Merkl (50%/100% options)

Be concise. Max 4-5 sentences for analysis unless asked for more. For reply drafts, keep each option to 1-2 tweets max. No fluff. Think like a degen who reads whitepapers.`;

// ── State ──

let keywords = [];
let tweets = [];
let chatHistory = [];
let isLoading = false;

// ── DOM refs ──

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  bindEvents();
  renderKeywords();
  renderFeed();
  renderChat();
});

function loadState() {
  try {
    const kw = localStorage.getItem(STORAGE.keywords);
    keywords = kw ? JSON.parse(kw) : [...DEFAULT_KEYWORDS];
  } catch { keywords = [...DEFAULT_KEYWORDS]; }

  try {
    const tw = localStorage.getItem(STORAGE.tweets);
    tweets = tw ? JSON.parse(tw) : [];
  } catch { tweets = []; }

  try {
    const ch = localStorage.getItem(STORAGE.chat);
    chatHistory = ch ? JSON.parse(ch) : [];
  } catch { chatHistory = []; }
}

function saveKeywords() { localStorage.setItem(STORAGE.keywords, JSON.stringify(keywords)); }
function saveTweets() { localStorage.setItem(STORAGE.tweets, JSON.stringify(tweets)); }
function saveChat() { localStorage.setItem(STORAGE.chat, JSON.stringify(chatHistory)); }

// ── Events ──

function bindEvents() {
  // nav tabs
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.view').forEach(v => v.classList.remove('active'));
      $(`#view-${btn.dataset.view}`).classList.add('active');
    });
  });

  // keyword input
  $('#kw-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (val && !keywords.includes(val)) {
        keywords.push(val);
        saveKeywords();
        renderKeywords();
      }
      e.target.value = '';
    }
  });

  // chat input
  $('#chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  });

  // auto-resize chat input
  $('#chat-input').addEventListener('input', (e) => {
    e.target.style.height = '40px';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  });

  // send button
  $('#send-btn').addEventListener('click', sendMessage);

  // clear chat
  $('#clear-chat').addEventListener('click', () => {
    chatHistory = [];
    localStorage.removeItem(STORAGE.chat);
    renderChat();
  });

  // example chips
  $$('.example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $('#chat-input').value = chip.dataset.prompt;
      $('#chat-input').focus();
      $('#chat-input').dispatchEvent(new Event('input'));
    });
  });

  // add tweet
  $('#add-tweet').addEventListener('click', addTweet);
  $('#feed-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addTweet();
    }
  });
}

// ── Keywords ──

function renderKeywords() {
  const container = $('#kw-chips');
  container.innerHTML = keywords.map(kw =>
    `<div class="kw-chip">${esc(kw)}<span class="remove" data-kw="${esc(kw)}">×</span></div>`
  ).join('');

  container.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      keywords = keywords.filter(k => k !== btn.dataset.kw);
      saveKeywords();
      renderKeywords();
      renderFeed(); // re-highlight
    });
  });
}

// ── Feed ──

function addTweet() {
  const input = $('#feed-input');
  const text = input.value.trim();
  if (!text) return;

  tweets.unshift({
    id: Date.now().toString(),
    text,
    addedAt: new Date().toISOString(),
  });
  saveTweets();
  renderFeed();
  input.value = '';
}

function removeTweet(id) {
  tweets = tweets.filter(t => t.id !== id);
  saveTweets();
  renderFeed();
}

function analyzeTweet(id) {
  const tweet = tweets.find(t => t.id === id);
  if (!tweet) return;

  // switch to chat view
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  $$('.nav-btn')[0].classList.add('active');
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-chat').classList.add('active');

  // populate input
  const input = $('#chat-input');
  input.value = `Analyze this tweet and suggest intern account replies:\n\n"${tweet.text}"`;
  input.focus();
  input.dispatchEvent(new Event('input'));
}

function highlightText(text) {
  if (!keywords.length) return esc(text);
  const regex = new RegExp(
    `(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  return esc(text).replace(regex, '<span class="highlight">$1</span>');
}

function renderFeed() {
  $('#feed-count').textContent = `(${tweets.length})`;

  if (!tweets.length) {
    $('#feed-list').innerHTML = `
      <div class="empty-feed">
        <div style="font-size:28px;margin-bottom:12px">📋</div>
        <div>No tweets saved yet. Paste tweets above to start tracking.</div>
      </div>`;
    return;
  }

  $('#feed-list').innerHTML = tweets.map(t => {
    const time = new Date(t.addedAt).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="tweet-card" data-id="${t.id}">
        <div class="tweet-text">${highlightText(t.text)}</div>
        <div class="tweet-footer">
          <span class="tweet-time">${time}</span>
          <div class="tweet-actions">
            <button class="analyze-btn" data-id="${t.id}">ANALYZE ◈</button>
            <button class="remove-btn" data-id="${t.id}">×</button>
          </div>
        </div>
      </div>`;
  }).join('');

  // bind actions
  $$('.analyze-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      analyzeTweet(btn.dataset.id);
    });
  });
  $$('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTweet(btn.dataset.id);
    });
  });
}

// ── Chat ──

function renderChat() {
  const container = $('#chat-messages');

  if (!chatHistory.length) {
    // show welcome
    container.innerHTML = `
      <div class="welcome">
        <div class="welcome-icon">⚡</div>
        <div class="welcome-title">gm. XMON is online.</div>
        <div class="welcome-text">
          Paste tweets in the <strong>FEED</strong> tab, then ask me to analyze them.
          Or just ask me anything about Reservoir narratives.
        </div>
        <div class="welcome-examples">
          <button class="example-chip" data-prompt="What's the current sentiment around wsrUSD?">"Sentiment on wsrUSD?"</button>
          <button class="example-chip" data-prompt="Draft an intern reply to a bullish rUSD tweet">"Draft intern reply"</button>
          <button class="example-chip" data-prompt="Summarize the Reservoir narrative this week based on my feed">"Weekly narrative summary"</button>
        </div>
      </div>`;
    // rebind examples
    container.querySelectorAll('.example-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $('#chat-input').value = chip.dataset.prompt;
        $('#chat-input').focus();
        $('#chat-input').dispatchEvent(new Event('input'));
      });
    });
    return;
  }

  container.innerHTML = chatHistory.map(msg => `
    <div class="msg ${msg.role}">
      <div class="msg-role">${msg.role === 'user' ? 'YOU' : 'XMON'}</div>
      <div class="msg-bubble">${esc(msg.content)}</div>
    </div>
  `).join('');

  scrollChat();
}

function addChatMessage(role, content) {
  const container = $('#chat-messages');

  // hide welcome if present
  const welcome = container.querySelector('.welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-role">${role === 'user' ? 'YOU' : 'XMON'}</div>
    <div class="msg-bubble">${esc(content)}</div>
  `;
  container.appendChild(div);
  scrollChat();
}

function showTyping() {
  const container = $('#chat-messages');
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-role">XMON</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollChat();
}

function removeTyping() {
  const el = $('#typing-indicator');
  if (el) el.remove();
}

function scrollChat() {
  const container = $('#chat-messages');
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text || isLoading) return;

  // add user message
  chatHistory.push({ role: 'user', content: text });
  addChatMessage('user', text);
  input.value = '';
  input.style.height = '40px';

  isLoading = true;
  $('#send-btn').disabled = true;
  showTyping();

  try {
    const feedContext = tweets.length
      ? `\n\nSaved tweets in feed:\n${tweets.map((t, i) => `[${i + 1}] ${t.text}`).join('\n')}`
      : '';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT + feedContext + `\n\nTracked keywords: ${keywords.join(', ')}`,
        messages: chatHistory.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const reply = data.content?.map(b => b.text || '').join('') || 'No response.';
    chatHistory.push({ role: 'assistant', content: reply });
    removeTyping();
    addChatMessage('assistant', reply);
    saveChat();

  } catch (err) {
    const errMsg = `⚠ Error: ${err.message}`;
    chatHistory.push({ role: 'assistant', content: errMsg });
    removeTyping();
    addChatMessage('assistant', errMsg);
    saveChat();
  }

  isLoading = false;
  $('#send-btn').disabled = false;
}

// ── Util ──

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}