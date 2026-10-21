import type { Reservation, ReservationPayload } from "../types/reservation";
import { isReservation, isReservationList } from "../utils/guards";

const DEFAULT_BASE_URL = "http://localhost:3000";

// Erro próprio da camada HTTP: carrega o código de status junto da mensagem.
// status 0 = nem chegou a existir resposta (servidor desligado, sem rede).
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Classe responsável SOMENTE pela comunicação com o JSON Server.
// Nenhuma regra de negócio (conflito, validação) fica aqui.
export class ReservationApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // GET /reservations?resource=sala&date=2026-10-23 ...
  async getAll(params: Record<string, string> = {}): Promise<Reservation[]> {
    const query = new URLSearchParams(params).toString();
    const path = query === "" ? "/reservations" : `/reservations?${query}`;
    return this.request(path, isReservationList);
  }

  // GET /reservations/:id
  async getById(id: number): Promise<Reservation> {
    return this.request(`/reservations/${id}`, isReservation);
  }

  // POST /reservations (o servidor gera o id)
  async create(data: ReservationPayload): Promise<Reservation> {
    return this.request("/reservations", isReservation, this.jsonOptions("POST", data));
  }

  // PUT /reservations/:id (substitui o registro inteiro)
  async update(id: number, data: ReservationPayload): Promise<Reservation> {
    return this.request(`/reservations/${id}`, isReservation, this.jsonOptions("PUT", data));
  }

  // PATCH /reservations/:id (altera só os campos informados, ex.: o status)
  async patch(id: number, data: Partial<ReservationPayload>): Promise<Reservation> {
    return this.request(`/reservations/${id}`, isReservation, this.jsonOptions("PATCH", data));
  }

  // DELETE /reservations/:id (não há corpo útil na resposta)
  async remove(id: number): Promise<void> {
    await this.send(`/reservations/${id}`, { method: "DELETE" });
  }

  // Monta as opções do fetch para requisições que enviam JSON
  private jsonOptions(method: "POST" | "PUT" | "PATCH", body: unknown): RequestInit {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  // Faz o fetch e garante que a resposta foi bem-sucedida (response.ok).
  // fetch só rejeita se a rede falhar; um 404 ou 500 NÃO lança erro sozinho,
  // por isso verificamos response.ok manualmente.
  private async send(path: string, options?: RequestInit): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, options);
    } catch {
      throw new ApiError(
        "Não foi possível conectar ao servidor. Verifique se o JSON Server está rodando.",
        0
      );
    }

    if (!response.ok) {
      throw new ApiError(
        `Erro na requisição (${response.status} ${response.statusText}).`,
        response.status
      );
    }

    return response;
  }

  // Lê o JSON da resposta como "unknown" e só o devolve se passar no type guard.
  // O genérico T é inferido a partir do guard recebido (value is T).
  private async request<T>(
    path: string,
    isValid: (value: unknown) => value is T,
    options?: RequestInit
  ): Promise<T> {
    const response = await this.send(path, options);
    const data: unknown = await response.json();

    if (!isValid(data)) {
      throw new ApiError("O servidor devolveu dados em formato inesperado.", response.status);
    }

    return data;
  }
}
