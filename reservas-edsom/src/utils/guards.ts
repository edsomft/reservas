import type { ResourceType } from "../types/reservation";

const VALID_RESOURCES: ResourceType[] = ["sala", "quadra", "laboratorio"];

// "value is ResourceType" é o type predicate
export function isResourceType(value: string): value is ResourceType {
  return (VALID_RESOURCES as string[]).includes(value);
}
