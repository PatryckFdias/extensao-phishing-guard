# Páginas de teste — Cenário 2 (auditoria de formulários)

Casos de validação da extensão Guardião Web, referentes ao Cenário 2 descrito na
Seção 4.5 do TCC. Nenhum arquivo desta pasta faz parte da extensão: são apenas
páginas de apoio aos testes.

## Como servir as páginas

```
npx http-server test-pages -p 8080
```

Depois, abra `http://localhost:8080` no navegador.

## Por que os testes precisam rodar em página HTTP

Abrir os arquivos diretamente pelo explorador, no esquema `file://`, invalida
parte dos casos. O Chrome não injeta Content Scripts em `file://` sem que a
opção *Permitir acesso a URLs de arquivo* esteja ativada na página da extensão.
Além disso, os casos 03 e 04 dependem de um destino resolvido contra a URL da
página: só servida por `http://localhost:8080` é que o `action` vazio ou
relativo resulta em um endereço HTTP, que é exatamente o que se quer auditar.

## Teste de controle

Cada caso deve ser executado duas vezes: uma com a extensão ativa e outra com
ela desativada em `chrome://extensions`. Sem essa comparação não é possível
afirmar que o comportamento observado veio da ferramenta, e não do próprio
navegador ou da indisponibilidade do destino.

A comparação é indispensável nos casos 09, 10 e 11, nos quais o bloqueio ocorre
na camada de rede e não produz alerta visual. Nesses casos, a mensagem de erro
exibida na página é idêntica com ou sem a extensão, porque o JavaScript não
distingue um bloqueio de uma falha de rede comum. A confirmação é feita na aba
Rede das ferramentas de desenvolvimento: com a extensão ativa, a requisição
aparece como `net::ERR_BLOCKED_BY_CLIENT`.

## Lista de casos

| Arquivo | O que testa | Esperado |
| --- | --- | --- |
| `caso-00-basico.html` | Os três cenários originais em uma página | Permite, bloqueia e bloqueia |
| `caso-01-action-https.html` | `action` HTTPS | Permite |
| `caso-02-action-http-absoluto.html` | `action` HTTP absoluto | Bloqueia (Content Script) |
| `caso-03-action-vazio.html` | `action` vazio | Bloqueia (Content Script) |
| `caso-04-action-relativo.html` | `action` relativo | Bloqueia (Content Script) |
| `caso-05-action-alterado-js.html` | `action` trocado no clique | Bloqueia (Content Script) |
| `caso-06-form-dinamico.html` | Formulário criado após 2 s | Bloqueia (Content Script) |
| `caso-07-formaction-botao.html` | `formaction` HTTP no botão | Bloqueia (Content Script) |
| `caso-08-envio-com-enter.html` | Submissão pela tecla Enter | Bloqueia (Content Script) |
| `caso-09-form-submit-programatico.html` | `form.submit()` por JavaScript | Bloqueia (rede, sem alerta) |
| `caso-10-fetch-xhr.html` | `fetch()` e `XMLHttpRequest` | Bloqueia (rede, sem alerta) |
| `caso-11-iframe-srcdoc.html` | Formulário em `iframe` | Bloqueia; se passar, é limitação |
| `caso-12-busca-get-sem-senha.html` | Busca GET sem dado sensível | Bloqueia; mede falso positivo |

## Observações sobre dois casos

O caso 11 depende de a extensão alcançar o conteúdo do `iframe`. Como o manifesto
não declara injeção em subquadros, o Content Script tende a não auditar esse
formulário, restando o bloqueio pela camada de rede. Se o envio for concluído, o
resultado deve ser registrado como limitação conhecida, e não como falha do teste.

O caso 12 é o único sem `input type="password"`, por definição: a ausência do
campo sensível é justamente o que está sendo avaliado. Uma busca pública por GET
não expõe credenciais, mas é bloqueada do mesmo modo, porque a decisão da
ferramenta considera o protocolo do destino e não o tipo de dado enviado.
