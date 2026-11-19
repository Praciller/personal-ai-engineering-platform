import { handleRequest } from '../server.mjs';

export default function health(request, response) {
  return handleRequest(request, response, '/api/health');
}
