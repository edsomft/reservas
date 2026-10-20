import type { ReservationStatus, ResourceType } from "../types/reservation";

const VALID_RESOURCES: ResourceType[] = ["sala", "quadra", "laboratorio"];
const VALID_STATUSES: ReservationStatus[] = ["ativa", "cancelada"];

// "value is ResourceType" é o type predicate
export function isResourceType(value: string): value is ResourceType {
  return (VALID_RESOURCES as string[]).includes(value);
}

export function isReservationStatus(value: string): value is ReservationStatus {
  return (VALID_STATUSES as string[]).includes(value);
}
