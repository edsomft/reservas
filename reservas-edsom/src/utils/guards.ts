import type {
  Reservation,
  ReservationStatus,
  ResourceType,
} from "../types/reservation";

const VALID_RESOURCES: ResourceType[] = ["sala", "quadra", "laboratorio"];
const VALID_STATUSES: ReservationStatus[] = ["ativa", "cancelada"];

// "value is ResourceType" é o type predicate
export function isResourceType(value: string): value is ResourceType {
  return (VALID_RESOURCES as string[]).includes(value);
}

export function isReservationStatus(value: string): value is ReservationStatus {
  return (VALID_STATUSES as string[]).includes(value);
}

// Narrowing de "unknown": o que vem do servidor é dado de fora do programa,
// então não podemos confiar no formato. Verificamos campo a campo.
export function isReservation(value: unknown): value is Reservation {
  if (typeof value !== "object" || value === null) return false;

  const r = value as Record<string, unknown>;

  return (
    typeof r.id === "number" &&
    typeof r.customerName === "string" &&
    typeof r.resource === "string" &&
    isResourceType(r.resource) &&
    typeof r.date === "string" &&
    typeof r.startTime === "string" &&
    typeof r.endTime === "string" &&
    typeof r.status === "string" &&
    isReservationStatus(r.status) &&
    (r.notes === undefined || typeof r.notes === "string")
  );
}

export function isReservationList(value: unknown): value is Reservation[] {
  return Array.isArray(value) && value.every(isReservation);
}
