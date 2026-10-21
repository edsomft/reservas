import "./style.css";
import type { Reservation, ReservationFilter } from "./types/reservation";
import { ApiError, ReservationApi } from "./services/ReservationApi";
import {
  ReservationService,
  filterReservations,
} from "./services/reservationService";
import { isReservationStatus, isResourceType } from "./utils/guards";

const service = new ReservationService(new ReservationApi());

// Cópia local das reservas vindas do servidor. Os filtros trabalham em cima dela,
// assim não fazemos uma requisição a cada tecla digitada.
let allReservations: Reservation[] = [];

// Busca um elemento e garante que ele existe (narrowing de null)
function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Elemento não encontrado: ${selector}`);
  }
  return element;
}

const form = getElement<HTMLFormElement>("#reservation-form");
const submitButton = getElement<HTMLButtonElement>(
  '#reservation-form button[type="submit"]'
);
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

// O "catch" recebe "unknown". instanceof faz o narrowing:
// se for ApiError, a mensagem é a que escrevemos; senão, uma genérica.
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Ocorreu um erro inesperado.";
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

// Só desenha na tela (síncrona): usa a cópia local + filtros atuais
function draw(): void {
  list.replaceChildren(); // limpa a lista

  const results = filterReservations(allReservations, readFilter());

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
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "btn btn-warning";
      cancelButton.textContent = "Cancelar";
      cancelButton.addEventListener("click", () => {
        void handleCancel(r.id);
      });
      item.append(cancelButton);
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => {
      void handleDelete(r.id);
    });
    item.append(deleteButton);

    list.append(item);
  }
}

// Busca os dados no servidor e redesenha. Chamada na abertura da página
// e depois de cada alteração (criar, cancelar, excluir).
async function loadReservations(): Promise<void> {
  resultCount.textContent = "Carregando reservas...";

  try {
    allReservations = await service.list();
    draw();
  } catch (error) {
    resultCount.textContent = "";
    showMessage(getErrorMessage(error), "error");
  }
}

async function handleCancel(id: number): Promise<void> {
  try {
    await service.cancel(id);
    showMessage("Reserva cancelada.", "success");
    await loadReservations();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  }
}

async function handleDelete(id: number): Promise<void> {
  if (!confirm("Excluir esta reserva definitivamente?")) return;

  try {
    await service.remove(id);
    showMessage("Reserva excluída.", "success");
    await loadReservations();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  }
}

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault(); // impede a página de recarregar

  const data = new FormData(form);
  const resource = String(data.get("resource"));

  if (!isResourceType(resource)) {
    showMessage("Recurso inválido.", "error");
    return;
  }

  const notes = String(data.get("notes") ?? "").trim();

  submitButton.disabled = true; // evita enviar duas vezes enquanto aguarda o servidor

  try {
    const result = await service.create({
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
    await loadReservations();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  } finally {
    submitButton.disabled = false; // roda sempre, com sucesso ou erro
  }
});

// "input" dispara a cada digitação (texto) e a cada mudança (select/data),
// e como o evento "borbulha" até o <form>, um único listener cobre todos os filtros.
filterForm.addEventListener("input", () => {
  draw(); // só redesenha a cópia local, sem ir ao servidor
});

clearButton.addEventListener("click", () => {
  filterForm.reset();
  draw();
});

void loadReservations();
