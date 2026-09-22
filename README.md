# Central Pedido

Sistema de pedidos criado para substituir as planilhas impressas da Casa das Mangueiras.

## Recursos

- 19.634 produtos únicos no catálogo mestre, incluindo Force Line, Jamaica, Tubo PU, Sucção e Bariflex
- Importação de novas planilhas XLSX, XLS e CSV com conferência e bloqueio de duplicidades
- Módulo integrado de balanço de estoque usando o mesmo catálogo mestre
- Lançamentos de contagem física, divergências, situação e ações realizadas
- Setores, responsáveis, andamento e produtividade diária
- Exportação CSV e backup JSON do balanço
- Login seguro e sincronização pelo Supabase
- Banco compartilhado entre computadores e celulares
- Restrição única no banco para impedir produtos duplicados
- Busca por produto, código, medida e fornecedor
- Filtros por fornecedor e categoria
- Controle de estoque e quantidade a pedir
- Fotos dos produtos e troca de imagem
- Rascunhos e histórico de pedidos
- Exportação em PDF e XLSX
- Impressão direta
- Layout responsivo para computador, tablet e celular

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Publicar na Vercel

1. Envie esta pasta para um repositório no GitHub.
2. Na Vercel, escolha **Add New > Project**.
3. Importe o repositório.
4. Mantenha o framework **Next.js** e clique em **Deploy**.

O projeto está conectado ao Supabase. No primeiro acesso, crie a conta do administrador; o sistema cria a organização Casa das Mangueiras e migra o catálogo mestre. Configure na Vercel as variáveis descritas em `.env.example`.
