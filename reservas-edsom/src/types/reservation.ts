// Union types: só estes valores são permitidos
export type ResourceType =
  | "sala-1"
  | "sala-2"
  | "sala-3"
  | "quadra-1"
  | "quadra-2"
  | "quadra-3"
  | "laboratorio-1"
  | "laboratorio-2"
  | "laboratorio-3";

// Nome exibido de cada local. Record<ResourceType, string> OBRIGA a ter uma entrada
// para cada valor do union: se um local for adicionado ao tipo e esquecido aqui,
// o TypeScript acusa erro.
export const RESOURCE_LABELS: Record<ResourceType, string> = {
  "sala-1": "Sala 1",
  "sala-2": "Sala 2",
  "sala-3": "Sala 3",
  "quadra-1": "Quadra 1",
  "quadra-2": "Quadra 2",
  "quadra-3": "Quadra 3",
  "laboratorio-1": "Laboratório 1",
  "laboratorio-2": "Laboratório 2",
  "laboratorio-3": "Laboratório 3",
};
export type ReservationStatus = "ativa" | "cancelada";
export type UpdateResult = CreateResult;

export interface Reservation {
  id: number;
  customerName: string;
  resource: ResourceType;
  date: string; // formato "2026-10-23"
  startTime: string; // formato "14:00"
  endTime: string; // formato "15:30"
  status: ReservationStatus;
  notes?: string; // opcional: o "?" permite não informar
}

// O que o usuário envia ao criar (id e status são gerados pelo sistema)
export type NewReservation = Omit<Reservation, "id" | "status">;

// O que é enviado ao servidor (JSON Server): tudo, menos o id, que ele gera
export type ReservationPayload = Omit<Reservation, "id">;

// Resultado de criar: ou deu certo, ou deu erro com mensagem
export type CreateResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; error: string };

// Só os campos que mudam num reagendamento
export type RescheduleData = Pick<Reservation, "date" | "startTime" | "endTime">;

// Uma janela de tempo livre
export interface TimeSlot {
  start: string; // "08:00"
  end: string; // "10:00"
}

// Tipo genérico: o valor do filtro é um valor real OU "todos" (sem filtrar)
export type FilterValue<T> = T | "todos";

// Critérios da consulta. "date" é opcional: sem data, não filtra por data.
export interface ReservationFilter {
  search: string; // texto digitado para buscar pelo nome do cliente
  resource: FilterValue<ResourceType>;
  status: FilterValue<ReservationStatus>;
  date?: string;
}
