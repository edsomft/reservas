import "./style.css";
import {
  cancelReservation,
  createReservation,
  listReservations,
} from "./services/reservationService";
import { isResourceType } from "./utils/guards";

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

function showMessage(text: string, type: "error" | "success"): void {
  message.textContent = text;
  message.className = type;
}

function render(): void {
  list.replaceChildren(); // limpa a lista

  for (const r of listReservations()) {
    const item = document.createElement("li");
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

render();
