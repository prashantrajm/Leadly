(function () {
  if (window.__leadlyWidgetLoaded) return;
  window.__leadlyWidgetLoaded = true;

  var script =
    document.currentScript ||
    document.querySelector('script[src*="/loader.js"][data-agent-id]');
  if (!script) return;

  var agentId = script.getAttribute("data-agent-id");
  if (!agentId) {
    console.error("[Leadly] Missing data-agent-id on loader script.");
    return;
  }

  var scriptUrl = new URL(script.src, window.location.href);
  var apiBase = (
    script.getAttribute("data-api-url") || scriptUrl.origin
  ).replace(/\/api\/?$/, "");

  var visitorStorageKey = "leadly:visitor:" + agentId;
  var visitorExternalId = localStorage.getItem(visitorStorageKey);
  if (!visitorExternalId) {
    visitorExternalId =
      "v-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10);
    localStorage.setItem(visitorStorageKey, visitorExternalId);
  }

  var state = {
    config: null,
    visitorToken: null,
    conversationId: null,
    ws: null,
    open: false,
    connecting: false,
    currentAgentTurn: null,
  };

  var root = document.createElement("div");
  root.id = "leadly-widget-root";
  document.documentElement.appendChild(root);
  var shadow = root.attachShadow({ mode: "open" });

  shadow.innerHTML =
    '<style>' +
    ":host{all:initial}" +
    ".lw-wrap{position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827}" +
    ".lw-button{width:56px;height:56px;border-radius:999px;border:0;background:var(--leadly-accent,#2563eb);color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.24);cursor:pointer;display:grid;place-items:center;transition:transform .16s ease,box-shadow .16s ease}" +
    ".lw-button:hover{transform:translateY(-1px);box-shadow:0 22px 50px rgba(15,23,42,.3)}" +
    ".lw-button svg{width:26px;height:26px}" +
    ".lw-panel{position:absolute;right:0;bottom:72px;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 110px));border:1px solid rgba(15,23,42,.12);border-radius:18px;background:#fff;box-shadow:0 24px 80px rgba(15,23,42,.28);overflow:hidden;display:none}" +
    ".lw-panel[data-open='true']{display:flex;flex-direction:column}" +
    ".lw-head{background:var(--leadly-accent,#2563eb);color:#fff;padding:16px 18px}" +
    ".lw-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}" +
    ".lw-name{font-size:15px;font-weight:700;line-height:1.2}" +
    ".lw-sub{margin-top:4px;font-size:12px;opacity:.82}" +
    ".lw-end{border:1px solid rgba(255,255,255,.34);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font:inherit;font-size:11px;font-weight:700;padding:5px 8px;cursor:pointer;white-space:nowrap}" +
    ".lw-end:disabled{opacity:.5;cursor:not-allowed}" +
    ".lw-messages{flex:1;overflow:auto;padding:16px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}" +
    ".lw-msg{max-width:82%;border-radius:14px;padding:10px 12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}" +
    ".lw-agent{align-self:flex-start;background:#fff;border:1px solid rgba(15,23,42,.08);color:#111827}" +
    ".lw-user{align-self:flex-end;background:var(--leadly-accent,#2563eb);color:#fff}" +
    ".lw-status{font-size:12px;color:#64748b;text-align:center;padding:8px 12px}" +
    ".lw-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(15,23,42,.1);background:#fff}" +
    ".lw-input{flex:1;min-width:0;border:1px solid rgba(15,23,42,.16);border-radius:999px;padding:10px 13px;font:inherit;font-size:14px;outline:none}" +
    ".lw-input:focus{border-color:var(--leadly-accent,#2563eb);box-shadow:0 0 0 3px color-mix(in srgb,var(--leadly-accent,#2563eb) 18%,transparent)}" +
    ".lw-send{border:0;border-radius:999px;background:var(--leadly-accent,#2563eb);color:#fff;font-weight:700;padding:0 14px;cursor:pointer}" +
    ".lw-send:disabled,.lw-input:disabled{opacity:.55;cursor:not-allowed}" +
    "@media(max-width:480px){.lw-wrap{right:14px;bottom:14px}.lw-panel{right:-6px;bottom:68px;width:calc(100vw - 28px);height:min(560px,calc(100vh - 96px))}}" +
    "</style>" +
    '<div class="lw-wrap">' +
    '<section class="lw-panel" aria-live="polite">' +
    '<div class="lw-head"><div class="lw-head-row"><div><div class="lw-name">Leadly</div><div class="lw-sub">Ask us anything.</div></div><button class="lw-end" type="button" disabled>End chat</button></div></div>' +
    '<div class="lw-messages"></div>' +
    '<div class="lw-status">Loading...</div>' +
    '<form class="lw-form">' +
    '<input class="lw-input" type="text" maxlength="4000" placeholder="Write a message..." disabled />' +
    '<button class="lw-send" type="submit" disabled>Send</button>' +
    "</form>" +
    "</section>" +
    '<button class="lw-button" type="button" aria-label="Open chat">' +
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8.9 7.38 1.5 1.5 0 0 0-.91.08L6 20.5l.83-3.14a1.5 1.5 0 0 0-.2-1.17A7.5 7.5 0 1 1 20 11.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10.5h8M8 13.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    "</button>" +
    "</div>";

  var panel = shadow.querySelector(".lw-panel");
  var button = shadow.querySelector(".lw-button");
  var nameEl = shadow.querySelector(".lw-name");
  var subEl = shadow.querySelector(".lw-sub");
  var endButton = shadow.querySelector(".lw-end");
  var messagesEl = shadow.querySelector(".lw-messages");
  var statusEl = shadow.querySelector(".lw-status");
  var form = shadow.querySelector(".lw-form");
  var input = shadow.querySelector(".lw-input");
  var send = shadow.querySelector(".lw-send");

  function setStatus(text) {
    statusEl.textContent = text || "";
    statusEl.style.display = text ? "block" : "none";
  }

  function setReady(ready) {
    input.disabled = !ready;
    send.disabled = !ready;
    endButton.disabled = !ready;
  }

  function markEnded(message) {
    state.ended = true;
    setReady(false);
    endButton.disabled = true;
    setStatus(message || "Chat ended.");
  }

  function appendMessage(role, text, id) {
    var msg = document.createElement("div");
    msg.className = "lw-msg " + (role === "user" ? "lw-user" : "lw-agent");
    if (id) msg.dataset.turnId = id;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function updateAgentMessage(turnId, text, append) {
    var msg = messagesEl.querySelector('[data-turn-id="' + turnId + '"]');
    if (!msg) msg = appendMessage("agent", "", turnId);
    msg.textContent = append ? msg.textContent + text : text;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadConfig() {
    var res = await fetch(
      apiBase + "/api/widget/config?agentId=" + encodeURIComponent(agentId),
    );
    if (!res.ok) throw new Error("config " + res.status);
    state.config = await res.json();
    nameEl.textContent = state.config.name || "Leadly";
    subEl.textContent = state.config.greeting || "Ask us anything.";
    shadow.host.style.setProperty(
      "--leadly-accent",
      state.config.accentColor || "#2563eb",
    );
    appendMessage("agent", state.config.greeting || "Ask us anything.");
    setStatus("");
  }

  async function startConversation() {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) return;
    if (state.connecting) return;
    state.connecting = true;
    setReady(false);
    setStatus("Connecting...");

    try {
      var visitorRes = await fetch(
        apiBase + "/api/widget/visitor?agentId=" + encodeURIComponent(agentId),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            externalId: visitorExternalId,
            userAgent: navigator.userAgent,
          }),
        },
      );
      if (!visitorRes.ok) throw new Error("visitor " + visitorRes.status);
      var visitor = await visitorRes.json();
      state.visitorToken = visitor.token;

      var convRes = await fetch(apiBase + "/api/widget/conversation", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + state.visitorToken,
        },
        body: JSON.stringify({}),
      });
      if (!convRes.ok) throw new Error("conversation " + convRes.status);
      var conv = await convRes.json();
      state.conversationId = conv.conversationId;

      var wsUrl = new URL(conv.wsUrl);
      wsUrl.searchParams.set("token", state.visitorToken);
      var ws = new WebSocket(wsUrl.toString());
      state.ws = ws;

      ws.addEventListener("open", function () {
        state.connecting = false;
        setReady(true);
        setStatus("");
        ws.send(
          JSON.stringify({
            type: "widget_hello",
            visitorToken: state.visitorToken,
          }),
        );
      });

      ws.addEventListener("message", function (event) {
        var frame;
        try {
          frame = JSON.parse(event.data);
        } catch (_err) {
          return;
        }

        if (frame.type === "typing") {
          setStatus(frame.on ? "Typing..." : "");
          return;
        }
        if (frame.type === "agent_token") {
          state.currentAgentTurn = frame.turnId;
          setStatus("");
          updateAgentMessage(frame.turnId, frame.delta || "", true);
          return;
        }
        if (frame.type === "agent_turn_end") {
          updateAgentMessage(frame.turnId, frame.text || "", false);
          state.currentAgentTurn = null;
          setStatus("");
          return;
        }
        if (frame.type === "human_msg") {
          appendMessage("agent", frame.text || "", frame.turnId);
          return;
        }
        if (frame.type === "conversation_ended") {
          markEnded("Chat ended.");
          return;
        }
        if (frame.type === "error") {
          setStatus(frame.message || "Something went wrong.");
        }
      });

      ws.addEventListener("close", function () {
        state.connecting = false;
        if (state.ended) return;
        setReady(false);
        setStatus("Chat disconnected. Reopen to reconnect.");
      });

      ws.addEventListener("error", function () {
        state.connecting = false;
        setReady(false);
        setStatus("Could not connect.");
      });
    } catch (err) {
      state.connecting = false;
      setReady(false);
      setStatus("Could not start chat.");
      console.error("[Leadly]", err);
    }
  }

  button.addEventListener("click", function () {
    state.open = !state.open;
    panel.dataset.open = String(state.open);
    button.setAttribute("aria-label", state.open ? "Close chat" : "Open chat");
    if (state.open) startConversation();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    appendMessage("user", text);
    input.value = "";
    state.ws.send(JSON.stringify({ type: "user_msg", text: text }));
  });

  endButton.addEventListener("click", function () {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify({ type: "end_chat" }));
    markEnded("Chat ended.");
  });

  loadConfig().catch(function (err) {
    setStatus("Could not load chat.");
    console.error("[Leadly]", err);
  });
})();
