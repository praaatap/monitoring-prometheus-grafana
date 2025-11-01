import express, { response } from 'express';
import client from 'prom-client';

const app = express();
const PORT = process.env.PORT || 3000;


// ✅ Counter — total number of HTTP requests
const requestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// ✅ Gauge — tracks current active users on /compute
const currentUsersOnComputeGauge = new client.Gauge({
  name: 'current_users_on_compute',
  help: 'Current number of users on /compute endpoint',
});

// ✅ Histogram — tracks response time distribution
const responseHistogram = new client.Histogram({
  name: 'http_response_time_seconds',
  help: 'Histogram of HTTP response times in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10],
});



// ✅ Middleware: record metrics for every request
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Count total requests
    requestCounter.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });

    responseHistogram.labels(req.method, req.route?.path || req.path, res.statusCode.toString()).observe(duration / 1000);

    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// ✅ Prometheus endpoint — where Prometheus scrapes data
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (err:any) {
    res.status(500).send(`Error collecting metrics: ${err.message}`);
  }
});

// ✅ CPU usage (demo endpoint)
app.get('/cpu', (req, res) => {
  res.json(process.cpuUsage());
});

app.get('/user',(req,res)=> {
    try {
        const startTime = Date.now();
        const name = req.query.name || 'Guest';
        res.json({ message: `Hello, ${name}` });
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            console.log(`Greeted user: ${name}`);
        });
    } catch (error: any) {
        res.status(500).send(`Error processing request: ${error.message}`);
    }
})


// ✅ Compute simulation — simulates work and active users
app.get('/compute', (req, res) => {
  currentUsersOnComputeGauge.inc();

  const timeout = setTimeout(() => {
    res.json(process.memoryUsage());
  }, 5000);

  req.on('close', () => {
    clearTimeout(timeout);
    currentUsersOnComputeGauge.dec();
    console.log('Client aborted the request.');
  });

  res.on('finish', () => {
    clearTimeout(timeout);
    currentUsersOnComputeGauge.dec();
  });
});

// ✅ Root route
app.get('/', (req, res) => {
  res.json({ message: 'Hello, Prometheus + Grafana!' });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port http://localhost:${PORT}`);
});
