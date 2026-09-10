"use strict";
// zcall-agent.js — Linux peer for Zalo's call-v2 native bridge.
//
// The Electron main process (main-dist/main.js, module "3Zc2", the "call-v2"
// logger) listens on two Unix sockets and spawn()s this program as its
// "native call helper" — the same role ZaloHelper.app/Contents/MacOS/ZaloCall
// plays on macOS:
//
//   argv[2] = host's RECV socket /tmp/socketzalorecv2021 — the host's
//             serverRecv (main.js "serverRecv on data" -> Y parser); the
//             ENGINE WRITES engine->host frames here.
//   argv[3] = host's SEND socket /tmp/socketzalosend2021 — the host's
//             serverSend; the host WRITES host->engine frames (chunked)
//             here, and the engine READS them plus writes chunk ACKs here.
//
// Wire contract — every claim below was verified against main-dist/main.js;
// evidence lines are listed in CALL-LINUX.md / recon-zcall-protocol.md §7:
//   * framing:  messages are AES-128-CBC ciphertext, hex-encoded, `$`-terminated
//   * key:      base64 "yjAF9oqMWl6XfXYJn9mA7w==" (16 bytes), IV = 16 zero bytes
//   * inbound frames may carry NUL padding: strip /\0/g before JSON.parse
//   * host->engine chunking (V/_ = module "4KIH"): ciphertext > 4000 hex chars
//     is split into frames `<chunk>#<seq>#<total>#<index>#$`; each chunk is
//     ACKed by writing ANY bytes on the send leg — the host pops the next
//     queued chunk on data (G) and only then writes chunk k+1.
//   * engine->host frames are NEVER chunked: the host parser (Y) has no
//     reassembly — split on `$`, decrypt, JSON.parse. We send plain `<hex>$`,
//     paced on write-complete.
//   * handshake: engine sends {type:"update",command:"native-ready"} AFTER
//     both legs connect — the host only installs its real socket writer S()
//     in the serverSend connection handler, so native-ready sent too early
//     makes the host queue init data into L with no flush.
//   * host dispatch (H): update/native-ready -> flush queued init; update/cmd
//     -> renderer "call-update"; sendSignal -> renderer "call-send-signal";
//     request/killMe -> SIGINT to this process; response/cmd -> renderer
//     "call-response-" + cmd.
//   * host->engine commands in the shipped renderer (pc-dist compact-app-pc):
//     update/init|updateLocal|listDevice|updateLang|advancedOptions,
//     request/listDevice, and sendSignal/<numeric ws cmd> (401..12447).
//
// Scope — honest statement of what this agent is and is not:
//   IS:  full wire-protocol peer; real Linux audio/video device enumeration
//        (PulseAudio/PipeWire via pactl, pw-dump fallback, ALSA fallback,
//        V4L2 /dev/video*); device-list plumbing so the in-call settings UI
//        works; capture hooks for signalling research.
//   IS NOT: a media engine. Zalo call media negotiates keys with VNG's closed
//        ZRTP variant inside their proprietary Mach-O engine; that leg is NOT
//        reimplemented here (recon §1/§5). Every call setup therefore ends the
//        call cleanly through the renderer's own "end" path instead of hanging
//        in "connecting" until timeoutMakeCall2ZRtp. Real media requires the
//        captured ZRTP/RTP evidence gated in recon §8.
//
// Env:
//   ZALO_ZCALL_CAPTURE=<file>  append decrypted LOCAL IPC traffic (JSONL) for
//                              protocol research. Off by default. This is the
//                              app's own loopback socket traffic; no wire
//                              traffic is decrypted.
//   ZALO_ZCALL_LOG=0           silence stderr logging.
//   ZALO_ZCALL_DEVICES=<json>  DeviceList override (wire-test).

const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const KEY = Buffer.from("yjAF9oqMWl6XfXYJn9mA7w==", "base64");
const IV = Buffer.from("0".repeat(32), "hex");
const CHUNK = 4e3; // host chunk size, hex chars (module "4KIH")

