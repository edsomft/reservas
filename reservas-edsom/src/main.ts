import "./style.css";
import type {
  NewReservation,
  Reservation,
  ReservationFilter,
} from "./types/reservation";
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

// Estado da tela. "null" significa "nenhuma".
let selectedId: number | null = null; // reserva selecionada na lista
let editingId: number | null = null; // reserva sendo editada no formulário

// Busca um elemento e garante que ele existe (narrowing de null)
function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Elemento não encontrado: ${selector}`);
  }
  return element;
}

const form = getElement<HTMLFormElement>("#reservation-form");
const formTitle = getElement<HTMLHeadingElement>("#form-title");
const submitButton = getElement<HTMLButtonElement>(
  '#reservation-form button[type="submit"]'
);
const cancelEditButton = getElement<HTMLButtonElement>("#cancel-edit");
const message = getElement<HTMLParagraphElement>("#message");
const list = getElement<HTMLUListElement>("#reservation-list");

const panel = getElement<HTMLDivElement>("#selection-panel");
const panelInfo = getElement<HTMLParagraphElement>("#selection-info");
const editButton = getElement<HTMLButtonElement>("#edit-selected");
const cancelSelectedButton = getElement<HTMLButtonElement>("#cancel-selected");
const deleteSelectedButton = getElement<HTMLButtonElement>("#delete-selected");

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

// Texto de uma reserva, usado na lista e no painel de seleção
function describe(r: Reservation): string {
  let text = `${r.resource} | ${r.customerName} | ${r.date} ${r.startTime}-${r.endTime} | ${r.status}`;
  if (r.notes !== undefined) {
    text += ` | ${r.notes}`; // propriedade opcional tratada
  }
  return text;
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

// ---------- Seleção ----------

// Clicar na reserva selecionada de novo desfaz a seleção
function selectReservation(id: number): void {
  selectedId = selectedId === id ? null : id;
  draw();
}

// Mostra ou esconde o painel de ações conforme a reserva selecionada
function updatePanel(): void {
  const selected = allReservations.find((r) => r.id === selectedId);

  if (selected === undefined) {
    selectedId = null; // a reserva foi excluída (ou nada está selecionado)
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  panelInfo.textContent = `Selecionada: ${describe(selected)}`;

  // Reserva cancelada não pode ser editada nem cancelada de novo
  const isActive = selected.status === "ativa";
  editButton.hidden = !isActive;
  cancelSelectedButton.hidden = !isActive;
}

// ---------- Desenho da lista ----------

// Só desenha na tela (síncrona): usa a cópia local + filtros atuais
function draw(): void {
  list.replaceChildren(); // limpa a lista
  updatePanel();

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
    if (r.id === selectedId) {
      item.classList.add("selected");
    }
    item.tabIndex = 0; // permite chegar nele com a tecla Tab
    item.textContent = describe(r);

    item.addEventListener("click", () => selectReservation(r.id));
    item.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") selectReservation(r.id);
    });

    list.append(item);
  }
}

// Busca os dados no servidor e redesenha. Chamada na abertura da página
// e depois de cada alteração (criar, editar, cancelar, excluir).
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

// ---------- Modo de edição ----------

// Preenche um campo do formulário pelo atributo name.
// namedItem devolve Element | RadioNodeList | null, então o instanceof
// garante que é um input ou select antes de usar .value.
function setField(name: string, value: string): void {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

function startEditing(r: Reservation): void {
  editingId = r.id;

  setField("customerName", r.customerName);
  setField("resource", r.resource);
  setField("date", r.date);
  setField("startTime", r.startTime);
  setField("endTime", r.endTime);
  setField("notes", r.notes ?? ""); // sem observação: campo vazio

  formTitle.textContent = `Editando reserva #${r.id}`;
  submitButton.textContent = "Salvar alterações";
  cancelEditButton.hidden = false;
  message.textContent = "";

  form.scrollIntoView({ behavior: "smooth" }); // leva o usuário até o formulário
}

function stopEditing(): void {
  editingId = null;
  form.reset();
  formTitle.textContent = "Nova reserva";
  submitButton.textContent = "Reservar";
  cancelEditButton.hidden = true;
}

// ---------- Ações ----------

async function handleCancel(id: number): Promise<void> {
  try {
    await service.cancel(id);
    if (editingId === id) stopEditing(); // não dá para editar uma reserva cancelada
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
    if (editingId === id) stopEditing();
    showMessage("Reserva excluída.", "success");
    await loadReservations();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  }
}

// ---------- Eventos ----------

editButton.addEventListener("click", () => {
  const selected = allReservations.find((r) => r.id === selectedId);
  if (selected !== undefined) startEditing(selected);
});

cancelSelectedButton.addEventListener("click", () => {
  if (selectedId !== null) void handleCancel(selectedId);
});

deleteSelectedButton.addEventListener("click", () => {
  if (selectedId !== null) void handleDelete(selectedId);
});

cancelEditButton.addEventListener("click", () => {
  stopEditing();
  message.textContent = "";
});

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault(); // impede a página de recarregar

  const data = new FormData(form);
  const resource = String(data.get("resource"));

  if (!isResourceType(resource)) {
    showMessage("Recurso inválido.", "error");
    return;
  }

  const notes = String(data.get("notes") ?? "").trim();

  const reservationData: NewReservation = {
    customerName: String(data.get("customerName")).trim(),
    resource, // aqui já é ResourceType, graças ao type guard
    date: String(data.get("date")),
    startTime: String(data.get("startTime")),
    endTime: String(data.get("endTime")),
    notes: notes === "" ? undefined : notes,
  };

  // Copia o id para uma constante: durante o await, editingId poderia mudar
  const currentEditingId = editingId;

  submitButton.disabled = true; // evita enviar duas vezes enquanto aguarda o servidor

  try {
    // Mesmo formulário para os dois casos: sem id cria (POST), com id edita (PUT)
    const result =
      currentEditingId === null
        ? await service.create(reservationData)
        : await service.update(currentEditingId, reservationData);

    if (!result.ok) {
      showMessage(result.error, "error"); // TypeScript sabe que .error existe aqui
      return;
    }

    showMessage(
      currentEditingId === null
        ? "Reserva criada com sucesso!"
        : "Reserva atualizada com sucesso!",
      "success"
    );
    stopEditing();
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