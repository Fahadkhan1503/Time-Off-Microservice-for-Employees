# Time-Off Microservice

A NestJS microservice for managing employee time-off requests with HCM sync.

---

## Stack
- **NestJS** — backend framework
- **SQLite** (better-sqlite3) — local database
- **TypeORM** — ORM
- **Express** — mock HCM server

---

## Project Structure


TIME-OFF-MICROSERVICE/  
├── mock-hcm/  
├── nestjs/  
│ ├── data/  
│ ├── dist/  
│ ├── node_modules/  
│ ├── src/  
│ │ ├── balance/  
│ │ ├── common/  
│ │ ├── database/  
│ │ ├── hcm/  
│ │ ├── request/  
│ │ ├── sync/  
│ │ ├── app.module.ts  
│ │ └── main.ts  
│ ├── test/  
│ ├── .gitignore  
│ ├── .prettierrc  
│ ├── eslint.config.mjs  
│ ├── nest-cli.json  
│ ├── package-lock.json  
│ ├── package.json  
│ ├── tsconfig.build.json  
│ └── tsconfig.json  
└── README.md




---
## Getting Started

### 1. Install dependencies
```bash
cd nestjs
npm install

cd ../mock-hcm
npm install
```

### 2. Run Mock HCM Server
```bash
cd mock-hcm
npm start
# Runs on http://localhost:3001
```

### 3. Run Microservice
```bash
cd nestjs
npm run start:dev
# Runs on http://localhost:3000
```

## API Endpoints

### Balances
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/balances/:employeeId | Get all balances for employee |
| GET | /api/v1/balances/:employeeId/:locationId | Get single balance |
| POST | /api/v1/balances/sync/batch | Receive HCM batch push |
| POST | /api/v1/balances/sync/realtime/:employeeId/:locationId | Pull from HCM |

### Requests
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/requests | Create time-off request |
| GET | /api/v1/requests/:id | Get single request |
| GET | /api/v1/requests | List requests |
| PATCH | /api/v1/requests/:id/approve | Approve request |
| PATCH | /api/v1/requests/:id/reject | Reject request |
| PATCH | /api/v1/requests/:id/cancel | Cancel request |

## Running Tests
```bash
cd nestjs
npm run test        # Run all tests
npm run test:cov    # Run with coverage report
```

## Test Results
- **29 tests passing**
- **89% code coverage**
- Unit tests, integration tests, and E2E lifecycle tests

## Key Features
- Balance sync with HCM (real-time + batch)
- Defensive balance validation
- Pessimistic row-level locking for concurrent requests
- Transaction rollback on HCM failure
- Mock HCM server with anniversary bonus simulation