const CAPTURE = process.env.ZALO_ZCALL_CAPTURE || null;
const LOG = process.env.ZALO_ZCALL_LOG !== "0";

function log(...a) {
    if (!LOG) return;
    const line = "[zcall-agent] " + a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ") + "\n";
    try { console.error(line.trimEnd()); } catch (e) { /* headless */ }
    // main.js pipes our stderr away; keep a local trace too.
    try {
        fs.appendFileSync(path.join(os.homedir(), ".config", "ZaloData", "zcall-agent.log"),
            new Date().toISOString() + " " + line);
    } catch (e) { /* best effort */ }
}
function capture(kind, payload) {
    if (!CAPTURE) return;
    try {
        fs.appendFileSync(CAPTURE, JSON.stringify({ t: Date.now(), kind, payload }) + "\n");
    } catch (e) { /* capture must never break the bridge */ }
}

// ---- crypto (mirrors main.js module "vqv6") --------------------------------
function encrypt(obj) {
    const c = crypto.createCipheriv("aes-128-cbc", KEY, IV);
    const s = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
    return s.toString("hex");
}
function decryptHex(hex) {
    const d = crypto.createDecipheriv("aes-128-cbc", KEY, IV);
    const s = Buffer.concat([d.update(Buffer.from(hex, "hex")), d.final()]);
    return s.toString();
}
// Chunker mirror of module "4KIH" — used by the wire-test host emulation.
function buildListMsgs(hex) {
    const total = Math.floor((hex.length + CHUNK - 1) / CHUNK);
    const seq = Math.max(Date.now(), 1);
    if (total <= 1) return [hex + "$"];
    const out = [];
    for (let i = 0; i < total; i++) {
        out.push(hex.slice(0, CHUNK) + `#${seq}#${total}#${i}#$`);
        hex = hex.slice(CHUNK);
    }
    return out;
}

// ---- engine -> host (write leg: connect to host's serverRecv) ---------------
// Paced writes: one frame in flight, next on write-complete (setImmediate),
// mirroring the host's own G/$ drain discipline.
let outSock = null;
const sendQueue = [];
let sending = false;

function pump() {
    if (sending || !outSock || outSock.destroyed) return;
    const next = sendQueue.shift();
    if (next === undefined) return;
    sending = true;
    outSock.write(next, (err) => {
        sending = false;
        if (err) return log("send failed:", err.message);
        setImmediate(pump);
    });
}
/** Send a message to the host as a single `$`-framed hex cipher frame. */
function sendToHost(msg) {
    const hex = encrypt(msg);
    if (hex.length > CHUNK) log("WARN: frame exceeds host chunk size; host Y() parses it whole anyway");
    sendQueue.push(hex + "$");
    pump();
}

// ---- device enumeration -----------------------------------------------------
function tryCmd(cmd, args, timeout) {
    try {
        return execFileSync(cmd, args, { encoding: "utf8", timeout: timeout || 3000, stdio: ["ignore", "pipe", "ignore"] });
    } catch (e) {
        return null;
    }
}

function listAlsaDevices() {
    const out = { inputs: [], outputs: [] };
    const parse = (txt, bucket) => {
        if (!txt) return;
        let pending = null;
        for (const line of txt.split("\n")) {
            const d = line.match(/^(\S+?:)\s*$/); // aplay -L: name alone, then indented Description
            if (d) { pending = d[1]; continue; }
            const m = line.match(/^\s+Description:\s*(.*)/);
            if (m && pending) { bucket.push({ id: pending, name: m[1].trim() }); pending = null; }
        }
    };
    parse(tryCmd("aplay", ["-L"]), out.outputs);
    parse(tryCmd("arecord", ["-L"]), out.inputs);
    return out;
}

