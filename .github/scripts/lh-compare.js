const HISTORY_PATH = ".lighthouse/history.json";
const ISSUE_TITLE = "Lighthouse Performance Alert";
const LABELS = ["lighthouse", "performance"];

const CONFIG = {
  failThresholds: {
    performance: 85,
    accessibility: 90,
    "best-practices": 90,
    seo: 90,
  },
  metricThresholds: {
    "first-contentful-paint": 2000,
    "largest-contentful-paint": 3000,
    "cumulative-layout-shift": 0.15,
    "total-blocking-time": 300,
    "speed-index": 5000,
    interactive: 3500,
  },
  higherIsWorseMetrics: new Set([
    "first-contentful-paint",
    "largest-contentful-paint",
    "cumulative-layout-shift",
    "total-blocking-time",
    "speed-index",
    "interactive",
  ]),
  regressionPercent: 0.1,
  consecutiveFailLimit: 3,
  minRunsForRegression: 2,
};

class LighthouseAnalyzer {
  constructor(history) {
    this.history = history;
    this.results = [];
    this.failures = [];
    this.regressions = [];
  }

  static async loadHistory() {
    const file = Bun.file(HISTORY_PATH);
    if (!await file.exists()) return { runs: [], paths: {} };
    return await file.json();
  }

  static async saveHistory(history) {
    await Bun.write(HISTORY_PATH, JSON.stringify(history, null, 2));
  }

  static async gh(args) {
    const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
    const [out, err, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) throw new Error(err || `gh exited ${exitCode}`);
    return out;
  }

  static extractPath(url) {
    try {
      return new URL(url).pathname || "/";
    } catch {
      return "/";
    }
  }

  addResult(lhr) {
    const path = LighthouseAnalyzer.extractPath(lhr.requestedUrl);
    const scores = this.#extractScores(lhr);
    const metrics = this.#extractMetrics(lhr);
    const failures = this.#checkFailures(scores, metrics);
    const regressions = this.#detectRegression(metrics, path);

    const state = this.history.paths[path] ?? { consecutiveFailures: 0 };
    const failed = failures.length > 0 || regressions.length > 0;
    state.consecutiveFailures = failed ? state.consecutiveFailures + 1 : 0;
    this.history.paths[path] = state;

    const result = {
      path,
      url: lhr.requestedUrl,
      passed: !failed,
      scores,
      metrics,
      failures,
      regressions,
      consecutiveFailures: state.consecutiveFailures,
    };

    this.results.push(result);
    if (failures.length > 0) this.failures.push({ path, failures });
    if (regressions.length > 0) this.regressions.push({ path, regressions });
  }

  #extractScores(lhr) {
    const cats = lhr.categories ?? {};
    return {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      "best-practices": Math.round((cats["best-practices"]?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
    };
  }

  #extractMetrics(lhr) {
    const audits = lhr.audits ?? {};
    const extract = (key) => audits[key]?.numericValue;
    return {
      "first-contentful-paint": extract("first-contentful-paint"),
      "largest-contentful-paint": extract("largest-contentful-paint"),
      "cumulative-layout-shift": extract("cumulative-layout-shift"),
      "total-blocking-time": extract("total-blocking-time"),
      "speed-index": extract("speed-index"),
      interactive: extract("interactive"),
    };
  }

  #checkFailures(scores, metrics) {
    const failures = [];

    for (const [cat, threshold] of Object.entries(CONFIG.failThresholds)) {
      const score = scores[cat];
      if (score != null && score < threshold) {
        failures.push({ type: "score", category: cat, value: score, threshold });
      }
    }

    for (const [metric, threshold] of Object.entries(CONFIG.metricThresholds)) {
      const value = metrics[metric];
      if (value != null && value > threshold) {
        failures.push({ type: "metric", metric, value, threshold });
      }
    }

