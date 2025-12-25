const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const ipcPath = path.join(rootDir, "src", "shared", "constants", "ipc.ts");
const outputPath = path.join(rootDir, "docs", "ipc.md");

const content = fs.readFileSync(ipcPath, "utf8");
const startIndex = content.indexOf("export const IPC_CHANNELS");
if (startIndex === -1) {
  throw new Error("IPC_CHANNELS export not found");
}

const braceIndex = content.indexOf("{", startIndex);
let endIndex = content.indexOf("} as const", braceIndex);
if (endIndex === -1) {
  endIndex = content.indexOf("};", braceIndex);
}
if (braceIndex === -1 || endIndex === -1) {
  throw new Error("IPC_CHANNELS block not found");
}

const block = content.slice(braceIndex + 1, endIndex);
const lines = block.split("\n");
const entries = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) continue;
  const match = trimmed.match(/^([A-Z0-9_]+):\s*['"]([^'"]+)['"]/);
  if (match) {
    entries.push({ key: match[1], channel: match[2] });
  }
}

const groups = new Map();
for (const entry of entries) {
  const groupKey = entry.key.split("_")[0];
  if (!groups.has(groupKey)) {
    groups.set(groupKey, []);
  }
  groups.get(groupKey).push(entry);
}

const sections = [];
sections.push("# IPC Channels");
sections.push("");
sections.push("Auto-generated from `src/shared/constants/ipc.ts`.");
sections.push("");

for (const [group, groupEntries] of groups) {
  sections.push(`## ${group}`);
  sections.push("");
  sections.push("| Key | Channel |");
  sections.push("| --- | --- |");
  for (const entry of groupEntries) {
    sections.push(`| ${entry.key} | ${entry.channel} |`);
  }
  sections.push("");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sections.join("\n"));
console.log(`IPC docs generated at ${outputPath}`);
