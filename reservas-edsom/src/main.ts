import "./style.css";
import type { ReservationFilter } from "./types/reservation";
import {
  cancelReservation,
  createReservation,
  filterReservations,
} from "./services/reservationService";
import { isReservationStatus, isResourceType } from "./utils/guards";

// Busca um elemento e garante que ele existe (narrowing de null)
function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Elemento não encontrado: ${selector}`);
  }
  return element;
}

const form = getElement<HTMLFormElement>("#reservation-form");
const message = getElement<HTMLParagraphElement>("#message");
const list = getElement<HTMLUListElement>("#reservation-list");

const filterForm = getElement<HTMLFormElement>("#filter-form");
const filterSearch = getElement<HTMLInputElement>("#filter-search");
const filterResource = getElement<HTMLSelectElement>("#filter-resource");
const filterStatus = getElement<HTMLSelectElement>("#filter-status");
const filterDate = getElement<HTMLInputElement>("#filter-date");
const clearButton = getElement<HTMLButtonElement>("#clear-filters");
const resultCount = getElement<HTMLParagraphElement>("#result-count");

function showMessage(text: string, type: "error" | "success"): void {
  message.textContent = text;
  message.className = type;
}

// Lê os campos de filtro e monta um objeto tipado.
// O .value de um <select> é sempre string, então usamos narrowing para
// provar ao TypeScript que é "todos" ou um valor válido.
function readFilter(): ReservationFilter {
  const resourceValue = filterResource.value;
  const statusValue = filterStatus.value;

  return {
    search: filterSearch.value,
    resource:
      resourceValue === "todos" || isResourceType(resourceValue)
        ? resourceValue
        : "todos",
    status:
      statusValue === "todos" || isReservationStatus(statusValue)
        ? statusValue
        : "todos",
    date: filterDate.value === "" ? undefined : filterDate.value,
  };
}

function render(): void {
  list.replaceChildren(); // limpa a lista

  const results = filterReservations(readFilter());

  resultCount.textContent =
    results.length === 1
      ? "1 reserva encontrada"
      : `${results.length} reservas encontradas`;

  if (results.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Nenhuma reserva encontrada.";
    list.append(empty);
    return;
  }

  for (const r of results) {
    const item = document.createElement("li");
    item.className = r.status; // "ativa" ou "cancelada" (usado no CSS)
    item.textContent = `${r.resource} | ${r.customerName} | ${r.date} ${r.startTime}-${r.endTime} | ${r.status}`;

    if (r.notes !== undefined) {
      item.textContent += ` | ${r.notes}`; // propriedade opcional tratada
    }

    if (r.status === "ativa") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-danger";
      button.textContent = "Cancelar";
      button.addEventListener("click", () => {
        cancelReservation(r.id);
        render();
      });
      item.append(button);
    }

    list.append(item);
  }
}

form.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault(); // impede a página de recarregar

  const data = new FormData(form);
  const resource = String(data.get("resource"));

  if (!isResourceType(resource)) {
    showMessage("Recurso inválido.", "error");
    return;
  }

  const notes = String(data.get("notes") ?? "").trim();

  const result = createReservation({
    customerName: String(data.get("customerName")).trim(),
    resource, // aqui já é ResourceType, graças ao type guard
    date: String(data.get("date")),
    startTime: String(data.get("startTime")),
    endTime: String(data.get("endTime")),
    notes: notes === "" ? undefined : notes,
  });

  if (!result.ok) {
    showMessage(result.error, "error"); // TypeScript sabe que .error existe aqui
    return;
  }

  showMessage("Reserva criada com sucesso!", "success");
  form.reset();
  render();
});

// "input" dispara a cada digitação (texto) e a cada mudança (select/data),
// e como o evento "borbulha" até o <form>, um único listener cobre todos os filtros.
filterForm.addEventListener("input", () => {
  render(); // a leitura dos valores é feita direto nos campos, em readFilter()
});

clearButton.addEventListener("click", () => {
  filterForm.reset();
  render();
});

render();
