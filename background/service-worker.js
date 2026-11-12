// §2.4 / §4.3 item 3 — Service Worker: consulta Safe Browsing, cache e decisão híbrida.
import { SAFE_BROWSING_API_KEY } from "../config.js";

const CACHE_TTL_MS = 60 * 60 * 1000; // §2.6 — cache temporário (1 hora, não especificado no doc)
const CACHE_STORAGE_KEY = "safeBrowsingCache";
const TAB_STATE_PREFIX = "tabState:";

// §4.4 — Listas de ameaças consultadas na API v4.
const THREAT_TYPES = ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"];

/**
 * §2.6 Figura 7 / §4.4 — Consulta na nuvem via API Google Safe Browsing.
 * Falhas de rede ou da API não interrompem a extensão: o retorno "unknown"
 * devolve a decisão para a auditoria local do DOM.
 */
async function querySafeBrowsing(url) {
  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SAFE_BROWSING_API_KEY}`;

  const body = {
    client: {
      clientId: "guardiao-web-tcc",
      clientVersion: "1.0.0",
    },
    threatInfo: {
      threatTypes: THREAT_TYPES,
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }],
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn("[Guardião Web] Safe Browsing respondeu", response.status);
      return { status: "unknown", malicious: false };
    }

    const data = await response.json();
    const malicious = Array.isArray(data.matches) && data.matches.length > 0;

    return { status: malicious ? "malicious" : "safe", malicious };
  } catch (error) {
    console.warn("[Guardião Web] Falha na consulta Safe Browsing:", error.message);
    return { status: "unknown", malicious: false };
  }
}

/**
 * §2.6 — Cache local temporário para reduzir chamadas repetidas.
 * A chave é o hash SHA-256 da URL, para não guardar o histórico de navegação em texto puro.
 */
async function cacheKeyFor(url) {
  const data = new TextEncoder().encode(url);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function pruneExpired(cache) {
  const now = Date.now();
  for (const key of Object.keys(cache)) {
    if (now - cache[key].timestamp > CACHE_TTL_MS) {
      delete cache[key];
    }
  }
}

async function getCachedResult(url) {
  const key = await cacheKeyFor(url);
  const stored = await chrome.storage.local.get(CACHE_STORAGE_KEY);
  const cache = stored[CACHE_STORAGE_KEY] || {};
  const entry = cache[key];

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[key];
    await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
    return null;
  }

  return entry.result;
}

async function setCachedResult(url, result) {
  const key = await cacheKeyFor(url);
  const stored = await chrome.storage.local.get(CACHE_STORAGE_KEY);
  const cache = stored[CACHE_STORAGE_KEY] || {};
  pruneExpired(cache);
  cache[key] = { result, timestamp: Date.now() };
  await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
}

/**
 * §2.6 Figura 7 — Modelo de decisão híbrido (consulta nuvem).
 * Malicioso → bloqueio imediato. Seguro/desconhecido → auditoria local decide.
 */
async function evaluateUrl(url) {
  const cached = await getCachedResult(url);
  if (cached) {
    return cached;
  }

  const apiResult = await querySafeBrowsing(url);

  // Resultados inconclusivos não entram em cache, para permitir nova tentativa.
  if (apiResult.status !== "unknown") {
    await setCachedResult(url, apiResult);
  }

  return apiResult;
}

/**
 * §4.3 item 4 — Estado por aba que alimenta o painel do popup.
 */
function emptyTabState(hostname = "") {
  return {
    hostname,
    safeBrowsing: "pending",
    malicious: false,
    blockedForms: 0,
    lastBlockedDestination: null,
    updatedAt: Date.now(),
  };
}

async function readTabState(tabId) {
  const key = TAB_STATE_PREFIX + tabId;
  const stored = await chrome.storage.session.get(key);
  return stored[key] || null;
}

async function writeTabState(tabId, state) {
  const key = TAB_STATE_PREFIX + tabId;
  await chrome.storage.session.set({ [key]: { ...state, updatedAt: Date.now() } });
}

/**
 * §4.3 item 4 — Badge do ícone reflete o número de bloqueios da aba.
 */
async function refreshBadge(tabId, state) {
  const text = state.malicious
    ? "!"
    : state.blockedForms > 0
      ? String(state.blockedForms)
      : "";

  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#c0392b" });
  await chrome.action.setBadgeText({ tabId, text });
}

/**
 * §2.4 — Sistema de mensagens entre Content Script, Service Worker e popup.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.type === "PAGE_LOADED" && tabId !== undefined) {
    (async () => {
      const state = emptyTabState(message.hostname);
      await writeTabState(tabId, state);
      await refreshBadge(tabId, state);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === "CHECK_URL") {
    (async () => {
      try {
        const result = await evaluateUrl(message.url);

        if (tabId !== undefined) {
          const state = (await readTabState(tabId)) || emptyTabState(message.hostname);
          state.hostname = message.hostname || state.hostname;
          state.safeBrowsing = result.status;
          state.malicious = result.malicious;
          await writeTabState(tabId, state);
          await refreshBadge(tabId, state);
        }

        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === "FORM_BLOCKED" && tabId !== undefined) {
    (async () => {
      const state = (await readTabState(tabId)) || emptyTabState(message.hostname);
      state.blockedForms += 1;
      state.lastBlockedDestination = message.destination || null;
      await writeTabState(tabId, state);
      await refreshBadge(tabId, state);
      sendResponse({ success: true, blockedForms: state.blockedForms });
    })();
    return true;
  }

  if (message.type === "GET_TAB_STATE") {
    (async () => {
      const state = await readTabState(message.tabId);
      sendResponse({ success: true, state });
    })();
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(TAB_STATE_PREFIX + tabId);
});
