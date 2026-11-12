// §2.4 / §4.3 item 2 — Content Script: auditoria DOM, interceptação de submit e alertas.

const PHISHING_TITLE = "Site identificado como perigoso";
const PHISHING_MESSAGE =
  "Este domínio consta em listas de ameaças conhecidas (phishing, malware ou engenharia social). Recomendamos abandonar a navegação nesta página.";

const FORM_BLOCK_TITLE = "Envio bloqueado";
const FORM_BLOCK_MESSAGE =
  "O destino deste formulário utiliza HTTP sem criptografia. Seus dados sensíveis não serão transmitidos.";

let pageBlocked = false;

/**
 * §4.3 item 4 — Exibe alerta visual in-page.
 */
function showAlert(title, message, detail, variant = "phishing") {
  if (document.getElementById("guardiao-web-overlay")) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "guardiao-web-overlay";
  overlay.className = "guardiao-overlay";
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-labelledby", "guardiao-alert-title");

  const alertBox = document.createElement("div");
  alertBox.className = `guardiao-alert${variant === "form" ? " guardiao-alert--form" : ""}`;

  const titleEl = document.createElement("h2");
  titleEl.id = "guardiao-alert-title";
  titleEl.className = "guardiao-alert__title";
  titleEl.textContent = title;

  const messageEl = document.createElement("p");
  messageEl.className = "guardiao-alert__message";
  messageEl.textContent = message;

  alertBox.appendChild(titleEl);
  alertBox.appendChild(messageEl);

  if (detail) {
    const detailEl = document.createElement("p");
    detailEl.className = "guardiao-alert__detail";
    detailEl.textContent = detail;
    alertBox.appendChild(detailEl);
  }

  // §4.1 / §4.3 item 4 — Saída do alerta, sem opção de prosseguir com o envio ou a navegação.
  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.className = "guardiao-alert__button";

  if (variant === "form") {
    actionButton.textContent = "Fechar aviso";
    actionButton.addEventListener("click", () => overlay.remove());
  } else {
    actionButton.textContent = "Sair desta página";
    actionButton.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.replace("about:blank");
      }
    });
  }

  alertBox.appendChild(actionButton);

  overlay.appendChild(alertBox);
  document.documentElement.appendChild(overlay);
}

/**
 * §2.2 — Resolve action vazio ou URL relativa dinamicamente.
 * Considera o atributo formaction do botão de envio (que prevalece sobre o action)
 * e a tag <base>, via document.baseURI.
 */
function resolveFormAction(form, submitter) {
  const raw =
    submitter && submitter.hasAttribute("formaction")
      ? submitter.getAttribute("formaction")
      : form.getAttribute("action");

  if (!raw || raw.trim() === "") {
    return document.URL;
  }

  try {
    return new URL(raw, document.baseURI).href;
  } catch {
    return document.URL;
  }
}

/**
 * §2.5 — Verifica se destino do formulário é inseguro (http://).
 */
function isInsecureDestination(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * §2.6 Figura 7 — Bloqueio absoluto se destino HTTP (prevalece sobre aval positivo da API).
 */
function blockFormSubmission(form, destinationUrl) {
  showAlert(
    FORM_BLOCK_TITLE,
    FORM_BLOCK_MESSAGE,
    `Destino: ${destinationUrl}`,
    "form"
  );

  // §4.3 item 4 — Alimenta o contador de formulários bloqueados exibido no popup.
  chrome.runtime
    .sendMessage({
      type: "FORM_BLOCKED",
      hostname: window.location.hostname,
      destination: destinationUrl,
    })
    .catch(() => {});
}

/**
 * §2.2 / §2.5 — Intercepta submit antes dos dados saírem do navegador.
 */
function handleFormSubmit(event) {
  if (pageBlocked) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const destinationUrl = resolveFormAction(form, event.submitter);

  if (isInsecureDestination(destinationUrl)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    blockFormSubmission(form, destinationUrl);
  }
}

/**
 * §2.5 — document.querySelectorAll('form') e registro de listeners.
 * §2.2 — Cobre formulários modificados via JavaScript (capture phase no document).
 */
function auditForms() {
  document.querySelectorAll("form").forEach((form) => {
    if (form.dataset.guardiaoAudited === "true") {
      return;
    }
    form.dataset.guardiaoAudited = "true";
    form.addEventListener("submit", handleFormSubmit, true);
  });
}

/**
 * §4.1 RF1 — Consulta Safe Browsing ao carregar domínio e bloqueio se malicioso.
 */
async function checkCurrentDomain() {
  const pageUrl = window.location.href;

  // §2.4 — Minimização de dados: query string e fragmento não são enviados à API.
  const checkedUrl = window.location.origin + window.location.pathname;

  try {
    // §4.3 item 4 — Reinicia o estado da aba a cada carregamento de página.
    await chrome.runtime.sendMessage({
      type: "PAGE_LOADED",
      hostname: window.location.hostname,
    });

    const response = await chrome.runtime.sendMessage({
      type: "CHECK_URL",
      url: checkedUrl,
      hostname: window.location.hostname,
    });

    if (!response?.success) {
      return;
    }

    const { result } = response;

    if (result.malicious) {
      pageBlocked = true;
      showAlert(PHISHING_TITLE, PHISHING_MESSAGE, `URL: ${pageUrl}`, "phishing");

      document.querySelectorAll("form").forEach((form) => {
        form.addEventListener(
          "submit",
          (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
          },
          true
        );
      });
    }
  } catch (error) {
    console.warn("[Guardião Web] Falha na verificação do domínio:", error);
  }
}

document.addEventListener("submit", handleFormSubmit, true);

auditForms();

// Agrupa mutações em rajada para não varrer o DOM a cada alteração.
let auditTimer = null;
const observer = new MutationObserver(() => {
  if (auditTimer) {
    return;
  }
  auditTimer = setTimeout(() => {
    auditTimer = null;
    auditForms();
  }, 200);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

checkCurrentDomain();
