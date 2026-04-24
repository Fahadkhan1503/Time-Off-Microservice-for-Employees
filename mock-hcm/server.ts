import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const dataPath = path.join(__dirname, 'data', 'balances.json');

function loadBalances(): Record<string, any> {
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

function saveBalances(data: Record<string, any>) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// GET single balance
app.get('/hcm/balance/:employeeId/:locationId', (req, res) => {
  const { employeeId, locationId } = req.params;
  const key = `${employeeId}_${locationId}`;
  const balances = loadBalances();

  if (!balances[key]) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  return res.json(balances[key]);
});

// GET all balances (batch)
app.get('/hcm/balances', (req, res) => {
  const balances = loadBalances();
  return res.json({ records: Object.values(balances) });
});

// Deduct balance
app.post('/hcm/balance/deduct', (req, res) => {
  const { employeeId, locationId, days } = req.body;
  const key = `${employeeId}_${locationId}`;
  const balances = loadBalances();

  if (!balances[key]) {
    return res.status(404).json({ success: false, error: 'Balance not found' });
  }

  if (balances[key].totalDays < days) {
    return res.status(422).json({ success: false, error: 'INSUFFICIENT_BALANCE' });
  }

  balances[key].totalDays -= days;
  saveBalances(balances);

  return res.json({ success: true, remaining: balances[key].totalDays });
});

// Restore balance
app.post('/hcm/balance/restore', (req, res) => {
  const { employeeId, locationId, days } = req.body;
  const key = `${employeeId}_${locationId}`;
  const balances = loadBalances();

  if (!balances[key]) {
    return res.status(404).json({ success: false, error: 'Balance not found' });
  }

  balances[key].totalDays += days;
  saveBalances(balances);

  return res.json({ success: true, remaining: balances[key].totalDays });
});

// Simulate anniversary bonus
app.post('/hcm/balance/bonus', (req, res) => {
  const { employeeId, locationId, bonusDays } = req.body;
  const key = `${employeeId}_${locationId}`;
  const balances = loadBalances();

  if (!balances[key]) {
    return res.status(404).json({ success: false, error: 'Balance not found' });
  }

  balances[key].totalDays += bonusDays;
  saveBalances(balances);

  return res.json({ success: true, newTotal: balances[key].totalDays });
});

app.listen(3001, () => {
  console.log('Mock HCM server running on http://localhost:3001');
});