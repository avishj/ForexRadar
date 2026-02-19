const HISTORY_PATH = ".lighthouse/history.json";
const ISSUE_TITLE = "Lighthouse Performance Alert";
const LABELS = ["lighthouse", "performance"];

const CONFIG = {
  regressionPercent: 0.1,
  consecutiveFailLimit: 3,
  minRunsForRegression: 2,
};

class LighthouseAnalyzer {
  constructor(history, profile = "mobile") {
    this.history = history;
    this.profile = profile;
    this.results = [];
    this.regressions = [];
    this.assertionFailures = [];
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

  async loadAssertionResults(filePath) {
    const file = Bun.file(filePath);
    if (!await file.exists()) return;
    const assertions = await file.json();
    this.assertionFailures = assertions.filter((a) => a.passed === false);
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
    const historyKey = `${this.profile}:${path}`;
    const metrics = this.#extractMetrics(lhr);
    const regressions = this.#detectRegression(metrics, historyKey);

    const state = this.history.paths[historyKey] ?? { consecutiveFailures: 0 };
    const failed = regressions.length > 0 || this.assertionFailures.length > 0;
    state.consecutiveFailures = failed ? state.consecutiveFailures + 1 : 0;
    this.history.paths[historyKey] = state;

    const result = {
      path,
      url: lhr.requestedUrl,
      passed: !failed,
      metrics,
      regressions,
      consecutiveFailures: state.consecutiveFailures,
    };

    this.results.push(result);
    if (regressions.length > 0) this.regressions.push({ path, regressions });
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

  #getLastNRuns(key, n) {
    return (this.history.runs ?? [])
      .filter((r) => r.key === key)
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

    for (const [metric, current] of Object.entries(metrics)) {
      if (current == null) continue;

      const avg = this.#calculateAverage(last5, metric);
      if (avg == null) continue;

      if (current > avg * (1 + CONFIG.regressionPercent)) {
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
    return this.regressions.length > 0 || this.assertionFailures.length > 0;
  }

  get hasPersistent() {
    return Object.values(this.history.paths).some(
      (p) => p.consecutiveFailures >= CONFIG.consecutiveFailLimit
    );
  }

  buildIssueBody(timestamp, branch, commit) {
    let body = `## Lighthouse Alert\n\n`;
    body += `**Profile:** ${this.profile}\n`;
    body += `**Trigger:** ${timestamp}\n`;
    body += `**Branch:** ${branch}\n`;
    body += `**Commit:** ${commit}\n\n`;

    if (this.assertionFailures.length > 0) {
      const errors = this.assertionFailures.filter((a) => a.level === "error");
      const warns = this.assertionFailures.filter((a) => a.level === "warn");
      body += `### LHCI Assertion Failures\n\n`;
      body += `${errors.length} error(s), ${warns.length} warning(s)\n\n`;
      body += `| Audit | Level | Actual | Threshold |\n`;
      body += `|-------|-------|--------|----------|\n`;
      for (const a of this.assertionFailures) {
        body += `| ${a.auditId} | ${a.level} | ${a.actual} | ${a.operator} ${a.expected} |\n`;
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
    const errors = this.assertionFailures.filter((a) => a.level === "error").length;
    const warns = this.assertionFailures.filter((a) => a.level === "warn").length;
    const lines = [`Assertions: ${errors} error(s), ${warns} warning(s)`];
    for (const r of this.results) {
      const status = r.passed ? "✅" : "❌";
      lines.push(`${status} ${r.path}: ${r.regressions.length} regression(s)`);
    }
    return lines.join("\n");
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
  const assertionsPath = process.argv[3] || process.env.LHCI_ASSERTION_RESULTS;
  const profile = process.argv[4] || process.env.LHCI_PROFILE || "mobile";
  if (!resultsPath) {
    console.error("Usage: bun run lh-compare.js <results-path> [assertion-results.json] [profile]");
    process.exit(0);
  }

  const glob = new Bun.Glob("**/lhr-*.json");
  const lhrFiles = Array.from(glob.scanSync({ cwd: resultsPath, absolute: true }));

  if (lhrFiles.length === 0) {
    console.log("No Lighthouse results found");
    process.exit(0);
  }

  const history = await LighthouseAnalyzer.loadHistory();
  const analyzer = new LighthouseAnalyzer(history, profile);

  if (assertionsPath) {
    await analyzer.loadAssertionResults(assertionsPath);
  }

  for (const lhrFile of lhrFiles) {
    const file = Bun.file(lhrFile);
    if (!await file.exists()) continue;
    const lhr = await file.json();
    if (lhr) analyzer.addResult(lhr);
  }

  const timestamp = new Date().toISOString();
  const branch = process.env.GITHUB_REF?.replace("refs/heads/", "") || "unknown";
  const commit = process.env.GITHUB_SHA?.substring(0, 7) || "unknown";

  for (const r of analyzer.results) {
    history.runs.push({
      key: `${analyzer.profile}:${r.path}`,
      metrics: r.metrics,
      timestamp,
    });
  }

  history.lastUpdated = timestamp;
  await LighthouseAnalyzer.saveHistory(history);

  console.log("Lighthouse comparison complete");
  console.log(`Regressions: ${analyzer.regressions.length} paths`);

  const existingIssue = await findOpenIssue();

  if (analyzer.hasCritical || analyzer.hasPersistent) {
    const body = analyzer.buildIssueBody(timestamp, branch, commit);

    if (existingIssue) {
      console.log(`Updating existing issue #${existingIssue.number}`);
      await LighthouseAnalyzer.gh(["issue", "comment", String(existingIssue.number), "--body", body]);
    } else {
      console.log("Creating new issue");
      const validLabels = await ensureLabels();
      const labelArgs = validLabels.length > 0 ? ["--label", validLabels.join(",")] : [];
      await LighthouseAnalyzer.gh(["issue", "create", "--title", ISSUE_TITLE, "--body", body, ...labelArgs]);
    }
  } else if (existingIssue) {
    console.log(`Closing issue #${existingIssue.number} — all clear`);
    await LighthouseAnalyzer.gh(["issue", "comment", String(existingIssue.number), "--body", "✅ All clear — no regressions or assertion failures."]);
    await LighthouseAnalyzer.gh(["issue", "close", String(existingIssue.number)]);
  }

  console.log("\n--- Summary ---\n" + analyzer.getSummary());
}

run();
