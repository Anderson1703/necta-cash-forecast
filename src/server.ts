import { createServer } from 'node:http';
import { forecastCash } from './domain/forecast.ts';
import { carmen } from './fixtures/carmen.ts';
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method !== 'GET' || url.pathname !== '/v2/stores/demo/cash-forecast') {
    res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'NOT_FOUND' })); return;
  }
  const days = Number(url.searchParams.get('days') ?? 14);
  try {
    const result = forecastCash({ ...carmen, days });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'BAD_REQUEST' }));
  }
});
server.listen(3000, () => console.log('Demo: http://localhost:3000/v2/stores/demo/cash-forecast?days=14'));
