// Union types: só estes valores são permitidos
export type ResourceType = "sala" | "quadra" | "laboratorio";
export type ReservationStatus = "ativa" | "cancelada";

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

// Resultado de criar: ou deu certo, ou deu erro com mensagem
export type CreateResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; error: string };
