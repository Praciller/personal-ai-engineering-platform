import { handleRequest } from '../server.mjs';

export default function demo(request, response) {
  return handleRequest(request, response, '/api/demo');
}
