import type {
  CreateResult,
  NewReservation,
  Reservation,
  ReservationFilter,
} from "../types/reservation";
import type { ReservationApi } from "./ReservationApi";

// "14:30" -> 870 (minutos desde meia-noite). Facilita comparar horários.
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Função pura (não depende de servidor nem de DOM): recebe as reservas existentes
// e diz se o candidato conflita com alguma. Dois intervalos se sobrepõem quando
// A começa antes de B terminar E A termina depois de B começar.
// "ignoreId" será usado na edição/reagendamento: a reserva não conflita consigo mesma.
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

  // Erros de validação (esperados) voltam em CreateResult.
  // Erros de comunicação (ApiError) são lançados e tratados por quem chamou.
  async create(data: NewReservation): Promise<CreateResult> {
    if (data.customerName === "") {
      return { ok: false, error: "Informe o nome do cliente." };
    }
    if (toMinutes(data.endTime) <= toMinutes(data.startTime)) {
      return { ok: false, error: "O horário final deve ser depois do inicial." };
    }

    // Busca no servidor só as reservas ativas do mesmo recurso e data
    // e a regra de conflito continua sendo calculada aqui, em TypeScript.
    const sameDay = await this.api.getAll({
      resource: data.resource,
      date: data.date,
      status: "ativa",
    });

    if (hasConflict(data, sameDay)) {
      return {
        ok: false,
        error: "Conflito: este recurso já está reservado nesse horário.",
      };
    }

    const reservation = await this.api.create({ ...data, status: "ativa" });
    return { ok: true, reservation };
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
