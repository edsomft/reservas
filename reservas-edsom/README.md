# Sistema de Reservas

Mini-projeto de TypeScript (Atividade Prática) desenvolvido por **Edsom**.

Aplicação web para **criar, consultar, editar, cancelar e excluir reservas**, verificando **conflitos de horário** para o mesmo recurso. Os dados são persistidos em um **JSON Server** (API REST simulada) e acessados com `fetch`.

## Tecnologias

- HTML e CSS
- TypeScript (sem framework)
- Vite
- JSON Server 0.17.4 (API REST simulada a partir do arquivo `db.json`)

## Como rodar

É preciso rodar **dois servidores**, cada um em um terminal:

```bash
# 1. Instalar as dependências (uma vez)
npm install

# 2. Terminal 1: API (JSON Server) em http://localhost:3000
npm run api

# 3. Terminal 2: aplicação (Vite) em http://localhost:5173
npm run dev
```

Para verificar os tipos e gerar o build: `npm run build`.

Os dados ficam no arquivo `db.json`. Para testar a API direto no navegador: `http://localhost:3000/reservations`.

## Estrutura de pastas

```
├── docs/
│   └── RELATORIO_IA.md          # relatório de uso de IA
├── src/
│   ├── types/reservation.ts     # interfaces e types (modelagem)
│   ├── services/
│   │   ├── ReservationApi.ts    # classe HTTP (fetch: GET, POST, PUT, PATCH, DELETE)
│   │   └── reservationService.ts  # regras de negócio
│   ├── utils/guards.ts          # type guards (narrowing)
│   ├── main.ts                  # DOM e eventos
│   └── style.css
├── db.json                      # banco de dados do JSON Server
├── index.html
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## Requisitos de TypeScript demonstrados

| Requisito | Onde |
|---|---|
| `interface` e `type` | `Reservation`, `NewReservation` |
| Union types | `ResourceType`, `ReservationStatus` |
| Propriedade opcional | `notes?: string` |
| Funções tipadas | `reservationService.ts`, métodos de `ReservationApi` |
| Orientação a objetos | classe `ReservationApi` (e `ApiError`) |
| Assincronicidade e erros | `async/await`, `response.ok` e `ApiError` em `ReservationApi.ts` |
| Arrays e objetos tipados | `reservations: Reservation[]` |
| Narrowing | `isResourceType`, `isReservation` (`unknown`), `CreateResult` (`ok`) |
| DOM tipado | `querySelector<HTMLFormElement>`, `SubmitEvent` |
| Módulos | `import` / `export` entre arquivos |

## Status

- Checkpoint 1: estrutura inicial, tipos, regras de criação/cancelamento com verificação de conflito e interface básica.
- Filtros e busca de reservas.
- Requisito surpresa, etapa 1: JSON Server, `db.json` e classe `ReservationApi` (a interface ainda será integrada à API nas próximas etapas).
