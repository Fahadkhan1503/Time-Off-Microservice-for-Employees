import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

jest.setTimeout(30000);

describe('Request Lifecycle (E2E)', () => {
  let app: INestApplication;
  let requestId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    await request(app.getHttpServer())
      .post('/api/v1/balances/sync/batch')
      .send({
        records: [{ employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 10 }],
      });
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/v1/balances/E001 — should return balance', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/balances/E001')
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].employeeId).toBe('E001');
  });

  it('POST /api/v1/requests — should create request with sufficient balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/requests')
      .send({
        employeeId: 'E001',
        locationId: 'LOC_KHI',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        reason: 'Vacation',
      })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.days).toBeGreaterThan(0);
    requestId = res.body.id;
  });

  it('POST /api/v1/requests — should reject if insufficient balance', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/requests')
      .send({
        employeeId: 'E001',
        locationId: 'LOC_KHI',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      })
      .expect(422);
  });

  it('GET /api/v1/requests/:id — should return the created request', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/requests/${requestId}`)
      .expect(200);
    expect(res.body.id).toBe(requestId);
  });

  it('PATCH /api/v1/requests/:id/reject — should reject the request', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/requests/${requestId}/reject`)
      .send({ managerId: 'M001' })
      .expect(200);
    expect(res.body.status).toBe('REJECTED');
  });

  it('PATCH /api/v1/requests/:id/approve — should fail on already rejected request', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/requests/${requestId}/approve`)
      .send({ managerId: 'M001' })
      .expect(409);
  });

  it('GET /api/v1/requests — should list all requests', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/requests')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});