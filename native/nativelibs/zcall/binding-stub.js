'use strict';
// Linux stub - zcall native binary is macOS only
const noop = () => {};
const noopPromise = () => Promise.resolve({});

const stub = {
    MainApp: () => ({
        check:               noop,
        authenication:       noopPromise,
        setCallback:         noop,
        setConfigData:       noopPromise,
        makeCall:            noop,
        incomingCall:        noop,
        stop:                noop,
        mute:                noop,
        stopCapture:         noop,
        holdAudio:           noop,
        getCallInfo:         () => ({}),
        getJsonStats406:     () => '{}',
        getListDevices:      () => [],
        getEventMessage:     () => null,
        getVideoFrame:       noop,
        getVideoFrameLocal:  noop,
        changeAudioDevice:   noop,
        setAudioVolume:      noop,
        changeVideoDevice:   noop,
        setAgc:              noop,
        startDesktopCapture: noop,
        stopDesktopCapture:  noop,
        changeMinMaxMobileBitrate: noop,
        getExtendData:       () => '{}',
        getActiveAudioCodecs: () => [],
        bindGetPeerId:       noop,
        setConfig:           noop,
        setMediaConfig:      noop,
        setConfigServer:     noop,
        setListServers:      noop,
        updateCallerInfo:    noop,
        setState:            noop,
        testBuffer:          noop,
        // vcmac.check() does `instance.test(123) == 123`; returning a falsy
        // value keeps calling reported as unavailable instead of fake-enabled.
        test:                () => 0,
    })
};
module.exports = stub;