function listPulseDevices() {
    const sinks = tryCmd("pactl", ["list", "short", "sinks"]);
    const sources = tryCmd("pactl", ["list", "short", "sources"]);
    if (sinks === null && sources === null) return null; // pactl absent (pure PipeWire)
    const details = (tryCmd("pactl", ["list", "sinks"]) || "") + "\n" + (tryCmd("pactl", ["list", "sources"]) || "");
    const descOf = (name) => {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const m = details.match(new RegExp("Name: " + esc + "\\b[\\s\\S]{0,800}?description:\\s*([^\\n]+)", "i"));
        return m ? m[1].trim() : name;
    };
    const parse = (txt) => (txt || "").split("\n").flatMap((line) => {
        const p = line.split("\t");
        if (p.length < 2 || !p[1]) return [];
        if (/\.monitor\b/.test(p[1])) return []; // skip monitor sources
        return [{ id: p[1], name: descOf(p[1]) }];
    });
    return { inputs: parse(sources), outputs: parse(sinks) };
}

function listPwDevices() {
    const dump = tryCmd("pw-dump", [], 4000);
    if (!dump) return null;
    try {
        const nodes = JSON.parse(dump);
        const out = { inputs: [], outputs: [] };
        for (const n of nodes) {
            const props = n && n.info && n.info.props;
            if (!props) continue;
            const cls = props["media.class"] || "";
            const name = props["node.name"] || props["media.name"];
            if (!name || /monitor/i.test(name)) continue;
            if (/^Audio\/Sink\b|Output\/Audio/.test(cls)) out.outputs.push({ id: String(n.id), name });
            else if (/^Audio\/Source\b|Input\/Audio/.test(cls)) out.inputs.push({ id: String(n.id), name });
        }
        return out;
    } catch (e) {
        return null;
    }
}

function listVideoDevices() {
    const out = [];
    const l = tryCmd("ls", ["/dev"], 2000);
    if (l) for (const d of l.split("\n")) {
        if (/^video\d+$/.test(d)) out.push({ id: "/dev/" + d, name: "/dev/" + d });
    }
    return out;
}

/** DeviceList shape consumed by the renderer (pc-dist setDeviceListData
 *  ~278080 and device modal ~585806): { autoAudioInput, autoAudioOutput,
 *  defaultAudInputDevice, defaultAudOutputDevice, defaultVidDevice,
 *  otherAudInputDevice[], otherAudOutputDevice[], otherVidDevice[] };
 *  entries are {id, name, guid}. */
function buildDeviceList() {
    if (process.env.ZALO_ZCALL_DEVICES) {
        try { return JSON.parse(process.env.ZALO_ZCALL_DEVICES); } catch (e) { }
    }
    const pw = listPulseDevices() || listPwDevices() || { inputs: [], outputs: [] };
    const alsa = (pw.inputs.length || pw.outputs.length) ? { inputs: [], outputs: [] } : listAlsaDevices();
    const guidFor = (d) => "zlinux-" + crypto.createHash("md5").update(d.id).digest("hex");
    const mk = (d) => ({ id: d.id, name: d.name, guid: guidFor(d) });
    const inputs = [...pw.inputs, ...alsa.inputs].map(mk);
    const outputs = [...pw.outputs, ...alsa.outputs].map(mk);
    const videos = listVideoDevices().map(mk);
    return {
        autoAudioInput: true,
        autoAudioOutput: true,
        defaultAudInputDevice: inputs[0] || null,
        defaultAudOutputDevice: outputs[0] || null,
        defaultVidDevice: videos[0] || null,
        otherAudInputDevice: inputs,
        otherAudOutputDevice: outputs,
        otherVidDevice: videos,
    };
}

// ---- call handling ----------------------------------------------------------
// callState values the window handles: free, invite, receive_ringing, dialing,
// peer_busy, network_error, end ... The host itself emits
// {state:"free"} on engine socket end/exit (main.js ~10866/10872/10902), so
// teardown notification stays the host's job.
const NO_MEDIA_REASON = "media engine not implemented on linux (see CALL-LINUX.md)";
let callActive = false;
let callPartnerId = "";

