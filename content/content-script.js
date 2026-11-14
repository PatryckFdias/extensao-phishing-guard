const PHISHING_TITLE = "Site identificado como perigoso";
const PHISHING_MESSAGE =
  "Este domínio aparece em listas de phishing, malware ou engenharia social. Recomendamos sair desta página.";

const FORM_BLOCK_TITLE = "Envio bloqueado";
const FORM_BLOCK_MESSAGE =
  "Este formulário tenta enviar dados por HTTP, sem criptografia. O envio foi bloqueado.";

let pageBlocked = false;

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

// O formaction do botão tem prioridade. Para caminhos relativos, vale a base da página.
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

function isInsecureDestination(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// Destino HTTP bloqueia o envio mesmo com parecer favorável da API (§2.6, Figura 7).
function blockFormSubmission(form, destinationUrl) {
  showAlert(
    FORM_BLOCK_TITLE,
    FORM_BLOCK_MESSAGE,
    `Destino: ${destinationUrl}`,
    "form"
  );

  chrome.runtime
    .sendMessage({
      type: "FORM_BLOCKED",
      hostname: window.location.hostname,
      destination: destinationUrl,
    })
    .catch(() => {});
}

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

function auditForms() {
  document.querySelectorAll("form").forEach((form) => {
    if (form.dataset.guardiaoAudited === "true") {
      return;
    }
    form.dataset.guardiaoAudited = "true";
    form.addEventListener("submit", handleFormSubmit, true);
  });
}

async function checkCurrentDomain() {
  const pageUrl = window.location.href;

  // A API recebe só a origem e o caminho.
  const checkedUrl = window.location.origin + window.location.pathname;

  try {
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
