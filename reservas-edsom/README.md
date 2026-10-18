# Sistema de Reservas

Mini-projeto de TypeScript (Atividade Prática) desenvolvido por **Edsom**.

Aplicação web para **criar, consultar e cancelar reservas**, verificando **conflitos de horário** para o mesmo recurso.

## Tecnologias

- HTML e CSS
- TypeScript (sem framework)
- Vite

## Como rodar

```bash
npm install
npm run dev
```

Para verificar os tipos e gerar o build: `npm run build`.

## Estrutura de pastas

```
├── docs/
│   └── RELATORIO_IA.md          # relatório de uso de IA
├── src/
│   ├── types/reservation.ts     # interfaces e types (modelagem)
│   ├── services/reservationService.ts  # regras de negócio
│   ├── utils/guards.ts          # type guards (narrowing)
│   ├── main.ts                  # DOM e eventos
│   └── style.css
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
| Funções tipadas | `reservationService.ts` |
| Arrays e objetos tipados | `reservations: Reservation[]` |
| Narrowing | `isResourceType`, `CreateResult` (`ok`) |
| DOM tipado | `querySelector<HTMLFormElement>`, `SubmitEvent` |
| Módulos | `import` / `export` entre arquivos |

## Status

Checkpoint 1: estrutura inicial, tipos, regras de criação/cancelamento com verificação de conflito e interface básica.