function sendToHost(msg) {
    const hex = encrypt(msg);
    capture("engine->host", msg);
    if (hex.length > CHUNK) log("WARN: frame exceeds host chunk size; host Y() parses it whole anyway");
    sendQueue.push(hex + "$");
    pump();
}

function endCall(reason) {
    if (!callActive) return;
    callActive = false;
    log("ending call:", reason);
    // Mirror the renderer's own teardown so the window leaves dialing:
    // callState free + the "end" sendSignal that handleEndAllCall emits.
    sendToHost({ type: "update", command: "callState", data: { state: "free" } });
    sendToHost({ type: "sendSignal", command: "end", data: null });
}

let initInfo = {};
const nativeIdentity=new (require('./native-identity').NativeIdentity)();
const setupEnabled=process.env.ZALO_ZCALL_NATIVE_SETUP==='1';
const networkEnabled=process.env.ZALO_ZCALL_NATIVE_NETWORK==='1';
const mediaEnabled=process.env.ZALO_ZCALL_NATIVE_MEDIA==='1';
// Outgoing camera transport only; remote video rendering remains incomplete.
const videoEnabled=process.env.ZALO_ZCALL_NATIVE_VIDEO==='1' && networkEnabled && mediaEnabled;
let nativeVideoSink;
function getNativeVideoSink() {
    if(process.env.ZALO_ZCALL_VIDEO_PIPE!=='3')throw new Error('Native video display pipe unavailable');
    if(!nativeVideoSink) {
        const stream=new (require('net').Socket)({fd:3,readable:true,writable:true});
        nativeVideoSink=require('../android-zrtc/video-pipe.cjs').createVideoPipeSink(stream);
    }
    return nativeVideoSink;
}
let setupTransport=null, outgoingSetup=null, incomingAttempt=null;
let nativeAppLocked=process.env.ZALO_ZCALL_APP_LOCKED==='1';
function setupPhase(phase) {
    if(process.env.ZALO_ZCALL_SCHEMA_LOG) {
        try {require('./signal-schema').record(process.env.ZALO_ZCALL_SCHEMA_LOG,
            {type:'update',command:'linux-native-setup',data:{phase}});} catch (_) {}
    }
}
if(setupEnabled) {
    const {DesktopSignaling}=require('./desktop-signaling');
    const {OutgoingSetup}=require('./outgoing-setup');
    setupTransport=new DesktopSignaling(sendToHost);
    outgoingSetup=new OutgoingSetup(setupTransport,{allowVideo:videoEnabled,onPhase:setupPhase,getContext:()=>nativeIdentity.ticket(),onConfig:async(config,{callId,calleeId,video,current,signal,context})=>{
        const {callerResponse}=await import('../android-zrtc/caller-response.mjs');
        let mapped;
        try {
            mapped=callerResponse(config,{callId,clientVersion:initInfo.clientVersion,video,experimentalVideo:videoEnabled,
                offlineConfiguration:!networkEnabled,abortOnServerChange:networkEnabled});
        } catch (error) {
            const phases={CONFIG_CALL_ID:'call-id-mismatch',CONFIG_MEDIA:'unsupported-video',CONFIG_DYNAMIC_ZRTP:'unsupported-dynamic-zrtp'};
            setupPhase(phases[error.code] || 'unsupported-config');throw new Error('Unsupported native config');
        }
        current();nativeIdentity.remember(context,mapped.configuration.userId);
        const {NativeWorker}=await import('../android-zrtc/worker-client.mjs');
        const runtime=process.env.ZALO_ZRTC_RUNTIME;
        if(!runtime || !path.isAbsolute(runtime)) throw new Error('Missing native runtime');
        const pcm=mediaEnabled?{source:process.env.ZALO_ZCALL_PCM_SOURCE,sink:process.env.ZALO_ZCALL_PCM_SINK}:undefined;
        const device=process.env.ZALO_ZCALL_VIDEO_DEVICE;
        if(video && (typeof device!=='string' || !/^\/dev\/video[0-9]+$/.test(device)))throw new Error('Missing explicit video device');
        const videoSink=video?getNativeVideoSink():null;
        const worker=await NativeWorker.start(runtime,{network:networkEnabled,pcm,cpuVideo:video,experimentalVideoNetwork:video});
        try {
            current();
            if(networkEnabled) {
                setupPhase('negotiating-network');
                const {negotiateOutgoing}=await import('../android-zrtc/outgoing-negotiation.mjs');
                let result;
                try {result=await negotiateOutgoing(worker,mapped,{signal});}
                catch(error) {setupPhase('native-negotiation-failed');throw error;}
                current();
                const codecs=await worker.request('audioCodecs'),extra=await worker.request('extendData');
                if(codecs.code!==0 || extra.code!==0) throw new Error('Native offer unavailable');
                setupPhase('native-server-ready');
                const {inviteOutgoing}=await import('../android-zrtc/outgoing-invitation.mjs');
                const {acceptOutgoingAnswer}=await import('../android-zrtc/outgoing-answer.mjs');
                if(video) {
                    const {withOutgoingCallUI}=await import('../android-zrtc/outgoing-voice-ui.mjs');
                    const {runVideoMedia}=await import('../android-zrtc/video-media-session.mjs');
                    return await withOutgoingCallUI(worker,{signal,video:true,
                        runMedia:(mediaWorker,options)=>runVideoMedia(mediaWorker,{...options,device,sink:videoSink})},
                        ({signal:videoSignal,onAnswered,beforeCleanup})=>
                        inviteOutgoing(worker,setupTransport,mapped,result,{calleeId,signal:videoSignal,onPhase:setupPhase,beforeCleanup,
                            onAnswer:async(control,owner)=>{
                                const answer=await acceptOutgoingAnswer(worker,setupTransport,control,mapped.configuration,
                                    {calleeId,signal:videoSignal,onPhase:setupPhase,current:()=>{current();owner.current();}});
                                current();owner.current();
                                const state=await worker.request('videoStats');
                                if(state.code!==0)throw new Error('Video state unavailable');
                                const media=JSON.parse(state.data);
                                if(!media.videoCall || !media.canTransferMedia || media.codecId!==4)throw new Error('Peer did not negotiate native H.264 video');
                                current();owner.current();await onAnswered();return answer;
                            }}));
                }
                if(mediaEnabled) {
                    const {withOutgoingVoiceUI}=await import('../android-zrtc/outgoing-voice-ui.mjs');
                    return await withOutgoingVoiceUI(worker,{signal},({signal:voiceSignal,onAnswered,beforeCleanup})=>
                        inviteOutgoing(worker,setupTransport,mapped,result,{calleeId,signal:voiceSignal,onPhase:setupPhase,beforeCleanup,
                            onAnswer:async(control,owner)=>{
                                const answer=await acceptOutgoingAnswer(worker,setupTransport,control,mapped.configuration,
                                    {calleeId,signal:voiceSignal,onPhase:setupPhase,current:()=>{current();owner.current();}});
                                current();owner.current();await onAnswered();return answer;
                            }}));
                }
                return await inviteOutgoing(worker,setupTransport,mapped,result,{calleeId,signal,onPhase:setupPhase});
            }
            const reply=await worker.request('configure',mapped.configuration);
            if(reply.code!==0) throw new Error('Native configuration rejected');
            current();
            const initialized=await worker.request('initialize');
            if(initialized.code!==0) throw new Error('Native initialization rejected');
            current();setupPhase('configured-offline');
            // Keep online/RTP disabled until native readiness and device
            // selection are implemented. Do not emit 416 from a config ACK.
            return {callReady:false,offline:true};
        } finally {await worker.close();}
    }});
}

