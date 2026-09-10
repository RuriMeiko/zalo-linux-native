#pragma once
#include <pthread.h>
#include <stddef.h>
#include <string.h>
typedef struct { pthread_mutex_t lock; int muted; } ZrtcCaptureGate;
#define ZRTC_CAPTURE_GATE_INIT {PTHREAD_MUTEX_INITIALIZER, 0}
static inline void zrtc_capture_gate_set(ZrtcCaptureGate *gate, int muted) {
    pthread_mutex_lock(&gate->lock);
    gate->muted = muted != 0;
    pthread_mutex_unlock(&gate->lock);
}
/* Hold through the recording callback. A setter cannot acknowledge while
 * an earlier unmuted PCM block is still being handed to the encoder. This
 * cannot recall audio already encoded or sent before the setter acquired it. */
static inline void zrtc_capture_gate_begin(ZrtcCaptureGate *gate, void *pcm, size_t bytes) {
    pthread_mutex_lock(&gate->lock);
    if (gate->muted) memset(pcm, 0, bytes);
}
static inline void zrtc_capture_gate_end(ZrtcCaptureGate *gate) {
    pthread_mutex_unlock(&gate->lock);
}
