# Fandex

**Collect across formats — organized by universe and character.**

Fandex is a collection app for fans who collect comics, manga, fantasy books, premium figures and LEGO. Instead of one app per product type, it connects everything you own the way you think about it: "everything I own from Middle-earth / Batman / One Piece."

> 🚧 Early development — Stage 1 (MVP: books, search, ISBN scan).

## Repository layout

```
apps/
  mobile/        Expo app — iOS, Android and web from one codebase (Stage 1, Task 1)
packages/
  core/          Platform-agnostic TypeScript: domain model, ISBN utilities, catalog adapters
```

This is an npm-workspaces monorepo. `packages/core` is shared by the app now and by the backend later.

## Getting started

Requirements: Node 24+ (see `.nvmrc`) and npm.

```bash
npm install
npm test
```

| Script              | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run typecheck` | TypeScript check in every workspace |
| `npm run lint`      | ESLint in every workspace           |
| `npm test`          | Jest in every workspace             |
| `npm run format`    | Format the repo with Prettier       |

## Roadmap

1. **MVP**: add books by search or ISBN scan, collection with covers (iPhone + web)
2. **Real backend**: accounts, cloud sync, unified catalog search
3. **Universe layer**: franchise/character pages across categories
4. **AI**: shelf-photo import, ask your collection
5. **Pre-orders & releases**: release tracking and notifications
6. **Launch**
