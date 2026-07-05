#!/usr/bin/env node
/**
 * gen-card-art.mjs — batch-generate player card art.
 *
 * Usage:
 *   node scripts/gen-card-art.mjs [options]
 *
 * Providers:
 *   --provider=pollinations  (default) FREE, no API key — image.pollinations.ai
 *   --provider=google        Gemini Imagen / Flash image gen (needs GEMINI_API_KEY, paid tier)
 *
 * Options:
 *   --priority-only     Only generate LEGEND + ELITE cards (63 images)
 *   --concurrency=N     Parallel API calls (default: 3)
 *   --model=NAME        pollinations: flux|turbo · google: imagen-3.0-generate-001 etc.
 *   --dry-run           Print prompts without calling the API
 *   --help              Show this help
 *
 * Saves images to public/cards/players/<id>.png and auto-runs the manifest.
 * Resume-safe: already-present files (any image extension) are skipped.
 *
 * NOTE: on Windows, Node's TLS may reset against some CDNs — if the
 * pollinations provider fails with ECONNRESET, use the Python equivalent
 * (works anywhere Python can reach the network):
 *   python3 scripts/gen_card_art.py [--priority-only]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function loadDotEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const provider = (args.find((a) => a.startsWith('--provider=')) || '').split('=')[1] || 'pollinations';
  const opts = {
    priorityOnly: args.includes('--priority-only'),
    dryRun: args.includes('--dry-run'),
    help: args.includes('--help'),
    concurrency: 3,
    provider,
    model: provider === 'google' ? 'imagen-3.0-generate-001' : 'flux',
  };
  for (const a of args) {
    const m = a.match(/^--concurrency=(\d+)$/);
    if (m) opts.concurrency = Math.max(1, parseInt(m[1], 10));
    const m2 = a.match(/^--model=(.+)$/);
    if (m2) opts.model = m2[1];
  }
  return opts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Pollinations (free, no key) ────────────────────────────────────────────────

/** Deterministic per-card seed so a player always regenerates the same art. */
const seedFor = (id) => (Number(String(id).split('-').pop()) || 0) % 2_000_000_000;

async function generateViaPollinations(prompt, model, seed) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=640&height=853&model=${model}&nologo=true&seed=${seed}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'golazo-card-gen/1.0' } });
  if (!res.ok) throw Object.assign(new Error(`Pollinations ${res.status}`), { status: res.status });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error(`suspiciously small (${buf.length}b)`);
  return buf;
}

// ── Imagen API call ───────────────────────────────────────────────────────────

/**
 * Call Gemini Imagen or gemini-flash image generation REST API.
 * Returns the raw PNG bytes as a Buffer.
 */
async function generateImage(prompt, model, apiKey) {
  // Imagen 3 endpoint
  if (model.startsWith('imagen')) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
    const body = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '3:4',
        safetySetting: 'block_only_high',
        personGeneration: 'allow_all',
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Imagen API ${res.status}: ${text}`), { status: res.status });
    }
    const json = await res.json();
    const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error(`No image in response: ${JSON.stringify(json).slice(0, 300)}`);
    return Buffer.from(b64, 'base64');
  }

  // Gemini flash preview (generateContent with image response modality)
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], responseMimeType: 'image/png' },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Gemini API ${res.status}: ${text}`), { status: res.status });
  }
  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`No image part in response: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(part.inlineData.data, 'base64');
}

// ── concurrency pool ──────────────────────────────────────────────────────────

async function runPool(tasks, concurrency) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadDotEnv();
  const opts = parseArgs();

  if (opts.help) {
    console.log(`
Usage: node scripts/gen-card-art.mjs [options]

  --provider=NAME     pollinations (free, default) | google (needs GEMINI_API_KEY)
  --priority-only     Only LEGEND + ELITE cards
  --concurrency=N     Parallel requests (default: 3)
  --model=NAME        pollinations: flux|turbo · google: imagen-3.0-generate-001
  --dry-run           Print prompts, no API calls
  --help              This help

Reads  : card-prompts.jsonl
Writes : public/cards/players/<id>.png  (+ manifest)
Free   : default provider needs no key. Windows Node TLS may reset against the
         CDN — if so use: python3 scripts/gen_card_art.py
