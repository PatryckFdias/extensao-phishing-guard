# Guardião Web

Extensão para Chrome que consulta o Google Safe Browsing e bloqueia o envio de formulários para destinos HTTP.

Trabalho de Conclusão de Curso em Ciência da Computação, Universidade Tuiuti do Paraná.

**Autores** Patryck Fragoso Dias e João Pedro Neves de Siqueira

**Data** 14/11/2026

## Carregar a extensão

1. Na raiz do projeto, copie `config.example.js` para `config.js`. Abra a cópia e substitua `SUA_API_KEY_AQUI` pela sua chave da API do Google Safe Browsing.
2. No Chrome, abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta do projeto que contém `manifest.json`.

## Abrir as páginas de teste

Execute o comando na raiz do projeto.

```sh
npx http-server test-pages -p 8080
```

Abra `http://localhost:8080` no Chrome e escolha um dos casos. Os resultados esperados e as instruções para o teste de controle estão no [guia de testes](test-pages/LEIA-ME.md).
