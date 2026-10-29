import type {
  CreateResult,
  NewReservation,
  Reservation,
  ReservationFilter,
  RescheduleData,
  ResourceType,
  TimeSlot,
  UpdateResult,
} from "../types/reservation";
import type { ReservationApi } from "./ReservationApi";

// "14:30" -> 870 (minutos desde meia-noite). Facilita comparar horários.
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Horário de funcionamento usado para calcular as janelas livres
export const OPENING_TIME = "08:00";
export const CLOSING_TIME = "22:00";

// 870 -> "14:30" (o inverso de toMinutes)
export function toTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isWithinBusinessHours(
  startTime: string,
  endTime: string,
  opening: string = OPENING_TIME,
  closing: string = CLOSING_TIME
): boolean {
  return (
    toMinutes(startTime) >= toMinutes(opening) &&
    toMinutes(endTime) <= toMinutes(closing)
  );
}

export function hasConflict(
  candidate: NewReservation,
  existing: Reservation[],
  ignoreId?: number
): boolean {
  return existing.some(
    (r) =>
      r.id !== ignoreId &&
      r.status === "ativa" &&
      r.resource === candidate.resource &&
      r.date === candidate.date &&
      toMinutes(candidate.startTime) < toMinutes(r.endTime) &&
      toMinutes(candidate.endTime) > toMinutes(r.startTime)
  );
}

// Devolve só as reservas que atendem a TODOS os critérios do filtro
export function filterReservations(
  reservations: Reservation[],
  filter: ReservationFilter
): Reservation[] {
  const search = filter.search.trim().toLowerCase();

  return reservations.filter(
    (r) =>
      (search === "" || r.customerName.toLowerCase().includes(search)) &&
      (filter.resource === "todos" || r.resource === filter.resource) &&
      (filter.status === "todos" || r.status === filter.status) &&
      (filter.date === undefined || r.date === filter.date)
  );
}

export function findAvailableSlots(
  reservations: Reservation[],
  resource: ResourceType,
  date: string,
  opening: string = OPENING_TIME,
  closing: string = CLOSING_TIME
): TimeSlot[] {
  const busy = reservations
    .filter(
      (r) => r.status === "ativa" && r.resource === resource && r.date === date
    )
    .map((r) => ({ start: toMinutes(r.startTime), end: toMinutes(r.endTime) }))
    .sort((a, b) => a.start - b.start); // do mais cedo para o mais tarde

  const closeAt = toMinutes(closing);
  const slots: TimeSlot[] = [];
  let cursor = toMinutes(opening);

  for (const block of busy) {
    if (block.start > cursor && cursor < closeAt) {
      slots.push({
        start: toTime(cursor),
        end: toTime(Math.min(block.start, closeAt)),
      });
    }
    cursor = Math.max(cursor, block.end); // avança até o fim do bloco
  }

  // Sobrou espaço entre o último bloco e o fechamento
  if (cursor < closeAt) {
    slots.push({ start: toTime(cursor), end: toTime(closeAt) });
  }

  return slots;
}

// Regras de negócio. Quem fala com o servidor é a ReservationApi,
// que esta classe recebe pelo construtor (injeção de dependência).
export class ReservationService {
  private readonly api: ReservationApi;

  constructor(api: ReservationApi) {
    this.api = api;
  }

  async list(): Promise<Reservation[]> {
    return this.api.getAll();
  }

  private async validate(
    data: NewReservation,
    ignoreId?: number
  ): Promise<string | null> {
    if (data.customerName === "") {
      return "Informe o nome do cliente.";
    }
    if (toMinutes(data.endTime) <= toMinutes(data.startTime)) {
      return "O horário final deve ser depois do inicial.";
    }
    if (!isWithinBusinessHours(data.startTime, data.endTime)) {
      return `Fora do horário de funcionamento (${OPENING_TIME} às ${CLOSING_TIME}).`;
    }

    const sameDay = await this.api.getAll({
      resource: data.resource,
      date: data.date,
      status: "ativa",
    });

    if (hasConflict(data, sameDay, ignoreId)) {
      return "Conflito: este recurso já está reservado nesse horário.";
    }

    return null;
  }

  async create(data: NewReservation): Promise<CreateResult> {
    const error = await this.validate(data);
    if (error !== null) {
      return { ok: false, error };
    }

    const reservation = await this.api.create({ ...data, status: "ativa" });
    return { ok: true, reservation };
  }

  // Edição (PUT): substitui o registro, mantendo o status que ele já tinha
  async update(id: number, data: NewReservation): Promise<UpdateResult> {
    const current = await this.api.getById(id);

    if (current.status === "cancelada") {
      return { ok: false, error: "Reservas canceladas não podem ser editadas." };
    }

    const error = await this.validate(data, id);
    if (error !== null) {
      return { ok: false, error };
    }

    const reservation = await this.api.update(id, {
      ...data,
      status: current.status,
    });
    return { ok: true, reservation };
  }

    // Reagendar: muda só data e horário (PATCH), com a mesma validação de conflito.
  async reschedule(id: number, newSchedule: RescheduleData): Promise<UpdateResult> {
    const current = await this.api.getById(id);

    if (current.status === "cancelada") {
      return { ok: false, error: "Reservas canceladas não podem ser reagendadas." };
    }

    const isSameSchedule =
      current.date === newSchedule.date &&
      current.startTime === newSchedule.startTime &&
      current.endTime === newSchedule.endTime;

    if (isSameSchedule) {
      return { ok: false, error: "Informe uma data ou horário diferente do atual." };
    }

    // Monta a reserva "como ficaria" e reaproveita a validação de criar/editar.
    const candidate: NewReservation = {
      customerName: current.customerName,
      resource: current.resource,
      notes: current.notes,
      ...newSchedule,
    };

    const error = await this.validate(candidate, id); // ignora a própria reserva
    if (error !== null) {
      return { ok: false, error };
    }

    const reservation = await this.api.patch(id, newSchedule);
    return { ok: true, reservation };
  }

  // Consulta ao servidor as reservas ativas do dia e calcula as janelas livres
  async getAvailableSlots(resource: ResourceType, date: string): Promise<TimeSlot[]> {
    const sameDay = await this.api.getAll({ resource, date, status: "ativa" });
    return findAvailableSlots(sameDay, resource, date);
  }

  // Cancelar muda só o status (PATCH): mantém o histórico
  async cancel(id: number): Promise<void> {
    await this.api.patch(id, { status: "cancelada" });
  }

  // Excluir apaga o registro de vez (DELETE)
  async remove(id: number): Promise<void> {
    await this.api.remove(id);
  }
}
