export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ConnectionError extends Error {
  constructor(message = "API Server is not running or unreachable.") {
    super(message);
    this.name = "ConnectionError";
  }
}
