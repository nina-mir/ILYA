import { HTTPException } from 'hono/http-exception';

export function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

export function unauthorized(message = 'You must be signed in.'): never {
  throw new HTTPException(401, { message });
}

export function forbidden(message = 'You do not have permission to do that.'): never {
  throw new HTTPException(403, { message });
}

export function notFound(message = 'That item was not found.'): never {
  throw new HTTPException(404, { message });
}