`.trim());
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (opts.provider === 'google' && !apiKey && !opts.dryRun) {
    console.error('\n❌  --provider=google needs GEMINI_API_KEY in .env (paid tier).');
    console.error('   Or use the free default:  node scripts/gen-card-art.mjs\n');
    process.exit(1);
  }

  // Load prompts
  const jsonlPath = join(ROOT, 'card-prompts.jsonl');
  if (!existsSync(jsonlPath)) {
    console.error('❌  card-prompts.jsonl not found at repo root.');
    process.exit(1);
  }
  const allCards = readFileSync(jsonlPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const PRIORITY_RARITIES = new Set(['LEGEND', 'ELITE']);
  const cards = opts.priorityOnly
    ? allCards.filter((c) => PRIORITY_RARITIES.has(c.rarity))
    : allCards;

  const outDir = join(ROOT, 'public', 'cards', 'players');
  mkdirSync(outDir, { recursive: true });

  const reportPath = join(ROOT, 'scripts', 'gen-report.jsonl');

  // Determine which cards to skip (already generated)
  const todo = cards.filter((c) => !existsSync(join(outDir, c.file)));
  const skipped = cards.length - todo.length;

  console.log(`\n🎴  Golazo Card Art Generator`);
  console.log(`   Model      : ${opts.model}`);
  console.log(`   Filter     : ${opts.priorityOnly ? 'LEGEND + ELITE only' : 'all rarities'}`);
  console.log(`   Cards total: ${cards.length}`);
  console.log(`   Skipped    : ${skipped} (already generated)`);
  console.log(`   To generate: ${todo.length}`);
  console.log(`   Concurrency: ${opts.concurrency}`);
  if (opts.dryRun) console.log(`   Mode       : DRY RUN (no API calls)\n`);
  console.log('');

  if (todo.length === 0) {
    console.log('✅  Nothing to do — all images already present.');
    if (!opts.dryRun) runManifest();
    return;
  }

  // Progress counters
  let done = 0, failed = 0;
  const startTime = Date.now();
  const reportLines = [];

  // Handle Ctrl+C gracefully
  let stopping = false;
  process.on('SIGINT', () => {
    if (!stopping) {
      stopping = true;
      console.log('\n\n⚠️  Caught SIGINT — finishing in-flight requests then stopping...');
    }
  });

  const tasks = todo.map((card) => async () => {
    if (stopping) return;

    const outFile = join(outDir, card.file);

    if (opts.dryRun) {
      console.log(`[DRY] ${card.rarity.padEnd(6)} ${card.id}  ${card.name}`);
      console.log(`      ${card.prompt.slice(0, 120)}…\n`);
      return;
    }

    // Retry loop with exponential back-off
    let attempt = 0;
    const maxAttempts = 5;
    while (attempt < maxAttempts) {
      try {
        const imgBuf =
          opts.provider === 'google'
            ? await generateImage(card.prompt, opts.model, apiKey)
            : await generateViaPollinations(card.prompt, opts.model, seedFor(card.id));
        writeFileSync(outFile, imgBuf);
        done++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const pct = (((done + failed) / todo.length) * 100).toFixed(1);
        console.log(`✅  [${pct}% | ${elapsed}s] ${card.rarity.padEnd(6)} ${card.id}  ${card.name}`);
        reportLines.push(JSON.stringify({ id: card.id, status: 'ok', file: card.file, attempt }));
        return;
      } catch (err) {
        attempt++;
        const isRateLimit = err.status === 429 || /quota|rate/i.test(err.message);
        if (attempt >= maxAttempts) {
          failed++;
          console.error(`❌  FAILED ${card.id} (${card.name}): ${err.message}`);
          reportLines.push(JSON.stringify({ id: card.id, status: 'failed', error: err.message }));
          return;
        }
        const wait = isRateLimit
          ? Math.min(60000, 5000 * 2 ** (attempt - 1))  // 5s, 10s, 20s, 40s, 60s
          : Math.min(10000, 1000 * 2 ** (attempt - 1));
        console.warn(`⚠️  ${card.id} attempt ${attempt}/${maxAttempts} failed — retry in ${wait / 1000}s`);
        await sleep(wait + Math.random() * 500);
      }
    }
  });

  // Add small random jitter between task launches to avoid burst
  const timedTasks = tasks.map((t, i) => async () => {
    await sleep(Math.floor((i / opts.concurrency) * 800) % 1200);
    return t();
  });

  await runPool(timedTasks, opts.concurrency);

  // Write report
  if (reportLines.length > 0) {
    writeFileSync(
      reportPath,
      reportLines.join('\n') + '\n',
      { flag: 'a' },  // append to existing report
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅  Done in ${elapsed}s — ${done} generated, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) console.log(`   (Re-run the script to retry failed cards — they are auto-skipped if the file exists)`);
  console.log('');

  if (!opts.dryRun && done > 0) runManifest();
}

function runManifest() {
  console.log('📋  Updating card art manifest…');
  try {
    execFileSync(process.execPath, [join(__dirname, 'gen-card-art-manifest.mjs')], {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('⚠️  Manifest update failed:', e.message);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
