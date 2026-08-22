import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'nadia');

async function readCollection(filePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Nadia persistence read failed for ${path.basename(filePath)}: ${error.message}`);
  }
}

async function atomicWrite(filePath, records) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), records }, null, 2);
  await fs.writeFile(tempPath, payload, { encoding: 'utf8', flag: 'wx' });
  await fs.rename(tempPath, filePath);
}

export class NadiaPersistence {
  constructor(dataDir = process.env.NADIA_DATA_DIR || DEFAULT_DATA_DIR) {
    this.dataDir = path.resolve(dataDir);
    this.paths = {
      opportunities: path.join(this.dataDir, 'opportunities.json'),
      seoTasks: path.join(this.dataDir, 'seo_tasks.json'),
      analysisRuns: path.join(this.dataDir, 'analysis_runs.json')
    };
    this.writeQueue = Promise.resolve();
  }

  readOpportunities() { return readCollection(this.paths.opportunities); }
  readSeoTasks() { return readCollection(this.paths.seoTasks); }
  readAnalysisRuns() { return readCollection(this.paths.analysisRuns); }

  queueWrite(operation) {
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  replaceOpportunities(records) {
    return this.queueWrite(() => atomicWrite(this.paths.opportunities, records));
  }

  async appendSeoTask(task) {
    return this.queueWrite(async () => {
      const records = await this.readSeoTasks();
      const existingIndex = records.findIndex(item => item.taskId === task.taskId);
      if (existingIndex >= 0) records[existingIndex] = task;
      else records.push(task);
      await atomicWrite(this.paths.seoTasks, records);
      return task;
    });
  }

  async appendAnalysisRun(run) {
    return this.queueWrite(async () => {
      const records = await this.readAnalysisRuns();
      records.push(run);
      await atomicWrite(this.paths.analysisRuns, records.slice(-200));
      return run;
    });
  }
}

