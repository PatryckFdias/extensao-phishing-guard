// Resumo da aba atual.

const statusCard = document.getElementById("status-card");
const statusLabel = document.getElementById("status-label");
const statusDomain = document.getElementById("status-domain");
const counterCard = document.getElementById("counter-card");
const counterValue = document.getElementById("counter-value");
const counterLabel = document.getElementById("counter-label");
const headerMark = document.querySelector(".header__mark");
const note = document.getElementById("note");

function paintStatus(state, label, domain) {
  statusCard.dataset.state = state;
  statusLabel.textContent = label;
  statusDomain.textContent = domain || "-";
  headerMark.style.background =
    state === "danger" ? "var(--cor-perigo)" : state === "safe" ? "var(--cor-seguro)" : "var(--cor-neutro)";
}

function paintCounter(blockedForms, lastDestination) {
  counterValue.textContent = String(blockedForms);
  counterLabel.textContent =
    blockedForms === 1 ? "formulário inseguro bloqueado" : "formulários inseguros bloqueados";
  counterCard.dataset.state = blockedForms > 0 ? "blocked" : "clean";

  note.textContent =
    blockedForms > 0
      ? `Envio impedido para ${lastDestination || "um destino sem criptografia"}.`
      : "Nenhum envio por HTTP foi detectado nesta página.";
}

async function loadPopupData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    paintStatus("loading", "Sem aba ativa", "-");
    paintCounter(0, null);
    return;
  }

  let fallbackHost = "";
  try {
    fallbackHost = tab.url ? new URL(tab.url).hostname : "";
  } catch {
    fallbackHost = "";
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_TAB_STATE",
    tabId: tab.id,
  });

  const state = response?.state;

  if (!state) {
    paintStatus("loading", "Sem verificação nesta aba", fallbackHost);
    paintCounter(0, null);
    return;
  }

  const domain = state.hostname || fallbackHost;

  if (state.malicious) {
    paintStatus("danger", "Ameaça detectada", domain);
  } else if (state.safeBrowsing === "safe") {
    paintStatus("safe", "Nenhuma ameaça conhecida", domain);
  } else if (state.safeBrowsing === "unknown") {
    paintStatus("loading", "Não foi possível verificar", domain);
  } else {
    paintStatus("loading", "Verificando...", domain);
  }

  paintCounter(state.blockedForms || 0, state.lastBlockedDestination);
}

loadPopupData();