    return failures;
  }

  #getLastNRuns(path, n) {
    return (this.history.runs ?? [])
      .filter((r) => r.path === path)
      .slice(-n);
  }

  #calculateAverage(runs, metric) {
    if (runs.length === 0) return null;
    const values = runs.map((r) => r.metrics?.[metric]).filter((v) => v != null);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  #detectRegression(metrics, path) {
    const regressions = [];
    const last5 = this.#getLastNRuns(path, 5);

    if (last5.length < CONFIG.minRunsForRegression) return regressions;

    for (const metric of Object.keys(CONFIG.metricThresholds)) {
      const current = metrics[metric];
      if (current == null) continue;

      const avg = this.#calculateAverage(last5, metric);
      if (avg == null) continue;

      const isHigherWorse = CONFIG.higherIsWorseMetrics.has(metric);
      const percent = CONFIG.regressionPercent;

      const regressed = isHigherWorse
        ? current > avg * (1 + percent)
        : current < avg * (1 - percent);

      if (regressed) {
        regressions.push({
          metric,
          current,
          avg,
          percentChange: `${(((current - avg) / avg) * 100).toFixed(1)}%`,
        });
      }
    }

    return regressions;
  }

  get hasCritical() {
    return this.failures.length > 0 || this.regressions.length > 0;
  }

  get hasPersistent() {
    return Object.values(this.history.paths).some(
      (p) => p.consecutiveFailures >= CONFIG.consecutiveFailLimit
    );
  }

  buildIssueBody(timestamp, branch, commit) {
    let body = `## Lighthouse Alert\n\n`;
    body += `**Trigger:** ${timestamp}\n`;
    body += `**Branch:** ${branch}\n`;
    body += `**Commit:** ${commit}\n\n`;

    if (this.failures.length > 0) {
      body += `### Failed Checks\n\n`;
      for (const { path, failures } of this.failures) {
        body += `**${path}**\n`;
        for (const f of failures) {
          const suffix = f.type === "score" ? "%" : "";
          body += `- ${f.type === "score" ? f.category : f.metric}: ${f.value}${suffix} (threshold: ${f.threshold}${suffix})\n`;
        }
      }
      body += "\n";
    }

    if (this.regressions.length > 0) {
      body += `### Regressions (>${CONFIG.regressionPercent * 100}% from avg)\n\n`;
      for (const { path, regressions } of this.regressions) {
        body += `**${path}**\n`;
        for (const r of regressions) {
          body += `- ${r.metric}: ${r.current} → ${r.avg} (${r.percentChange})\n`;
        }
      }
      body += "\n";
    }

    const consecutivePaths = Object.entries(this.history.paths)
      .filter(([, data]) => data.consecutiveFailures >= CONFIG.consecutiveFailLimit)
      .map(([path, data]) => `${path} (${data.consecutiveFailures} failures)`);

    if (consecutivePaths.length > 0) {
      body += `### Consecutive Failures (${CONFIG.consecutiveFailLimit}+)\n\n`;
      body += consecutivePaths.join(", ") + "\n\n";
    }

    body += `---\n_This issue is auto-generated._`;
    return body;
  }

  getSummary() {
    return this.results
      .map((r) => {
        const status = r.passed ? "✅" : "❌";
        return `${status} ${r.path}: Perf ${r.scores.performance}% | A11y ${r.scores.accessibility}% | BP ${r.scores["best-practices"]}% | SEO ${r.scores.seo}%`;
      })
      .join("\n");
  }
}

async function ensureLabels() {
  const created = [];
  for (const label of LABELS) {
    try {
      await LighthouseAnalyzer.gh(["label", "create", label, "--force", "--color", "D93F0B"]);
      created.push(label);
    } catch {
      // label may already exist — verify it does
      try {
        await LighthouseAnalyzer.gh(["label", "list", "--search", label, "--json", "name"]);
        created.push(label);
      } catch {
        // skip this label entirely
      }
    }
  }
  return created;
}

async function findOpenIssue() {
  try {
    const output = await LighthouseAnalyzer.gh([
      "issue", "list", "--state", "open", "--json", "number,title", "--limit", "10",
    ]);
    const issues = JSON.parse(output);
    return issues.find((i) => i.title.includes(ISSUE_TITLE)) ?? null;
  } catch {
    return null;
  }
}

async function run() {
  const resultsPath = process.argv[2];
  if (!resultsPath) {
    console.error("Usage: bun run lh-compare.js <results-path>");
    process.exit(0);
  }

  const findProc = Bun.spawn(["find", resultsPath, "-name", "lhr-*.json", "-type", "f"]);
  const findOutput = await new Response(findProc.stdout).text();
  const lhrFiles = findOutput.trim().split("\n").filter(Boolean);

  if (lhrFiles.length === 0) {
    console.log("No Lighthouse results found");
    process.exit(0);
  }

  const history = await LighthouseAnalyzer.loadHistory();
  const analyzer = new LighthouseAnalyzer(history);

  for (const lhrFile of lhrFiles) {
    const file = Bun.file(lhrFile);
    if (!await file.exists()) continue;
    const lhr = await file.json();
    if (lhr) analyzer.addResult(lhr);
  }

  const currentRun = {
    timestamp: new Date().toISOString(),
    branch: process.env.GITHUB_REF?.replace("refs/heads/", "") || "unknown",
    commit: process.env.GITHUB_SHA?.substring(0, 7) || "unknown",
    results: analyzer.results,
  };

  history.runs.push(currentRun);
  history.lastUpdated = new Date().toISOString();
  await LighthouseAnalyzer.saveHistory(history);

  console.log("Lighthouse comparison complete");
  console.log(`Failures: ${analyzer.failures.length} paths`);
  console.log(`Regressions: ${analyzer.regressions.length} paths`);

  if (analyzer.hasCritical || analyzer.hasPersistent) {
    const existingIssue = await findOpenIssue();
    const body = analyzer.buildIssueBody(
      currentRun.timestamp,
      currentRun.branch,
      currentRun.commit
    );

    if (existingIssue) {
      console.log(`Updating existing issue #${existingIssue.number}`);
      await LighthouseAnalyzer.gh(["issue", "comment", String(existingIssue.number), "--body", body]);
    } else {
      console.log("Creating new issue");
      const validLabels = await ensureLabels();
      const labelArgs = validLabels.length > 0 ? ["--label", validLabels.join(",")] : [];
      await LighthouseAnalyzer.gh(["issue", "create", "--title", ISSUE_TITLE, "--body", body, ...labelArgs]);
    }
  }

  console.log("\n--- Summary ---\n" + analyzer.getSummary());
  process.exit(analyzer.hasCritical || analyzer.hasPersistent ? 1 : 0);
}

run();
