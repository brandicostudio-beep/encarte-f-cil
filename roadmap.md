# Roadmap

- [x] Fix build errors blocking publish (missing jspdf + strict TS errors)
- [x] Link Google Drive connection to project + route app calls via connector gateway
- [x] Fix last failing test + confirm build OK (62/62 tests pass, build OK)

## Editor 9:16 — correções e recursos estilo Canva (brief detalhado do usuário)
- [x] Inventário das funções atuais de edição (checklist de regressão)
- [x] Bug 1: redimensionar foto não pode alterar o box do card (overflow oculto, imagem centralizada, proporção mantida)
- [x] Bug 2: restaurar ajustes em massa com escopos (este item / página / encarte / textos do mesmo tipo) + presets salvos
- [x] Bug 3: slider de tamanho da foto no painel, com campo numérico, sincronizado com o canvas
- [x] Varredura de bugs na aba de edição (listar causa + arquivo antes de corrigir)
- [x] Novos: seleção por clique e múltipla (Shift/Ctrl), alças de redimensionamento, arrasto + setas, guias de alinhamento/snap
- [x] Novos: painel de propriedades contextual (texto/foto/preço/box/barras)
- [x] Novos: camadas (ordem, ocultar, bloquear), duplicar/excluir/copiar/colar, Ctrl+Z/Ctrl+Y, painel de atalhos
- [x] Regras: boxes brancos separados, fotos sem sombra, nada cortado na prévia/editor/exportação, sobras centralizadas
- [x] Dados: autosave, persistência, migração sem perda, confirmar antes de descartar
- [x] Testes obrigatórios do brief (localStorage vazio/antigo, 10/12/1/2 produtos, fotos variadas, nomes longos, exportação, mobile/desktop)
- [x] Entrega: lista de bugs (causa+arquivo), recursos novos, checklist de regressão, o que não foi testado
