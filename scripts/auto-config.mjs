#!/usr/bin/env node
// Auto-detect system hardware and generate launch.json for the current machine.
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();

// 1. Locate Electron v22.3.27
let electron = path.join(home, '.local', 'electron-v22.3.27', 'electron');
if (!fs.existsSync(electron)) {
  const alt = path.join(home, 'electron-v22.3.27', 'electron');
  if (fs.existsSync(alt)) electron = alt;
}

// 2. Locate native runtime
let runtime = path.join(root, 'runtime');
if (!fs.existsSync(path.join(runtime, 'bionic', 'linker64'))) {
  const recovery = path.join(home, 'zalo-native-recovery', 'mute-evidence-20260910', 'runtime');
  if (fs.existsSync(recovery)) runtime = recovery;
}

// 3. Auto-detect PulseAudio / PipeWire microphone
let source = '';
try {
  const sources = execSync('pactl list sources short', {encoding: 'utf8'}).trim().split('\n');
  for (const line of sources) {
    const parts = line.split('\t');
    const name = parts[1] || parts[0];
    if (name && !name.endsWith('.monitor')) {
      source = name;
      break;
    }
  }
} catch {
  // best effort fallback
}

// 4. Auto-detect PulseAudio / PipeWire speaker
let sink = '';
try {
  const sinks = execSync('pactl list sinks short', {encoding: 'utf8'}).trim().split('\n');
  if (sinks.length > 0) {
    const parts = sinks[0].split('\t');
    sink = parts[1] || parts[0];
  }
} catch {
  // best effort fallback
}

// 5. Check webcam
const videoDevice = fs.existsSync('/dev/video0') ? '/dev/video0' : undefined;

const config = {
  appDir: root,
  electron,
  runtime,
  source: source || 'alsa_input.pci-0000_00_1f.3.analog-stereo',
  sink: sink || 'alsa_output.pci-0000_00_1f.3.analog-stereo',
  noSandbox: true,
  experimentalVideo: Boolean(videoDevice),
  ...(videoDevice ? {videoDevice} : {}),
  experimentalIncoming: true,
  log: true
};

const targetPath = path.join(root, 'launch.json');
fs.writeFileSync(targetPath, JSON.stringify(config, null, 2) + '\n', {mode: 0o600});
console.log(`PASS auto-configured launch.json for host ${os.hostname()} (${os.userInfo().username})`);
console.log(`  Electron: ${electron}`);
console.log(`  Runtime:  ${runtime}`);
console.log(`  Microphone: ${config.source}`);
console.log(`  Speaker:    ${config.sink}`);
if (videoDevice) console.log(`  Webcam:     ${videoDevice}`);