function handleHostMessage(msg) {
    if (process.env.ZALO_ZCALL_SCHEMA_LOG) {
        try {require('./signal-schema').record(process.env.ZALO_ZCALL_SCHEMA_LOG,msg);}
        catch (_) {log('schema capture failed');}
    }
    const { type, command, data } = msg || {};
    capture("host->engine", msg);
    if(setupTransport && ['recvSignal','recvSignalError'].includes(type)) {
        setupTransport.receive(msg);return;
    }
    if(setupTransport && type==='control') {
        setupTransport.receive(msg);
        if(incomingAttempt && data?.act_type==='voip' && ['cancel','endcall'].includes(data.act) &&
            String(data.data?.callId)===incomingAttempt.callId && String(data.data?.uidFrom)===incomingAttempt.callerId)
            incomingAttempt.controller.abort();
        if(data?.act_type==='voip' && data.act==='request' && !callActive && !nativeAppLocked &&
            process.env.ZALO_ZCALL_NATIVE_INCOMING==='1' && networkEnabled && mediaEnabled) {
            let nativeLocalId;
            try {nativeLocalId=nativeIdentity.resolve();}
            catch {setupPhase('incoming-identity-unavailable');return;}
            callActive=true;
            const attempt={controller:new AbortController(),promise:null,
                callId:String(data.data?.callId),callerId:String(data.data?.uidFrom)};incomingAttempt=attempt;
            attempt.promise=import('../android-zrtc/incoming-desktop.mjs').then(({runIncomingDesktop})=>
                runIncomingDesktop(setupTransport,msg,{nativeLocalId,clientVersion:initInfo.clientVersion,
                    runtime:process.env.ZALO_ZRTC_RUNTIME,
                    pcm:{source:process.env.ZALO_ZCALL_PCM_SOURCE,sink:process.env.ZALO_ZCALL_PCM_SINK},
                    videoEnabled,device:process.env.ZALO_ZCALL_VIDEO_DEVICE,
                    sink:videoEnabled?getNativeVideoSink():null,
                    signal:attempt.controller.signal,onPhase:phase=>{
                        setupPhase('incoming-'+phase);
                        if(phase==='ringing')sendToHost({type:'update',command:'callState',data:{state:'ringing'}});
                    }})).catch(()=>setupPhase('incoming-failed')).finally(()=>{
                        if(incomingAttempt===attempt){incomingAttempt=null;endCall('incoming ended');}
                    });
        }
        return;
    }
    if (type === "update") {
        switch (command) {
            case "linux-app-lock":
                if(typeof data==='boolean') {
                    nativeAppLocked=data;
                    if(data)incomingAttempt?.controller.abort();
                }
                return;
            case "init":
            case "updateLocal":
                const previousAccount=nativeIdentity.account;
                initInfo = data || initInfo;
                nativeIdentity.setAccount(initInfo.local && initInfo.local.id);
                if(previousAccount!==nativeIdentity.account)incomingAttempt?.controller.abort();
                if(previousAccount!==nativeIdentity.account && callActive && outgoingSetup)
                    outgoingSetup.stop().finally(()=>endCall('account changed'));
                log("init received:", JSON.stringify(data && { local: data.local && data.local.id, os: data.osInfo, client: data.clientVersion }));
                capture("init", data);
                if(setupEnabled) sendToHost({type:'update',command:'linux-native-capabilities',data:{signalingErrors:true}});
                sendToHost({ type: "update", command: "listDevice", data: buildDeviceList() });
                return;
            case "listDevice":
            case "updateLang":
            case "advancedOptions":
                return; // informational host pushes; nothing to apply
            default:
                log("unhandled update command:", command);
                return;
        }
    }
    if (type === "request") {
        if(command==='endCall' && incomingAttempt) {incomingAttempt.controller.abort();return;}
        if(command==='endCall' && outgoingSetup) {
            outgoingSetup.stop().finally(()=>endCall('setup canceled'));return;
        }
        if (command === "listDevice") {
            // H case "response": -> renderer channel "call-response-listDevice"
            sendToHost({ type: "response", command: "listDevice", data: buildDeviceList() });
            return;
        }
        if (command === "makeCall") {
            if(outgoingSetup) {
                if(callActive) return;
                callActive=true;
                outgoingSetup.start(data).catch(()=>setupPhase('setup-failed'))
                    .finally(()=>endCall('native setup stage finished; media unavailable'));
                return;
            }
            // Honest surface: the ZRTP media engine is proprietary and absent,
            // so the call cannot connect. Release the renderer gate
            // deterministically (otherwise `callRunning` sticks and every call
            // button locks forever after one click), then leave an in-chat
            // trace via the update channel the renderer actually consumes.
            // (Diagnostics: ZALO_ZCALL_HOLD=ms holds ringing instead; used to
            // prove the renderer emits NO signaling frames through the bridge
            // -- call auth/SDP live only inside the proprietary mac binary.)
            callActive = true;
            const pd = (data && data.partner) || {};
            callPartnerId = (Array.isArray(pd) && pd[0] && pd[0].id) || pd.id || "";
            log("makeCall received:", JSON.stringify(callPartnerId || pd));
            const holdMs = Number(process.env.ZALO_ZCALL_HOLD || 0);
            if (holdMs > 0) {
                sendToHost({ type: "update", command: "callState", data: { state: "ringing" } });
                setTimeout(() => endCall("hold-expired"), holdMs);
            } else {
                // Release first; frames sent mid-teardown get swallowed.
                setTimeout(() => {
                    endCall(NO_MEDIA_REASON);
                    setTimeout(() => {
                        // "bubble" -> renderer writes a call message into the
                        // conversation (role 1 = outgoing, duration 0 = no
                        // connection), the same channel the mac engine uses.
                        sendToHost({
                            type: "update", command: "bubble",
                            data: { role: 1, duration: 0, partnerId: callPartnerId }
                        });
                    }, 250);
                }, 300);
            }
            return;
        }
        log("unhandled request command:", command);
        return;
    }
    if (type === "sendSignal") {
        // host->engine websocket relay: numeric commands (401 requestCall,
        // 402 accept, 403 decline, 406, 407, 416 sendRequestCall, 12447
        // killCall, ...). Without the ZRTP media leg we cannot connect audio;
        // end immediately so the UI resolves deterministically instead of
        // hanging until the renderer's own 408/413/415 server timeouts.
        const cmd = String(command);
        if (/^\d+$/.test(cmd)) {
            callActive = true;
            capture("signal->engine", { command, data });
            endCall(NO_MEDIA_REASON);
        }
        // "end" / "cancel" / "reject" / "group/end" also arrive here.
        return;
    }
    if (type === "response") return; // not part of the host->engine grammar
    log("unhandled message:", type, command);
}

