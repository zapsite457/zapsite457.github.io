/* Zapsite enquiry assistant widget.
   One script tag is enough — this file loads chat-widget.css next to itself.

   <script src="chat-widget/chat-widget.js"
     data-endpoint="https://your-worker.workers.dev"
     data-business="Zapsite"
     data-colour="#3b6cff"
     data-enquiry="https://formsubmit.co/ajax/ian.socialstudio@gmail.com"
     data-contact-name="Ian"
     data-contact-email="ian.socialstudio@gmail.com"></script>

   data-endpoint   Worker URL (POST /). Required to chat.
   data-business   Name used in the header. Default Zapsite.
   data-colour     Accent hex (#rgb or #rrggbb). data-color is also accepted.
   data-enquiry    JSON endpoint for the fallback form. For this site, the
                   FormSubmit AJAX URL used by submit.js. If it is omitted and
                   the page defines window.sendForm, that handler is used instead
                   (same inbox, same _subject / _template / _replyto / _honey fields).
   data-contact-name   Person named on the fallback button. Default Ian.
   data-contact-email  Shown only if sending the fallback form fails.
   Conversation is kept in sessionStorage for this tab. */
(function (root, factory) {
  "use strict";
  var api = factory();
  var hasModule = typeof module === "object" && module && module.exports;
  if (hasModule && typeof root.document === "undefined") module.exports = api;
  else api.boot();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var MAX = 1000;

  function text(value) { return String(value == null ? "" : value).trim(); }

  function validHex(value) {
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value || "") ? value : "";
  }

  function contrast(hex) {
    var c = hex.slice(1);
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.slice(0, 2), 16);
    var g = parseInt(c.slice(2, 4), 16);
    var b = parseInt(c.slice(4, 6), 16);
    var luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return { ink: luma > 0.62 ? "#1b0f0a" : "#fff", glow: "rgba(" + r + "," + g + "," + b + ",.35)" };
  }

  function readConfig(script) {
    var d = (script && script.dataset) || {};
    var colour = validHex(d.colour || d.color) || "#3b6cff";
    var tone = contrast(colour);
    return {
      endpoint: text(d.endpoint),
      business: text(d.business) || "Zapsite",
      colour: colour,
      ink: tone.ink,
      glow: tone.glow,
      enquiry: text(d.enquiry),
      contactName: text(d.contactName) || "Ian",
      contactEmail: text(d.contactEmail),
      start: text(d.start),
      fresh: d.fresh === "1"
    };
  }

  function storageKey(cfg) { return "zs-assistant:" + cfg.business; }

  function loadHistory(cfg) {
    try {
      var raw = sessionStorage.getItem(storageKey(cfg));
      var data = raw ? JSON.parse(raw) : null;
      if (!data || !Array.isArray(data.messages)) return [];
      return data.messages.filter(function (m) {
        return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
      }).slice(-20);
    } catch (e) { return []; }
  }

  function saveHistory(cfg, messages) {
    try {
      sessionStorage.setItem(storageKey(cfg), JSON.stringify({ messages: messages.slice(-20) }));
    } catch (e) { /* private mode or a full store — the chat still works this page view */ }
  }

  function el(tag, className, textValue) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue != null) node.textContent = textValue;
    return node;
  }

  function loadCss(script) {
    if (!script || !script.src || document.querySelector("link[data-zs-chat]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = script.src.replace(/\.js(\?.*)?$/, ".css$1");
    link.setAttribute("data-zs-chat", "");
    document.head.appendChild(link);
  }

  function buildEnquiryPayload(fields, cfg) {
    var name = text(fields.name);
    var email = text(fields.email);
    var phone = text(fields.phone);
    var message = text(fields.message);
    return {
      name: name,
      email: email,
      phone: phone,
      message: message,
      _subject: "Chat enquiry for " + cfg.business + ": " + name,
      _template: "table",
      _replyto: email,
      _honey: "",
      source: cfg.business + " Assistant (automated)"
    };
  }

  function validateEnquiry(fields) {
    var errors = {};
    if (!text(fields.name)) errors.name = "Enter your name.";
    var email = text(fields.email);
    var phone = text(fields.phone);
    if (!email && !phone) errors.contact = "Add an email or a phone number.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email.";
    if (phone && phone.replace(/\D/g, "").length < 8) errors.phone = "Enter a phone number we can call or text.";
    if (!text(fields.message)) errors.message = "Add a short message.";
    else if (text(fields.message).length > 2000) errors.message = "Please keep the message under 2,000 characters.";
    return errors;
  }

  function postEnquiry(url, payload, fetchImpl) {
    var doFetch = fetchImpl || fetch;
    return doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || String(data && data.success) !== "true") {
          throw new Error((data && data.message) || ("HTTP " + res.status));
        }
        return data;
      });
    });
  }

  function postViaSendForm(cfg, fields) {
    return new Promise(function (resolve, reject) {
      var form = document.createElement("form");
      ["name", "email", "phone", "message"].forEach(function (key) {
        var input = document.createElement("input");
        input.name = key;
        input.value = text(fields[key]);
        form.appendChild(input);
      });
      var source = document.createElement("input");
      source.name = "source";
      source.value = cfg.business + " Assistant (automated)";
      form.appendChild(source);
      var out = document.createElement("div");
      var obs = new MutationObserver(function () {
        if (out.querySelector(".msg.bad")) {
          obs.disconnect();
          reject(new Error("The form could not be sent."));
        }
      });
      obs.observe(out, { childList: true, subtree: true });
      window.sendForm(form, {
        subject: "Chat enquiry for " + cfg.business + ": " + text(fields.name),
        out: out,
        done: function () { obs.disconnect(); resolve({ success: "true" }); }
      });
    });
  }

  function boot() {
    if (!document.body || document.querySelector(".zs-root")) return;
    var script = document.currentScript || document.querySelector("script[src*='chat-widget.js']");
    var cfg = readConfig(script);
    loadCss(script);
    if (cfg.fresh) {
      try { sessionStorage.removeItem(storageKey(cfg)); } catch (e) {}
    }

    var messages = loadHistory(cfg);
    if (!messages.length) {
      messages.push({
        role: "assistant",
        content: "G'day. I'm the " + cfg.business + " Assistant — an automated assistant, not a person. Ask about packages, prices or how a site is built. If I don't know, use Talk to " + cfg.contactName + " / leave your details."
      });
      saveHistory(cfg, messages);
    }

    var rootEl = el("div", "zs-root");
    rootEl.style.setProperty("--zs", cfg.colour);
    rootEl.style.setProperty("--zs-ink", cfg.ink);
    rootEl.style.setProperty("--zs-glow", cfg.glow);

    var launcher = el("button", "zs-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "zs-panel");
    launcher.setAttribute("aria-label", "Open chat with the " + cfg.business + " Assistant, an automated assistant");
    launcher.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0z"/></svg>';

    var panel = el("section", "zs-panel");
    panel.id = "zs-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "zs-title");

    var head = el("header", "zs-head");
    var titles = el("div");
    var h2 = el("h2", null, cfg.business + " Assistant (automated)");
    h2.id = "zs-title";
    var sub = el("p", null, "Automated assistant — not a person.");
    titles.appendChild(h2);
    titles.appendChild(sub);
    var closer = el("button", "zs-x", "×");
    closer.type = "button";
    closer.setAttribute("aria-label", "Close chat");
    head.appendChild(titles);
    head.appendChild(closer);

    var log = el("div", "zs-log");
    log.setAttribute("role", "log");
    var live = el("div", "zs-sr");
    live.setAttribute("aria-live", "polite");

    var chatView = el("div");
    var compose = el("form", "zs-compose");
    compose.setAttribute("aria-label", "Send a message");
    var box = document.createElement("textarea");
    box.rows = 2;
    box.maxLength = MAX;
    box.required = true;
    box.setAttribute("aria-label", "Your message");
    box.placeholder = "Ask about pricing, timing or what's included";
    var send = el("button", "zs-send", "Send");
    send.type = "submit";
    compose.appendChild(box);
    compose.appendChild(send);
    var fallbackBtn = el("button", "zs-fallback-btn", "Talk to " + cfg.contactName + " / leave your details");
    fallbackBtn.type = "button";
    chatView.appendChild(compose);
    chatView.appendChild(fallbackBtn);

    var formView = el("form", "zs-form");
    formView.hidden = true;
    formView.setAttribute("aria-label", "Leave your details");
    var status = el("div", "zs-status");
    status.hidden = true;
    formView.appendChild(status);
    var hint = el("p", "zs-hint", "Same enquiry inbox as the website form. " + cfg.contactName + " replies by email if you leave one.");
    formView.appendChild(hint);

    function field(labelText, name, tag, type) {
      var label = el("label");
      label.appendChild(el("span", null, labelText));
      var input = document.createElement(tag || "input");
      if (!tag) input.type = type || "text";
      input.name = name;
      input.autocomplete = name === "name" ? "name" : name === "email" ? "email" : name === "phone" ? "tel" : "off";
      if (tag === "textarea") { input.rows = 3; input.maxLength = 2000; }
      label.appendChild(input);
      var err = el("div", "zs-err");
      err.hidden = true;
      label.appendChild(err);
      formView.appendChild(label);
      return { input: input, err: err, label: label };
    }
    var nameF = field("Name", "name");
    var emailF = field("Email", "email", null, "email");
    var phoneF = field("Phone", "phone", null, "tel");
    var messageF = field("Message", "message", "textarea");
    var honey = document.createElement("input");
    honey.name = "company";
    honey.tabIndex = -1;
    honey.autocomplete = "off";
    honey.className = "zs-hp";
    honey.setAttribute("aria-hidden", "true");
    formView.appendChild(honey);
    var submit = el("button", "zs-submit", "Send to " + cfg.contactName);
    submit.type = "submit";
    var back = el("button", "zs-back", "Back to chat");
    back.type = "button";
    formView.appendChild(submit);
    formView.appendChild(back);

    var note = el("p", "zs-note", "Don't send passwords or payment details.");

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(live);
    panel.appendChild(chatView);
    panel.appendChild(formView);
    panel.appendChild(note);
    rootEl.appendChild(launcher);
    rootEl.appendChild(panel);
    document.body.appendChild(rootEl);

    function paint() {
      log.textContent = "";
      messages.forEach(function (m) {
        log.appendChild(el("div", "zs-msg " + (m.role === "user" ? "user" : "bot"), m.content));
      });
      var userCount = messages.filter(function (m) { return m.role === "user"; }).length;
      if (!userCount && !box.disabled) {
        var quick = el("div", "zs-quick");
        ["Pricing", "How it works", "Revisions"].forEach(function (label) {
          var b = el("button", null, label);
          b.type = "button";
          b.addEventListener("click", function () { ask(label === "Pricing" ? "How much does a website cost?" : label === "Revisions" ? "How long do revisions take?" : "How does it work?"); });
          quick.appendChild(b);
        });
        log.appendChild(quick);
      }
      log.scrollTop = log.scrollHeight;
    }

    function setOpen(open) {
      panel.hidden = !open;
      rootEl.classList.toggle("is-open", open);
      launcher.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        paint();
        (formView.hidden ? box : nameF.input).focus();
      } else launcher.focus();
    }

    function showFallback(show) {
      formView.hidden = !show;
      chatView.hidden = show;
      log.hidden = show;
      if (show) nameF.input.focus();
      else { paint(); box.focus(); }
    }

    function ask(content) {
      content = text(content);
      if (!content || box.disabled) return;
      if (content.length > MAX) content = content.slice(0, MAX);
      messages.push({ role: "user", content: content });
      saveHistory(cfg, messages);
      box.value = "";
      paint();
      if (!cfg.endpoint) {
        failLocal("This chat isn't connected yet. You can still leave your details.");
        return;
      }
      box.disabled = true;
      send.disabled = true;
      fallbackBtn.disabled = true;
      var typing = el("div", "zs-typing", "Looking that up…");
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;
      var history = messages.slice(-16).map(function (m) { return { role: m.role, content: m.content }; });
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer = controller && setTimeout(function () { controller.abort(); }, 30000);
      fetch(cfg.endpoint.replace(/\/$/, ""), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller ? controller.signal : undefined
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
          if (!data.reply) throw new Error("Empty reply");
          return data;
        });
      }).then(function (data) {
        messages.push({ role: "assistant", content: String(data.reply) });
        saveHistory(cfg, messages);
        live.textContent = "Assistant: " + data.reply;
        if (data.fallback) fallbackBtn.classList.add("is-on");
      }).catch(function () {
        messages.push({ role: "assistant", content: "Sorry — I couldn't reply just now. Please try again, or use Talk to " + cfg.contactName + " / leave your details." });
        saveHistory(cfg, messages);
      }).then(function () {
        if (timer) clearTimeout(timer);
        box.disabled = false;
        send.disabled = false;
        fallbackBtn.disabled = false;
        paint();
        box.focus();
      });
    }

    function failLocal(message) {
      messages.push({ role: "assistant", content: message });
      saveHistory(cfg, messages);
      paint();
    }

    launcher.addEventListener("click", function () { setOpen(true); });
    closer.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { e.preventDefault(); setOpen(false); }
      if (e.key !== "Tab" || panel.hidden) return;
      var nodes = panel.querySelectorAll("button, textarea, input");
      var list = [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.disabled || node.classList.contains("zs-hp") || node.closest("[hidden]")) continue;
        list.push(node);
      }
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); compose.requestSubmit ? compose.requestSubmit() : send.click(); }
    });
    compose.addEventListener("submit", function (e) {
      e.preventDefault();
      ask(box.value);
    });
    fallbackBtn.addEventListener("click", function () { showFallback(true); });
    back.addEventListener("click", function () { showFallback(false); });

    function clearErrors() {
      [nameF, emailF, phoneF, messageF].forEach(function (f) { f.err.hidden = true; f.err.textContent = ""; });
    }
    formView.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors();
      status.hidden = true;
      var fields = {
        name: nameF.input.value,
        email: emailF.input.value,
        phone: phoneF.input.value,
        message: messageF.input.value,
        company: honey.value
      };
      if (text(fields.company)) {
        status.hidden = false;
        status.className = "zs-status ok";
        status.textContent = "Thanks. Your message has been sent.";
        return;
      }
      var errors = validateEnquiry(fields);
      if (errors.contact) { emailF.err.hidden = false; emailF.err.textContent = errors.contact; }
      if (errors.name) { nameF.err.hidden = false; nameF.err.textContent = errors.name; }
      if (errors.email) { emailF.err.hidden = false; emailF.err.textContent = errors.email; }
      if (errors.phone) { phoneF.err.hidden = false; phoneF.err.textContent = errors.phone; }
      if (errors.message) { messageF.err.hidden = false; messageF.err.textContent = errors.message; }
      if (Object.keys(errors).length) return;
      submit.disabled = true;
      submit.textContent = "Sending…";
      var payload = buildEnquiryPayload(fields, cfg);
      var job;
      if (cfg.enquiry) job = postEnquiry(cfg.enquiry, payload);
      else if (typeof window.sendForm === "function") job = postViaSendForm(cfg, fields);
      else job = Promise.reject(new Error("not connected"));
      job.then(function () {
        status.hidden = false;
        status.className = "zs-status ok";
        status.textContent = "Thanks. Your message is on its way to " + cfg.contactName + ".";
        formView.reset();
        messages.push({ role: "assistant", content: "Your details have been sent to " + cfg.contactName + "." });
        saveHistory(cfg, messages);
      }).catch(function () {
        status.hidden = false;
        status.className = "zs-status bad";
        var mail = cfg.contactEmail ? " Email " + cfg.contactEmail + " if it keeps failing." : "";
        status.textContent = "Sorry — your message could not be sent. Check your connection and try again." + mail;
      }).then(function () {
        submit.disabled = false;
        submit.textContent = "Send to " + cfg.contactName;
      });
    });

    paint();
    if (cfg.start === "open" || cfg.start === "fallback") setOpen(true);
    if (cfg.start === "fallback") showFallback(true);
  }

  return {
    boot: boot,
    buildEnquiryPayload: buildEnquiryPayload,
    validateEnquiry: validateEnquiry,
    postEnquiry: postEnquiry,
    readConfig: readConfig,
    validHex: validHex
  };
});
