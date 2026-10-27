import "./style.css";
import { RESOURCE_LABELS } from "./types/reservation";
import type {
  Reservation,
  ReservationFilter,
  ResourceType,
  TimeSlot,
} from "./types/reservation";
import { ApiError, ReservationApi } from "./services/ReservationApi";
import {
  CLOSING_TIME,
  OPENING_TIME,
  ReservationService,
  filterReservations,
} from "./services/reservationService";
import { isReservationStatus, isResourceType } from "./utils/guards";

const service = new ReservationService(new ReservationApi());

// O que o menu da reserva selecionada está mostrando:
// os botões de ação, o formulário de edição ou o de reagendamento.
type PanelMode = "actions" | "edit" | "reschedule";

// Cópia local das reservas vindas do servidor. Os filtros trabalham em cima dela,
// assim não fazemos uma requisição a cada tecla digitada.
let allReservations: Reservation[] = [];

// Estado da tela. "null" significa "nenhuma".
let selectedId: number | null = null; // reserva aberta (com o menu dentro dela)
let panelMode: PanelMode = "actions";

// Última consulta de horários livres (para atualizar a lista após mudanças)
let lastAvailability: { resource: ResourceType; date: string } | null = null;

// Busca um elemento e garante que ele existe (narrowing de null).
// "root" permite buscar dentro de um trecho (por exemplo, a cópia do menu).
function getElement<T extends HTMLElement>(
  selector: string,
  root: ParentNode = document
): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Elemento não encontrado: ${selector}`);
  }
  return element;
}

const form = getElement<HTMLFormElement>("#reservation-form");
const formResource = getElement<HTMLSelectElement>(
  '#reservation-form select[name="resource"]'
);
const submitButton = getElement<HTMLButtonElement>(
  '#reservation-form button[type="submit"]'
);
const message = getElement<HTMLParagraphElement>("#message");
const list = getElement<HTMLUListElement>("#reservation-list");
const menuTemplate = getElement<HTMLTemplateElement>("#item-menu-template");

const availabilityForm = getElement<HTMLFormElement>("#availability-form");
const availabilityResource = getElement<HTMLSelectElement>("#availability-resource");
const availabilityDate = getElement<HTMLInputElement>("#availability-date");
const availabilityHint = getElement<HTMLParagraphElement>("#availability-hint");
const availabilityList = getElement<HTMLUListElement>("#availability-list");

const filterForm = getElement<HTMLFormElement>("#filter-form");
const filterSearch = getElement<HTMLInputElement>("#filter-search");
const filterResource = getElement<HTMLSelectElement>("#filter-resource");
const filterStatus = getElement<HTMLSelectElement>("#filter-status");
const filterDate = getElement<HTMLInputElement>("#filter-date");
const clearButton = getElement<HTMLButtonElement>("#clear-filters");
const resultCount = getElement<HTMLParagraphElement>("#result-count");

availabilityHint.textContent = `Funcionamento: ${OPENING_TIME} às ${CLOSING_TIME}`;

// Preenche um <select> com todos os locais (a lista vem de RESOURCE_LABELS,
// então adicionar um local novo não exige mexer no HTML).
function populateResourceOptions(select: HTMLSelectElement): void {
  for (const [value, label] of Object.entries(RESOURCE_LABELS)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

populateResourceOptions(formResource);
populateResourceOptions(availabilityResource);
populateResourceOptions(filterResource); // já tem a opção "Todos" no HTML

// Mensagem flutuante: aparece no canto da tela, onde quer que o usuário esteja
// na página, e some sozinha depois de alguns segundos.
let messageTimer: number | undefined;

function showMessage(text: string, type: "error" | "success"): void {
  message.textContent = text;
  message.className = type;

  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => {
    message.textContent = "";
  }, 5000);
}

// O "catch" recebe "unknown". instanceof faz o narrowing:
// se for ApiError, a mensagem é a que escrevemos; senão, uma genérica.
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Ocorreu um erro inesperado.";
}

// Texto de uma reserva, usado no cabeçalho de cada item da lista
function describe(r: Reservation): string {
  let text = `${RESOURCE_LABELS[r.resource]} | ${r.customerName} | ${r.date} ${r.startTime}-${r.endTime} | ${r.status}`;
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

// Preenche um campo de um formulário pelo atributo name.
// namedItem devolve Element | RadioNodeList | null, então o instanceof
// garante que é um input ou select antes de usar .value.
function setField(target: HTMLFormElement, name: string, value: string): void {
  const field = target.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

// ---------- Menu dentro da reserva ----------

// Abre (ou fecha) o menu da reserva clicada. Clicar de novo na mesma fecha.
function selectReservation(id: number): void {
  selectedId = selectedId === id ? null : id;
  panelMode = "actions";
  draw();
}

// Monta o menu da reserva a partir do <template> do HTML.
// importNode cria uma CÓPIA do modelo; cada vez que a lista é redesenhada,
// uma cópia nova é feita (por isso os listeners não se acumulam).
function buildMenu(r: Reservation): HTMLElement {
  const fragment = document.importNode(menuTemplate.content, true);
  const menu = getElement<HTMLDivElement>(".item-menu", fragment);

  const actions = getElement<HTMLDivElement>('[data-role="actions"]', menu);
  const editForm = getElement<HTMLFormElement>('[data-form="edit"]', menu);
  const rescheduleForm = getElement<HTMLFormElement>('[data-form="reschedule"]', menu);

  // Só um dos três blocos aparece por vez
  actions.hidden = panelMode !== "actions";
  editForm.hidden = panelMode !== "edit";
  rescheduleForm.hidden = panelMode !== "reschedule";

  // Reserva cancelada não pode ser editada, reagendada nem cancelada de novo
  const isActive = r.status === "ativa";
  const editButton = getElement<HTMLButtonElement>('[data-action="edit"]', menu);
  const rescheduleButton = getElement<HTMLButtonElement>('[data-action="reschedule"]', menu);
  const cancelButton = getElement<HTMLButtonElement>('[data-action="cancel"]', menu);
  const deleteButton = getElement<HTMLButtonElement>('[data-action="delete"]', menu);
  editButton.hidden = !isActive;
  rescheduleButton.hidden = !isActive;
  cancelButton.hidden = !isActive;

  // Formulários já vêm preenchidos com os dados atuais da reserva
  populateResourceOptions(
    getElement<HTMLSelectElement>('select[name="resource"]', editForm)
  );
  setField(editForm, "customerName", r.customerName);
  setField(editForm, "resource", r.resource);
  setField(editForm, "date", r.date);
  setField(editForm, "startTime", r.startTime);
  setField(editForm, "endTime", r.endTime);
  setField(editForm, "notes", r.notes ?? ""); // sem observação: campo vazio

  setField(rescheduleForm, "date", r.date);
  setField(rescheduleForm, "startTime", r.startTime);
  setField(rescheduleForm, "endTime", r.endTime);

  editButton.addEventListener("click", () => {
    panelMode = "edit";
    draw();
  });
  rescheduleButton.addEventListener("click", () => {
    panelMode = "reschedule";
    draw();
  });
  cancelButton.addEventListener("click", () => {
    void handleCancel(r.id);
  });
  deleteButton.addEventListener("click", () => {
    void handleDelete(r.id);
  });

  // Os dois formulários têm um botão "Voltar"
  for (const formElement of [editForm, rescheduleForm]) {
    getElement<HTMLButtonElement>('[data-action="back"]', formElement).addEventListener(
      "click",
      () => {
        panelMode = "actions";
        draw();
      }
    );
  }

  editForm.addEventListener("submit", (event: SubmitEvent) => {
    void handleEditSubmit(event, r.id, editForm);
  });
  rescheduleForm.addEventListener("submit", (event: SubmitEvent) => {
    void handleRescheduleSubmit(event, r.id, rescheduleForm);
  });

  return menu;
}

// ---------- Desenho da lista ----------

// Só desenha na tela (síncrona): usa a cópia local + filtros atuais
function draw(): void {
  list.replaceChildren(); // limpa a lista

  // Se a reserva aberta não existe mais (foi excluída), fecha o menu
  if (!allReservations.some((r) => r.id === selectedId)) {
    selectedId = null;
    panelMode = "actions";
  }

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
    const isOpen = r.id === selectedId;

    const item = document.createElement("li");
    item.className = `reservation ${r.status}`; // "ativa" ou "cancelada" (usado no CSS)
    if (isOpen) {
      item.classList.add("selected");
    }

    // Só o cabeçalho é clicável; o menu fica abaixo dele, dentro do mesmo item
    const header = document.createElement("div");
    header.className = "item-header";
    header.tabIndex = 0; // permite chegar nele com a tecla Tab
    header.setAttribute("aria-expanded", String(isOpen));
    header.textContent = describe(r);

    header.addEventListener("click", () => selectReservation(r.id));
    header.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") selectReservation(r.id);
    });

    item.append(header);

    if (isOpen) {
      item.append(buildMenu(r)); // o menu "suspenso" nasce dentro da própria reserva
    }

    list.append(item);
  }
}

// Busca os dados no servidor e redesenha. Chamada na abertura da página
// e depois de cada alteração (criar, editar, reagendar, cancelar, excluir).
async function loadReservations(): Promise<void> {
  resultCount.textContent = "Carregando reservas...";

  try {
    allReservations = await service.list();
    draw();
    await refreshAvailability(); // mantém os horários livres atualizados
  } catch (error) {
    resultCount.textContent = "";
    showMessage(getErrorMessage(error), "error");
  }
}

// ---------- Horários disponíveis ----------

// Clicar numa janela livre leva o horário para o formulário de nova reserva
function useSlot(resource: ResourceType, date: string, slot: TimeSlot): void {
  setField(form, "resource", resource);
  setField(form, "date", date);
  setField(form, "startTime", slot.start);
  setField(form, "endTime", slot.end);
  form.scrollIntoView({ behavior: "smooth" });
}

function drawSlots(slots: TimeSlot[], resource: ResourceType, date: string): void {
  availabilityList.replaceChildren();

  if (slots.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Nenhum horário disponível nesta data.";
    availabilityList.append(empty);
    return;
  }

  for (const slot of slots) {
    const item = document.createElement("li");
    item.className = "slot";
    item.tabIndex = 0;
    item.textContent = `${slot.start} às ${slot.end}`;

    item.addEventListener("click", () => useSlot(resource, date, slot));
    item.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") useSlot(resource, date, slot);
    });

    availabilityList.append(item);
  }
}

// Refaz a última consulta (se houver), para refletir criações, edições etc.
async function refreshAvailability(): Promise<void> {
  if (lastAvailability === null) return;

  const { resource, date } = lastAvailability;
  const slots = await service.getAvailableSlots(resource, date);
  drawSlots(slots, resource, date);
}

// ---------- Ações ----------

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

// Envio do formulário de edição que fica dentro da reserva (PUT)
async function handleEditSubmit(
  event: SubmitEvent,
  id: number,
  editForm: HTMLFormElement
): Promise<void> {
  event.preventDefault();

  const data = new FormData(editForm);
  const resource = String(data.get("resource"));

  if (!isResourceType(resource)) {
    showMessage("Local inválido.", "error");
    return;
  }

  const notes = String(data.get("notes") ?? "").trim();
  const saveButton = getElement<HTMLButtonElement>('button[type="submit"]', editForm);
  saveButton.disabled = true;

  try {
    const result = await service.update(id, {
      customerName: String(data.get("customerName")).trim(),
      resource,
      date: String(data.get("date")),
      startTime: String(data.get("startTime")),
      endTime: String(data.get("endTime")),
      notes: notes === "" ? undefined : notes,
    });

    if (!result.ok) {
      showMessage(result.error, "error"); // o formulário continua aberto para corrigir
      return;
    }

    showMessage("Reserva atualizada com sucesso!", "success");
    panelMode = "actions";
    await loadReservations();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  } finally {
    saveButton.disabled = false;
  }
}

// Envio do formulário de reagendamento que fica dentro da reserva (PATCH)
async function handleRescheduleSubmit(
  event: SubmitEvent,
  id: number,
  rescheduleForm: HTMLFormElement
): Promise<void> {
  event.preventDefault();

  const data = new FormData(rescheduleForm);
  const confirmButton = getElement<HTMLButtonElement>(
    'button[type="submit"]',
    rescheduleForm
  );
  confirmButton.disabled = true;

  try {
    const result = await service.reschedule(id, {
      date: String(data.get("date")),
      startTime: String(data.get("startTime")),
      endTime: String(data.get("endTime")),
    });

    if (!result.ok) {
      showMessage(result.error, "error");
      return;
    }

    showMessage("Reserva reagendada com sucesso!", "success");
    panelMode = "actions";
    await loadReservations();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  } finally {
    confirmButton.disabled = false;
  }
}

// ---------- Eventos ----------

availabilityForm.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();

  const resource = availabilityResource.value;
  const date = availabilityDate.value;

  if (!isResourceType(resource)) {
    showMessage("Local inválido.", "error");
    return;
  }
  if (date === "") {
    showMessage("Informe a data para consultar os horários.", "error");
    return;
  }

  try {
    lastAvailability = { resource, date };
    await refreshAvailability();
  } catch (error) {
    showMessage(getErrorMessage(error), "error");
  }
});

// Formulário de NOVA reserva (a edição agora acontece dentro de cada reserva)
form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault(); // impede a página de recarregar

  const data = new FormData(form);
  const resource = String(data.get("resource"));

  if (!isResourceType(resource)) {
    showMessage("Local inválido.", "error");
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