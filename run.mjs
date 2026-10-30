// Fetch one job from the site, run it with Claude Code (structured output), post the answer back.
// Prints only status lines: the job's prompt and answer stay out of this public repo's logs.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const SITE = "https://prickledherald.com";
const id = String(process.env.JOB_ID || "").replace(/\D/g, "");
const url = `${SITE}/api/v1/claude-jobs/${id}`;
const auth = { Authorization: `Bearer ${process.env.RUNNER_KEY}` };
const post = body => fetch(url, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });

try {
  if (!id) throw new Error("no job id");
  const r = await fetch(url, { headers: auth });
  const job = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`fetch job: ${job.error || r.status}`);
  console.log(`job ${id}: ${job.tool} (${job.model || "default model"}), ${job.images.length} image(s)`);

  fs.mkdirSync("work", { recursive: true });
  fs.writeFileSync("work/system.txt", job.system);
  let prompt = job.prompt;
  for (const [i, src] of job.images.entries()) {
    const res = await fetch(new URL(src, SITE));
    if (!res.ok) { prompt = prompt.replace(`[image img${i + 1}.jpg]`, "[image missing]"); continue; }
    fs.writeFileSync(`work/img${i + 1}.jpg`, Buffer.from(await res.arrayBuffer()));
  }
  if (job.images.length) prompt += `\n\nThe images are the files img1.jpg to img${job.images.length}.jpg in the current folder. Look at every one with the Read tool before you answer.`;

  const args = ["-p", "--output-format", "json", "--system-prompt-file", "system.txt",
    "--json-schema", JSON.stringify(job.schema), "--max-turns", String(job.images.length + 6)];
  if (job.images.length) args.push("--tools", "Read", "--allowedTools", "Read");
  else args.push("--tools", "");
  if (job.model) args.push("--model", job.model);
  if (job.effort) args.push("--effort", job.effort);
  const run = spawnSync("claude", args, { cwd: "work", input: prompt, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 12 * 60 * 1000 });

  let out;
  try { out = JSON.parse(run.stdout); }
  catch { throw new Error(`claude exited ${run.status}: ${String(run.stderr || run.stdout || run.error || "").slice(-600)}`); }
  if (out.is_error || !out.structured_output) throw new Error(`${out.subtype || "error"}${out.api_error_status ? ` (HTTP ${out.api_error_status})` : ""}: ${String(out.result || "no structured output").slice(0, 600)}`);
  const p = await post({ output: out.structured_output });
  console.log(`done in ${Math.round((out.duration_ms || 0) / 1000)}s, ${out.num_turns} turn(s); site said ${p.status}`);
} catch (e) {
  console.log(`failed: ${String(e.message).slice(0, 300)}`);
  await post({ error: String(e.message).slice(0, 1500) }).catch(() => {});
  process.exitCode = 1;
}
