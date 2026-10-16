import { useEffect, useRef } from "react";
import Hls from "hls.js";

/**
 * Plays a Mux video as a silent, looping hero background.
 *
 * What changed vs. the first version (why the video was stuck on the poster):
 *  1. hls.js is now used FIRST whenever the browser supports Media Source
 *     Extensions (Chrome, Edge, Firefox, Android, desktop Safari). Native HLS
 *     is only the fallback (iPhone Safari). Before, any browser that merely
 *     *claimed* it could play HLS natively skipped hls.js and could silently
 *     fail, leaving only the poster image on screen.
 *  2. The video is force-muted through the DOM property (React's `muted`
 *     attribute is not always applied before autoplay is evaluated).
 *  3. Playback is retried on `canplay`, on tab-visible, and on the first user
 *     interaction, instead of giving up after one blocked play() call.
 *  4. hls.js errors are handled (network / media recovery) and, as a last
 *     resort, we fall back to a plain MP4 rendition.
 *  5. Errors are logged to the console so you can see what is going wrong.
 */
const PLAYBACK_ID = "Su2DptAC9ON1Jn1eUHVrLQmTp02Yrzep77x1Xgcq5EF00";
const HLS_SRC = `https://stream.mux.com/${PLAYBACK_ID}.m3u8`;
const MP4_FALLBACK = `https://stream.mux.com/${PLAYBACK_ID}/capped-1080p.mp4`;
const POSTER = `https://image.mux.com/${PLAYBACK_ID}/thumbnail.jpg?time=0&width=1600`;

export default function BackgroundVideo() {
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let hls = null;
    let destroyed = false;

    // Make sure autoplay policies treat this as a silent video.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const tryPlay = () => {
      if (destroyed || !video.paused) return;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => console.warn("[BackgroundVideo] play() blocked:", err?.name || err));
      }
    };

    const useMp4Fallback = () => {
      if (destroyed) return;
      console.warn("[BackgroundVideo] Falling back to MP4:", MP4_FALLBACK);
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.src = MP4_FALLBACK;
      video.load();
      tryPlay();
    };

    if (Hls.isSupported()) {
      // Chrome / Edge / Firefox / Android / desktop Safari
      hls = new Hls({ capLevelToPlayerSize: true, enableWorker: true });
      hls.loadSource(HLS_SRC);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        console.warn("[BackgroundVideo] hls.js error:", data.type, data.details, data.fatal ? "(fatal)" : "");
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad(); // retry
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            useMp4Fallback();
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // iPhone Safari: native HLS
      video.src = HLS_SRC;
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
    } else {
      useMp4Fallback();
    }

    // Retry triggers
    video.addEventListener("canplay", tryPlay);
    const onVisible = () => document.visibilityState === "visible" && tryPlay();
    document.addEventListener("visibilitychange", onVisible);

    // If the browser still blocked autoplay, start on first interaction.
    const interactions = ["pointerdown", "touchstart", "keydown", "scroll"];
    const onInteract = () => {
      tryPlay();
      if (!video.paused) interactions.forEach((e) => window.removeEventListener(e, onInteract));
    };
    interactions.forEach((e) => window.addEventListener(e, onInteract, { passive: true }));

    return () => {
      destroyed = true;
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", onVisible);
      interactions.forEach((e) => window.removeEventListener(e, onInteract));
      if (hls) hls.destroy();
    };
  }, []);

  return (
    <video
      ref={ref}
      className="hero__video"
      poster={POSTER}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
