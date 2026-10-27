# Encarte Fácil

Construir uma ferramenta web simples para gerar encartes promocionais de supermercado a partir do link de um produto.

Funcionamento:

O usuário cola a URL da página do produto em um site de supermercado/e-commerce.

O sistema busca a página e extrai automaticamente: nome do produto, descrição, preço e foto principal (usar metadados Open Graph da página como fonte principal, com fallback para o conteúdo da própria página).

Os dados extraídos aparecem em um formulário editável para o usuário conferir e corrigir antes de gerar o encarte. Se algum dado não for encontrado na página, o campo fica vazio para preenchimento manual.

Com os dados confirmados, o sistema monta um encarte com layout fixo e bonito: foto grande do produto, nome em destaque, descrição curta e preço com destaque visual.

Requisitos do encarte:

Layout pronto para impressão (formato otimizado para A4/A5), com botão de imprimir/gerar PDF ou jpg.

Logo e cores da loja configuráveis uma vez (nome da loja, cor principal), salvos no navegador para os próximos encartes.

O usuário pode ajustar o texto da descrição e o destaque do preço antes de imprimir.

Detalhes técnicos:

A busca da página do produto deve ser feita no servidor (server-side) para contornar bloqueios de CORS; se um site bloquear a extração, avisar o usuário com mensagem clara e permitir preenchimento manual.

Imagem do produto: baixar e exibir direto no encarte; produto sem imagem exibe espaço reservado com texto "sem foto".

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/95fba4fa-7c22-4540-be1c-b25860a28d86).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
