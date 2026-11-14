# Páginas de teste: Cenário 2 (auditoria de formulários)

Use estas páginas para testar a auditoria de formulários do Guardião Web
(Cenário 2, Seção 4.5 do TCC). Elas servem apenas aos testes.

## Como servir as páginas

```
npx http-server test-pages -p 8080
```

Depois, abra `http://localhost:8080` no navegador.

## Por que os testes precisam rodar em página HTTP

Nos casos 03 e 04, o navegador usa a URL da página para resolver o `action`
vazio ou relativo. Abra os casos em `http://localhost:8080` para que o destino
seja HTTP. Se você abrir um arquivo pelo explorador (`file://`), o destino muda.
Em `file://`, o Chrome também exige a opção *Permitir acesso a URLs de arquivo*
para injetar o Content Script.

## Teste de controle

Execute cada caso duas vezes. Rode primeiro com a extensão ativa, desative-a em
`chrome://extensions` e repita. Compare os resultados para distinguir o efeito
da extensão do comportamento do navegador ou de uma falha no destino.

Nos casos 09, 10 e 11, confira a aba Rede das ferramentas de desenvolvimento.
O bloqueio de rede não gera alerta na página, e o JavaScript recebe o mesmo
erro de uma falha de rede comum. Com a extensão ativa, procure
`net::ERR_BLOCKED_BY_CLIENT` na requisição e compare com o controle.

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

No caso 11, o manifesto não declara injeção em subquadros. O formulário do
`iframe` depende do bloqueio de rede. Se o envio passar, registre a limitação
conhecida de cobertura do `iframe`.

O caso 12 é o único sem `input type="password"`. A busca pública por GET não
envia credenciais. O destino HTTP basta para a extensão bloquear o envio.
Este caso mede esse falso positivo.
