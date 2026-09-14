#!/usr/bin/env node
// Auto-detect system hardware and generate launch.json for the current machine.
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();

// 1. Locate or automatically download Electron v22.3.27
let electron = path.join(home, '.local', 'electron-v22.3.27', 'electron');
if (!fs.existsSync(electron)) {
  const alt = path.join(home, 'electron-v22.3.27', 'electron');
  if (fs.existsSync(alt)) {
    electron = alt;
  } else {
    console.log('Electron v22.3.27 not found. Downloading automatically...');
    const electronDir = path.join(home, '.local', 'electron-v22.3.27');
    fs.mkdirSync(electronDir, {recursive: true});
    try {
      execSync('curl -L -o /tmp/electron-v22.3.27.zip https://github.com/electron/electron/releases/download/v22.3.27/electron-v22.3.27-linux-x64.zip', {stdio: 'inherit'});
      execSync(`unzip -q -o /tmp/electron-v22.3.27.zip -d "${electronDir}"`, {stdio: 'inherit'});
      fs.chmodSync(path.join(electronDir, 'electron'), 0o755);
      fs.unlinkSync('/tmp/electron-v22.3.27.zip');
      electron = path.join(electronDir, 'electron');
      console.log('Installed Electron v22.3.27 at:', electron);
    } catch (err) {
      console.warn('Failed to download Electron automatically:', err.message);
    }
  }
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
  const defSource = execSync('pactl get-default-source', {encoding: 'utf8'}).trim();
  if (defSource && !defSource.endsWith('.monitor')) {
    source = defSource;
  }
} catch {}
if (!source) {
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
  } catch {}
}

// 4. Auto-detect PulseAudio / PipeWire speaker
let sink = '';
try {
  const defSink = execSync('pactl get-default-sink', {encoding: 'utf8'}).trim();
  if (defSink) {
    sink = defSink;
  }
} catch {}
if (!sink) {
  try {
    const sinks = execSync('pactl list sinks short', {encoding: 'utf8'}).trim().split('\n');
    if (sinks.length > 0) {
      const parts = sinks[0].split('\t');
      sink = parts[1] || parts[0];
    }
  } catch {}
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
console.log(`  Electron:   ${electron}`);
console.log(`  Runtime:    ${runtime}`);
console.log(`  Microphone: ${config.source}`);
console.log(`  Speaker:    ${config.sink}`);
if (videoDevice) console.log(`  Webcam:     ${videoDevice}`);
