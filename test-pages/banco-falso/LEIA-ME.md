# Banco falso (Bradesco) — simulação de phishing para o TCC

Página de **simulação acadêmica** que imita a tela de acesso do Bradesco, usada
para demonstrar, no Cenário 2 (auditoria de formulários), a diferença entre ter
e não ter a extensão Guardião Web instalada.

> **Aviso.** Esta pasta não é um site oficial. Serve apenas à demonstração do
> próprio autor, com dados dele mesmo. Não deve ser publicada na internet nem
> usada para coletar dados de terceiros.

## O que ela demonstra

- **Com a extensão ligada:** o formulário envia os dados para um destino HTTP.
  A extensão audita o envio, detecta o protocolo inseguro e **bloqueia**,
  exibindo o alerta "Envio bloqueado". Nenhum dado sai do navegador.
- **Com a extensão desligada:** o envio chega ao coletor local (o "servidor do
  golpista"), que grava as credenciais em um arquivo `.txt` numa pasta do
  computador, imitando o roubo real.

> A detecção por URL (o alerta "Site identificado como perigoso", do Cenário 1)
> não se aplica aqui, porque depende do Google Safe Browsing, que não classifica
> páginas servidas em `localhost`. Neste caso falso, quem protege é a auditoria
> do formulário.

## Como executar

Um único terminal:

```
node "D:\User\Documentos\TCC\extensao-phishing-guard\test-pages\banco-falso\coletor.js"
```

Depois abra no navegador:

- Site de login: `http://localhost:9000/`
- E-mail em página web: `http://localhost:9000/email-falso.html`

## Roteiro do vídeo (e-mail -> site -> roubo ou bloqueio)

1. Com o coletor ligado, dê um duplo clique em
   `aviso-seguranca-bradesco.eml`. O Outlook ou o app de e-mail do Windows
   abre a mensagem como se ela tivesse chegado na caixa de entrada.
2. Clique em **Confirmar meus dados**. O navegador abre o site falso.
   Passe o mouse no link antes de clicar: o texto mostra
   `https://banco.bradesco.com.br/acesso-seguro`, mas o destino real é
   `http://localhost:9000/`.
3. **Extensão ligada:** preencher CPF, agência, conta e senha, clicar em
   "Entrar". Deve aparecer o alerta de bloqueio. Confirmar na aba Rede que a
   requisição aparece como `net::ERR_BLOCKED_BY_CLIENT`, e que **nenhum**
   arquivo novo apareceu na pasta de destino.
4. **Extensão desligada:** repetir o envio. O navegador vai para a página
   "Dados capturados", que mostra o caminho do arquivo. Abrir a pasta e mostrar
   o `.txt` com as credenciais.

## Onde o arquivo é gravado

Em `D:\User\Documentos\TCC\roubados`. Para mudar, edite a constante
`PASTA_DESTINO` no início de `coletor.js`.
