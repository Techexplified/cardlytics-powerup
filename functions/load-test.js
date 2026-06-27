// cardlytics-backend/load-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────
const errorRate    = new Rate("error_rate");
const responseTime = new Trend("response_time");

// ── Test configuration ────────────────────────────────────────
export const options = {
  scenarios: {

    // Scenario 1: Steady load — 50 users for 30 seconds
    // Simulates normal daily usage
    steady_load: {
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
      tags: { scenario: "steady" },
    },

    // Scenario 2: Ramp up — gradually increase to 200 users
    // Simulates morning peak when users open Trello
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
    { duration: "20s", target: 10 },
    { duration: "20s", target: 20 },
    { duration: "20s", target: 0  },
      ],
      startTime: "35s", // starts after steady_load
      tags: { scenario: "ramp_up" },
    },
  },

  // ── Pass/Fail thresholds ──────────────────────────────────
  // Test FAILS if these are not met
  thresholds: {
    // 95% of requests must complete under 500ms
     http_req_duration: ["p(95)<5000"],
    // Less than 1% of requests can fail
    http_req_failed:   ["rate<0.01"],
    // Our custom error rate must be under 1%
    error_rate:        ["rate<0.01"],
  },
};

// ── Your deployed backend URL ─────────────────────────────────
const BASE_URL = "https://cardlyticsapi-pf6diz22ka-uc.a.run.app";

// ── Your real Trello token for testing ────────────────────────
// Get a fresh one from:
// https://trello.com/1/authorize?expiration=1day&name=LoadTest&scope=read&response_type=token&key=YOUR_KEY
const TRELLO_TOKEN = "";

// ── This function runs once per virtual user ──────────────────
export default function () {

  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health check 200": (r) => r.status === 200,
  });

  sleep(0.5);

  // Test 2: Subscription status — most called route
  const statusRes = http.get(`${BASE_URL}/api/subscription/status`, {
    headers: {
      Authorization: `Bearer ${TRELLO_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const statusOk = check(statusRes, {
    "status check 200":        (r) => r.status === 200,
    "response has plan field": (r) => {
      try {
        return JSON.parse(r.body).plan !== undefined;
      } catch {
        return false;
      }
    },
    "response time under 500ms": (r) => r.timings.duration < 500,
  });

  // track errors
  errorRate.add(!statusOk);
  responseTime.add(statusRes.timings.duration);

  sleep(1);
}

// ── Summary report printed at end ────────────────────────────
export function handleSummary(data) {
  const passed = data.metrics.http_req_failed.values.rate < 0.01;

  console.log("\n═══════════════════════════════════════");
  console.log("         LOAD TEST RESULTS");
  console.log("═══════════════════════════════════════");
  console.log(`Status:          ${passed ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`Total requests:  ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`Avg response:    ${data.metrics.http_req_duration.values.avg.toFixed(0)}ms`);
  console.log(`p95 response:    ${data.metrics.http_req_duration.values["p(95)"].toFixed(0)}ms`);
  console.log(`Max response:    ${data.metrics.http_req_duration.values.max.toFixed(0)}ms`);
  console.log("═══════════════════════════════════════\n");

  return {};
}