// ---- sockets ----------------------------------------------------------------
const chunks = new Map();
let inBuf = "";
let inSock = null; // read leg: host's serverSend (host->engine + ACK target)
let legCount = 0;

function ackLeg() {
    // The host's serverSend data handler clears its in-flight gate x and pops
    // the queued chunk (main.js: `E || (x = !1, G(e))`). $ sets x=true for
    // EVERY frame it writes — single frames included — so the engine must
    // write something back on this leg after every frame, or the host's
    // sender deadlocks on its next message.
    if (inSock && !inSock.destroyed) inSock.write("#");
}

function handleFrame(frame) {
    let hex = frame, seq = 0, total = 1, index = 0;
    // Chunk suffix per module "4KIH": `<hex>#<seq>#<total>#<idx>#` — note the
    // TRAILING '#'; without it the regex never matches and every chunk frame
    // falls through to the plain path and fails decryption.
    const m = frame.match(/^(.*)#(\d+)#(\d+)#(\d+)#$/);
    if (m) {
        hex = m[1]; seq = +m[2]; total = +m[3]; index = +m[4];
    }
    ackLeg();
    if (total > 1) {
        const parts = (chunks.get(seq) || []).concat([{ index, hex }]);
        chunks.set(seq, parts);
        if (parts.length < total) return; // wait for the rest
        chunks.delete(seq);
        try {
            const full = parts.slice().sort((a, b) => a.index - b.index).map((p) => p.hex).join("");
            handleHostMessage(JSON.parse(decryptHex(full).replace(/[\0]/g, "")));
        } catch (e) {
            log("chunk reassembly failed:", e.message);
        }
        return;
    }
    try {
        handleHostMessage(JSON.parse(decryptHex(hex).replace(/[\0]/g, "")));
    } catch (e) {
        // The host swallows bad frames too ("cannot parse payload").
        log("frame parse failed:", e.message);
    }
}

function onInData(d) {
    inBuf += d.toString();
    let i;
    while ((i = inBuf.indexOf("$")) >= 0) {
        const frame = inBuf.slice(0, i);
        inBuf = inBuf.slice(i + 1);
        if (frame) handleFrame(frame);
    }
}

function onLegUp() {
    // native-ready must fire only when BOTH legs are connected (see header:
    // the host installs its socket writer in the serverSend connection
    // handler, and engine frames must land on serverRecv).
    if (++legCount < 2) return;
    log("connected both legs");
    sendToHost({ type: "update", command: "native-ready" });
}

function connectSockets(recvPath, sendPath) {
    outSock = net.connect(recvPath, onLegUp); // host serverRecv: we WRITE there
    inSock = net.connect(sendPath, onLegUp);  // host serverSend: we READ there
    inSock.on("data", onInData);
    inSock.on("end", () => { log("send leg ended"); teardown(); });
    inSock.on("error", (e) => { log("send leg error:", e.code || e.message); teardown(); });
    outSock.on("end", () => { log("recv leg ended"); teardown(); });
    outSock.on("error", (e) => { log("recv leg error:", e.code || e.message); teardown(); });
}

let torn = false;
function teardown(code) {
    if (torn) return;
    torn = true;
    incomingAttempt?.controller.abort();
    setupTransport?.close();
    try { outSock && outSock.destroy(); } catch (e) { }
    try { inSock && inSock.destroy(); } catch (e) { }
    const exitCode=code === undefined ? 0 : code;
    const deadline=setTimeout(()=>process.exit(exitCode),15000);deadline.unref();
    Promise.allSettled([incomingAttempt?.promise,outgoingSetup?.stop()]).finally(()=>{
        clearTimeout(deadline);process.exit(exitCode);
    });
}

function main() {
    const [recvPath, sendPath] = process.argv.slice(2);
    if (!recvPath || !sendPath) {
        console.error("usage: zcall-agent.js <recvSocket> <sendSocket>");
        process.exit(2);
    }
    process.on("SIGINT", () => { log("SIGINT (host killMe/exit)"); teardown(0); });
    process.on("SIGTERM", () => teardown(0));
    process.on("uncaughtException", (e) => { log("uncaught:", e.stack || e); teardown(1); });
    log("start", { recvPath, sendPath, pid: process.pid, runtime: process.versions.electron ? "electron-as-node " + process.versions.node : "node " + process.version, os: os.platform() + "/" + os.arch() });
    connectSockets(recvPath, sendPath);
    // If the sockets never answer (stale inodes), exit so the host's exit
    // handler resets state instead of waiting forever.
    setTimeout(() => { if (!inSock || !inSock.writable) { log("socket timeout"); teardown(1); } }, 30000).unref();
}

module.exports = { encrypt, decryptHex, buildListMsgs, buildDeviceList };
if (require.main === module) main();
