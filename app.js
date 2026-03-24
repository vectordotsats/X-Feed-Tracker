let anthropicKey = '';
        let xBearerToken = '';
        let keywords = ['rUSD', 'wsrUSD', 'Reservoir', 'DAM'];
        let allTweets = [];
        let currentFilter = 'all';
        let chatHistory = [];

        const MOCK_TWEETS = [
            {
                id: '1', author: 'DeFi Degen', handle: '@defidegen_eth', avatar: 'D', time: '2m ago',
                body: 'The rUSD PSM mechanism is actually underrated. Clean arbitrage loop keeping peg tight. More protocols should study this design.',
                tags: ['defi', 'keyword'], priority: 'high', stats: { likes: 142, rts: 38, replies: 12 }
            },
            {
                id: '2', author: 'Reservoir Intern', handle: '@ReservoirIntern', avatar: 'R', time: '8m ago',
                body: "Season 3 is live. If you've been stacking wsrUSD you already know. Points don't sleep.",
                tags: ['mention', 'keyword'], priority: 'high', stats: { likes: 89, rts: 21, replies: 7 }
            },
            {
                id: '3', author: 'Stablecoin Alpha', handle: '@stablealpha', avatar: 'S', time: '15m ago',
                body: 'IPOR Fusion now supports wsrUSD as a vault asset. This is the yield composability play people are sleeping on. $IPOR + Reservoir = interesting.',
                tags: ['defi', 'keyword'], priority: 'high', stats: { likes: 203, rts: 67, replies: 29 }
            },
            {
                id: '4', author: '0xvector_', handle: '@0xvector_', avatar: 'V', time: '22m ago',
                body: 'Morpho market for rUSD is deeper than people realize. The utilization curve is set conservatively. Good for borrowers, safer for lenders.',
                tags: ['mention'], priority: 'medium', stats: { likes: 31, rts: 8, replies: 4 }
            },
            {
                id: '5', author: 'On-Chain Analyst', handle: '@onchain_anon', avatar: 'O', time: '34m ago',
                body: 'Ran a Dune query on Reservoir Protocol TVL across chains. Monad deployment is showing early traction. Dashboard link in thread.',
                tags: ['defi', 'keyword'], priority: 'medium', stats: { likes: 76, rts: 19, replies: 11 }
            },
            {
                id: '6', author: 'DeFi Researcher', handle: '@defi_research', avatar: 'D', time: '51m ago',
                body: "Comparative analysis of DAM tokenomics vs veToken models. Reservoir's approach is more gas efficient but sacrifices some governance expressiveness.",
                tags: ['defi', 'keyword'], priority: 'medium', stats: { likes: 118, rts: 44, replies: 22 }
            },
            {
                id: '7', author: 'Yield Hunter', handle: '@yieldhunter99', avatar: 'Y', time: '1h ago',
                body: 'Currently rotating: USDC → wsrUSD → IPOR vault. Stack yield on yield. Not financial advice but also yes it is.',
                tags: ['keyword'], priority: 'low', stats: { likes: 54, rts: 14, replies: 6 }
            },
            {
                id: '8', author: 'Protocol Watcher', handle: '@protwatcher', avatar: 'P', time: '2h ago',
                body: 'LayerZero + Reservoir Protocol cross-chain flows are picking up. Stargate bridge volume for rUSD is up 3x WoW.',
                tags: ['defi', 'keyword'], priority: 'high', stats: { likes: 167, rts: 52, replies: 18 }
            }
        ];

        window.onload = () => {
            anthropicKey = localStorage.getItem('xmon_anthropic') || '';
            xBearerToken = localStorage.getItem('xmon_x_token') || '';
            const savedKws = localStorage.getItem('xmon_keywords');
            if (savedKws) keywords = JSON.parse(savedKws);
            if (anthropicKey) {
                document.getElementById('setup-screen').style.display = 'none';
                launchApp();
            }
        };

        function saveKeys() {
            const ak = document.getElementById('setup-anthropic').value.trim();
            const xk = document.getElementById('setup-x').value.trim();
            if (!ak) { alert('Anthropic API key is required for the chat to work.'); return; }
            anthropicKey = ak;
            xBearerToken = xk;
            localStorage.setItem('xmon_anthropic', ak);
            if (xk) localStorage.setItem('xmon_x_token', xk);
            document.getElementById('setup-screen').style.display = 'none';
            launchApp();
        }

        function launchApp() {
            document.getElementById('app').style.display = 'block';
            if (xBearerToken) document.getElementById('mode-label').textContent = 'LIVE MODE';
            renderKeywords();
            loadFeed();
        }

        function resetKeys() {
            localStorage.removeItem('xmon_anthropic');
            localStorage.removeItem('xmon_x_token');
            location.reload();
        }

        function renderKeywords() {
            const bar = document.getElementById('keyword-bar');
            const input = document.getElementById('kw-input');
            bar.querySelectorAll('.kw-chip').forEach(c => c.remove());
            keywords.forEach(kw => {
                const chip = document.createElement('div');
                chip.className = 'kw-chip';
                chip.innerHTML = `${kw} <span class="remove" onclick="removeKeyword('${kw}')">×</span>`;
                bar.insertBefore(chip, input);
            });
            localStorage.setItem('xmon_keywords', JSON.stringify(keywords));
        }

        function addKeyword(e) {
            if (e.key === 'Enter') {
                const val = e.target.value.trim();
                if (val && !keywords.includes(val)) { keywords.push(val); renderKeywords(); }
                e.target.value = '';
            }
        }

        function removeKeyword(kw) {
            keywords = keywords.filter(k => k !== kw);
            renderKeywords();
        }

        async function loadFeed() {
            const btn = document.getElementById('refresh-btn');
            const span = document.createElement('span');
            span.className = 'spinning';
            span.textContent = '↻';
            btn.innerHTML = '';
            btn.appendChild(span);
            btn.appendChild(document.createTextNode(' REFRESH'));
            btn.disabled = true;
            await new Promise(r => setTimeout(r, 700));
            allTweets = MOCK_TWEETS;
            renderFeed();
            btn.innerHTML = '↻ REFRESH';
            btn.disabled = false;
        }

        function renderFeed() {
            const list = document.getElementById('feed-list');
            const tweets = currentFilter === 'all' ? allTweets : allTweets.filter(t => t.tags.includes(currentFilter));
            if (!tweets.length) {
                list.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No tweets match this filter.</p></div>';
                return;
            }
            list.innerHTML = tweets.map((t, i) => {
                const colors = ['#00ff87', '#00bfff', '#ff6b35', '#a855f7', '#f59e0b'];
                let hash = 0;
                for (let c of t.handle) hash = (hash << 5) - hash + c.charCodeAt(0);
                const color = colors[Math.abs(hash) % colors.length];
                const body = keywords.reduce((acc, kw) =>
                    acc.replace(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                        '<span class="highlight">$1</span>'), t.body);
                return `
      <div class="tweet-card ${t.priority}" style="animation-delay:${i * 0.05}s" onclick="askAboutTweet('${t.id}')">
        <div class="tweet-meta">
          <div class="tweet-avatar" style="background:${color};color:#080b10">${t.avatar}</div>
          <div><div class="tweet-author">${t.author}</div><div class="tweet-handle">${t.handle}</div></div>
          <div class="tweet-time">${t.time}</div>
        </div>
        <div class="tweet-body">${body}</div>
        <div class="tweet-tags">${t.tags.map(tag => `<span class="tag ${tag}">${tag.toUpperCase()}</span>`).join('')}</div>
        <div class="tweet-stats"><span class="stat">♥ ${t.stats.likes}</span><span class="stat">↺ ${t.stats.rts}</span><span class="stat">↩ ${t.stats.replies}</span></div>
      </div>`;
            }).join('');
        }

        function filterFeed(type, el) {
            currentFilter = type;
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            renderFeed();
        }

        function askAboutTweet(id) {
            const tweet = allTweets.find(t => t.id === id);
            if (!tweet) return;
            const input = document.getElementById('chat-input');
            input.value = `Tell me more about this tweet from ${tweet.handle}: "${tweet.body}"`;
            input.focus();
            autoResize(input);
        }

        function autoResize(el) {
            el.style.height = '40px';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        }

        function handleChatKey(e) {
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendMessage(); }
        }

        async function sendMessage() {
            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (!text) return;
            addMessage('user', text);
            input.value = '';
            autoResize(input);
            chatHistory.push({ role: 'user', content: text });
            const typingId = showTyping();
            document.getElementById('send-btn').disabled = true;

            try {
                if (!anthropicKey) {
                    removeTyping(typingId);
                    addMessage('assistant', 'No Anthropic API key set. Click ⚙ KEYS to add your key and unlock the chat.');
                    document.getElementById('send-btn').disabled = false;
                    return;
                }

                const feedContext = allTweets.map(t =>
                    `[${t.handle}] ${t.body} (${t.stats.likes} likes, tags: ${t.tags.join(', ')})`
                ).join('\n');

                const systemPrompt = `You are XMON, an AI analyst monitoring crypto Twitter for a DeFi community manager at Reservoir Protocol.

Current feed:
${feedContext}

Tracked keywords: ${keywords.join(', ')}
Tracked accounts: @0xvector_, @ReservoirIntern

Be concise, direct, degen-native in tone. Surface insights and actionable info. Max 3-4 sentences unless asked for more. No fluff.`;

                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': anthropicKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 600,
                        system: systemPrompt,
                        messages: chatHistory
                    })
                });

                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                const reply = data.content?.[0]?.text || 'No response.';
                chatHistory.push({ role: 'assistant', content: reply });
                removeTyping(typingId);
                addMessage('assistant', reply);
            } catch (err) {
                removeTyping(typingId);
                addMessage('assistant', `Error: ${err.message}`);
            }
            document.getElementById('send-btn').disabled = false;
        }

        function addMessage(role, text) {
            const container = document.getElementById('chat-messages');
            const msg = document.createElement('div');
            msg.className = `msg ${role}`;
            msg.innerHTML = `<div class="msg-role">${role === 'user' ? 'YOU' : 'XMON AGENT'}</div><div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>`;
            container.appendChild(msg);
            container.scrollTop = container.scrollHeight;
        }

        function showTyping() {
            const container = document.getElementById('chat-messages');
            const id = 'typing-' + Date.now();
            const msg = document.createElement('div');
            msg.className = 'msg assistant';
            msg.id = id;
            msg.innerHTML = `<div class="msg-role">XMON AGENT</div><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
            container.appendChild(msg);
            container.scrollTop = container.scrollHeight;
            return id;
        }

        function removeTyping(id) {
            const el = document.getElementById(id);
            if (el) el.remove();
        }