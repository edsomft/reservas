import type {
  CreateResult,
  NewReservation,
  Reservation,
  ReservationFilter,
} from "../types/reservation";

const reservations: Reservation[] = [];
let nextId = 1;

// "14:30" -> 870 (minutos desde meia-noite). Facilita comparar horários.
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Dois intervalos se sobrepõem quando A começa antes de B terminar
// E A termina depois de B começar.
function hasConflict(data: NewReservation): boolean {
  return reservations.some(
    (r) =>
      r.status === "ativa" &&
      r.resource === data.resource &&
      r.date === data.date &&
      toMinutes(data.startTime) < toMinutes(r.endTime) &&
      toMinutes(data.endTime) > toMinutes(r.startTime)
  );
}

export function createReservation(data: NewReservation): CreateResult {
  if (data.customerName === "") {
    return { ok: false, error: "Informe o nome do cliente." };
  }
  if (toMinutes(data.endTime) <= toMinutes(data.startTime)) {
    return { ok: false, error: "O horário final deve ser depois do inicial." };
  }
  if (hasConflict(data)) {
    return {
      ok: false,
      error: "Conflito: este recurso já está reservado nesse horário.",
    };
  }

  const reservation: Reservation = { ...data, id: nextId++, status: "ativa" };
  reservations.push(reservation);
  return { ok: true, reservation };
}

export function listReservations(): Reservation[] {
  return [...reservations]; // cópia, para ninguém alterar o array original por fora
}

// Devolve só as reservas que atendem a TODOS os critérios do filtro
export function filterReservations(filter: ReservationFilter): Reservation[] {
  const search = filter.search.trim().toLowerCase();

  return reservations.filter(
    (r) =>
      (search === "" || r.customerName.toLowerCase().includes(search)) &&
      (filter.resource === "todos" || r.resource === filter.resource) &&
      (filter.status === "todos" || r.status === filter.status) &&
      (filter.date === undefined || r.date === filter.date)
  );
}

export function cancelReservation(id: number): boolean {
  const found = reservations.find((r) => r.id === id);
  if (found === undefined) return false; // narrowing: depois disso, found é Reservation
  found.status = "cancelada";
  return true;
}


