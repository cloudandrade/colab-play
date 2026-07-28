# CoLab Play

Playlist colaborativa: crie collabs, busque músicas e toque a fila em sequência.

## Stack

- **Next.js** (App Router) + TypeScript
- **MongoDB** (Mongoose) — collabs, faixas e senha hasheada
- **YouTube** — busca (Piped) + player IFrame

## Banco de dados

Estrutura na collection `collabs`:

- `id`, `name`, `isOpen`
- `passwordHash` (scrypt, só em collabs fechadas)
- `createdAt`, `updatedAt`
- `tracks[]` embutidas (`id` do YouTube, título, artista, capa, duração, etc.)

### Subir Mongo local

```bash
npm run db:up
```

Confira `MONGODB_URI` no `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/colabplay
```

## Como rodar

```bash
npm install
npm run db:up
cp .env.example .env   # se ainda não tiver
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Fluxo

1. Na home, veja as collabs ou clique em **Criar collab**.
2. Informe o nome; se for privada, defina a senha.
3. Collab pública: entra e adiciona músicas livremente.
4. Collab privada: senha libera a sala (cookie httpOnly).

## API

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/collabs` | GET/POST | Lista / cria collabs |
| `/api/collabs/[id]` | GET | Detalhe (tracks só com acesso) |
| `/api/collabs/[id]/unlock` | POST | Desbloqueia collab fechada |
| `/api/collabs/[id]/tracks` | POST/DELETE | Adiciona / remove faixa |
| `/api/search?q=` | GET | Autocomplete YouTube |
