# Mapa da Suspeita™

Aplicação estática do funil inicial **Mapa da Suspeita**, criada para publicação no Vercel.

## Fluxo atual

```text
Criativo → teste com 10 perguntas → prévia gratuita → resultado completo por R$ 9,90
```

## Arquivos

- `index.html`: landing page, teste, cálculo, prévia, paywall e resultado em modo protótipo.
- `assets/hero-mapa-da-suspeita.webp`: imagem otimizada da persona.

## Antes de publicar anúncios

1. Criar o produto de R$ 9,90 na Kiwify.
2. Colar a URL do checkout na constante `KIWIFY_CHECKOUT_URL`, no final de `index.html`.
3. Remover o botão **Visualizar resultado no modo protótipo**.
4. Implementar uma liberação real após confirmação de pagamento, preferencialmente por webhook e backend.
5. Publicar política de privacidade e termos de uso.
6. Configurar analytics para início do teste, conclusão, clique no checkout e compra.

## Deploy no Vercel

Importe este repositório no Vercel como projeto estático. Não é necessário definir framework neste MVP.

## Atenção

O JavaScript atual calcula e exibe o resultado no navegador. Ele é adequado para prototipagem, mas não protege conteúdo pago. A versão definitiva precisa validar o pagamento no servidor antes de liberar o resultado completo.
