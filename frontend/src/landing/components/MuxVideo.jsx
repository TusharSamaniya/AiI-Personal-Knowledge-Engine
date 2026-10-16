import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/**
 * Looping, muted Mux video that
 *  - only starts downloading when the slide is close (near),
 *  - plays from the start each time its slide becomes active,
 *  - pauses when the slide is not active.
 */
export default function MuxVideo({ playbackId, active, near, fit = "cover" }) {
  const ref = useRef(null);
  const hlsRef = useRef(null);
  const activeRef = useRef(active);
  const [ready, setReady] = useState(false);
  activeRef.current = active;

  const src = `https://stream.mux.com/${playbackId}.m3u8`;
  const poster = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0&width=1000`;

  // start loading once the slide is the current one or a neighbour
  useEffect(() => {
    if (near) setReady(true);
  }, [near]);

  useEffect(() => {
    if (!ready) return;
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;

    const play = () => {
      if (!activeRef.current) return;
      const p = video.play();
      if (p && p.catch) p.catch((e) => console.warn("[MuxVideo] play() blocked:", e?.name || e));
    };

    if (Hls.isSupported()) {
      const hls = new Hls({ capLevelToPlayerSize: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.on(Hls.Events.ERROR, (_e, d) => {
        console.warn("[MuxVideo] hls.js error:", d.type, d.details, d.fatal ? "(fatal)" : "");
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else hls.destroy();
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", play, { once: true });
    }
    video.addEventListener("canplay", play);

    return () => {
      video.removeEventListener("canplay", play);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [ready, src]);

  // play from the start when the slide becomes active, pause when it leaves
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active) {
      try { video.currentTime = 0; } catch { /* not seekable yet */ }
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      video.pause();
    }
  }, [active, ready]);

  return (
    <video
      ref={ref}
      className="hiw__video"
      style={{ objectFit: fit }}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
