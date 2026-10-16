/* ------------------------------------------------------------------ *
 *  The "machine" animation – ported from the original
 *  Login-Page-Animation project (vanilla JS) into a React-friendly
 *  factory.  It does NOT read the form itself: React tells it what is
 *  going on through the small API returned at the bottom.
 *
 *    emailValid   -> spiral unwinds, weight drops, scales tip, car rolls,
 *                    a hand grabs the car
 *    passwordValid-> gears turn, a hand pumps a spray can that sprays the
 *                    label onto the submit button
 *    agreed       -> a line pulls the submit button into place
 *                    (only once the hand has grabbed, i.e. email is valid)
 * ------------------------------------------------------------------ */
import { gsap } from "gsap";

export function createAuthMachine(root) {
  const q = (s) => root.querySelector(s);
  const qa = (s) => Array.from(root.querySelectorAll(s));

  const setAttrs = (el, attrs) => Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));

  const ctx = gsap.context(() => {}, root);
  const run = (fn) => ctx.add(fn); // run fn now, and let GSAP track everything it creates

  const containerEl = q(".am-container");
  const submitBtn = q(".am-submit");

  const sprayer = q(".sprayer");
  const sprayHandContainer = q(".spray-hand-container");
  const sprayLines = qa(".spray-line");
  const sprayBubbles = qa(".spray-bubble");
  const pushingHand = q(".pushing-hand");
  const sprayerHead = q(".sprayer-head");
  const gearsContainer = q(".am-svg .gears");
  const gearConnector = q(".gear-connector");
  const pullSystemContainer = q(".pull-system");
  const checkboxPullLine = q(".checkbox-pull-line");
  const checkboxPullCircle = q(".checkbox-pull-circle");
  const btnPullLine = q(".submit-btn-connector");
  const btnHandlerCircle = q(".submit-btn-circle");
  const spiralContainer = q(".spiral-container");
  const weightBigContainer = q(".weight-big-container");
  const scalesContainer = q(".scales-container");
  const scalesLine = q(".scales-moving-line");
  const weightBig = q(".weight-big");
  const spiralPath = q(".spiral-path");
  const carContainer = q(".car-container");
  const car = q(".car");
  const carInclineWrapper = q(".car-container g");
  const timingChains = qa(".timing-chain");
  const reelsConnector = q(".reels-connector");
  const carWeightConnector = q(".car-weight-connector");
  const grabbingHand = qa(".grabbing-hand");
  const grabbingHandOpenFingers = qa(".grabbing-hand-finger-open");
  const grabbingHandClosedFingers = qa(".grabbing-hand-finger-closed");

  let sprayRepeatCounter = 0;
  const state = { handClosed: false, sumbitBtnOnPlace: false, sumbitBtnTextOpacity: 0, pullProgress: 0 };

  let agreed = false;
  let lastHandClosed = false;
  let pullTl = null;
  let emailTl = null;
  let gearsTls = [];

  /* ---------------------------- layout ---------------------------- */
  function layoutPreparation() {
    gsap.set(pullSystemContainer, { x: 375, y: 646 });
    gsap.set(sprayHandContainer, { x: 700, y: 621 });
    gsap.set(sprayer, { x: -59.5, y: 53 });
    gsap.set(carContainer, { x: 190, y: 802 });
    gsap.set(scalesContainer, { x: 170, y: 710 });
    gsap.set(grabbingHand, { x: 297, y: 830 });
    gsap.set(grabbingHandClosedFingers, { opacity: 0 });
    gsap.set(spiralContainer, { x: 305, y: 435, svgOrigin: "14 14", scaleX: -1 });
    gsap.set(weightBigContainer, { x: 305, y: 435 });
    gsap.set([sprayLines, sprayBubbles], { opacity: 0 });
    gsap.set(timingChains[0], { attr: { "stroke-width": "5", "stroke-dasharray": "0 12" } });
    gsap.set(timingChains[1], { attr: { "stroke-width": "5", "stroke-dasharray": "0 12" } });
    gsap.set(checkboxPullLine, { attr: { y1: -105, y2: 44 } });
    gsap.set(submitBtn, { color: "rgba(0, 0, 0, 0)", transformOrigin: "100% 0%", rotation: -90 });
    gsap.set(checkboxPullCircle, { y: 44 });
  }

  /* ----------------------- email: spiral + scales ----------------------- */
  function updateSpiralPath(centerX, centerY, radius, coils, points, offset) {
    let path = "";
    let thetaMax = coils * 2 * Math.PI;
    const awayStep = radius / thetaMax;
    const chord = (2 * Math.PI) / points;
    thetaMax -= offset * points * chord;

    for (let theta = 0; theta <= thetaMax; theta += chord) {
      const away = awayStep * theta;
      const x = centerX + Math.cos(theta) * away;
      const y = centerY + Math.sin(theta) * away;
      if (theta === 0) {
        path += `M${x},${y}`;
      } else {
        const prevAway = awayStep * (theta - chord);
        const arcRadius = (away + prevAway) / 2;
        path += ` A${arcRadius},${arcRadius} 0 0,1 ${x},${y}`;
      }
    }

    const outerAngle = thetaMax + 0.5 * Math.PI;
    const outerLength = 50 + 25 * offset;
    const endPoint = [Math.cos(outerAngle) * outerLength, Math.sin(outerAngle) * outerLength];
    path += " l" + endPoint[0] + "," + endPoint[1];

    gsap.set(spiralPath, { attr: { d: path } });
    gsap.set(weightBig, { x: -47 + 3 * offset, y: 12 + outerLength });
  }

  function createEmailTl() {
    const spiralTurnsNumber = 8;
    const spiralProgress = { v: 0 };
    const hammerTimeStart = 1.85;
    const fingersDelay = 0.5;
    const fingersTimeDelta = 0.03;

    const tl = gsap
      .timeline({
        paused: true,
        defaults: { ease: "none", duration: 2 },
        onUpdate: () => {
          updateSpiralPath(14, 14, 45, 17, 200, spiralTurnsNumber * spiralProgress.v);
          // FIX: the original only re-checked "hand closed" when the checkbox was toggled,
          // so ticking the box BEFORE entering the e-mail never pulled the button into place.
          const closed = state.handClosed > 0.5;
          if (closed !== lastHandClosed) {
            lastHandClosed = closed;
            rebuildPullTimeline();
          }
        },
      })
      .to(spiralProgress, { v: 1 }, 0)
      .to(spiralContainer, { rotation: -spiralTurnsNumber * 360 }, 0)
      .fromTo(scalesLine, { rotation: -20, svgOrigin: "92 20" }, { duration: 0.15, rotation: -1, svgOrigin: "92 20" }, hammerTimeStart)
      .fromTo(timingChains[0], { attr: { "stroke-dashoffset": 2 } }, { duration: 0.15, attr: { "stroke-dashoffset": 20 } }, hammerTimeStart)
      .fromTo(timingChains[1], { attr: { "stroke-dashoffset": 24 } }, { duration: 0.15, attr: { "stroke-dashoffset": 6 } }, hammerTimeStart)
      .to(reelsConnector, { duration: 0.15, y: 18 }, hammerTimeStart)
      .to(carWeightConnector, { duration: 0.15, y: -18 }, hammerTimeStart)
      .to(carInclineWrapper, { duration: 0.15, rotation: 6, svgOrigin: "120 93" }, hammerTimeStart)
      .fromTo(car, { x: -50 }, { duration: 0.6, x: 95, ease: "power2.in" }, hammerTimeStart);

    for (let i = 0; i < 5; i++) {
      tl.set(grabbingHandOpenFingers[i], { opacity: 0 }, hammerTimeStart + fingersDelay + fingersTimeDelta * (i + 1)).set(
        grabbingHandClosedFingers[i],
        { opacity: 1 },
        hammerTimeStart + fingersDelay + fingersTimeDelta * (i + 1)
      );
    }
    tl.fromTo(state, { handClosed: false }, { duration: 0.01, handClosed: true }, ">").to(
      grabbingHand,
      { duration: fingersTimeDelta * 5, x: "+=20" },
      hammerTimeStart + fingersDelay
    );

    tl.progress(0.001);
    return tl;
  }

  /* ----------------------- password: gears + spray ----------------------- */
  function createGearsTimelines() {
    const tls = [];
    const params = { baseSize: 15, pitch: 11, teethCurve: 0.6, startPos: { x: 634, y: 389 }, speed: 0.2 };
    const data = [
      { angle: 0, teethNumber: 10, hasHole: true },
      { angle: -0.5, teethNumber: 32, hasHole: true },
      { angle: 1.65, teethNumber: 12, hasHole: false },
    ];
    const handleRadius = 14;
    const gears = [];
    const NS = "http://www.w3.org/2000/svg";

    data.forEach((d, dIdx) => {
      const radius = (d.teethNumber * params.baseSize) / (2 * Math.PI);
      let x, y, startAngle;

      if (dIdx === 0) {
        startAngle = 0;
        x = params.startPos.x;
        y = params.startPos.y;
      } else {
        const parent = gears[dIdx - 1];
        const size = parent.teethNumber / d.teethNumber;
        x = parent.center.x + Math.cos(d.angle) * (parent.radius + radius);
        y = parent.center.y + Math.sin(d.angle) * (parent.radius + radius);
        startAngle = (1 + size) * d.angle - size * parent.angle;
      }

      const group = document.createElementNS(NS, "g");
      const path = document.createElementNS(NS, "path");
      gearsContainer.appendChild(group);
      group.appendChild(path);

      const gear = {
        idx: dIdx,
        center: { x, y },
        radius,
        angle: startAngle,
        teethNumber: d.teethNumber,
        hasHole: d.hasHole,
        toothAngle: (2 * Math.PI) / d.teethNumber,
        toothCurveAngle: params.teethCurve / d.teethNumber,
        group,
      };

      const rOut = gear.radius + 0.25 * params.pitch;
      const rIn = rOut - 0.75 * params.pitch;
      let pathD =
        "M" + (gear.center.x + Math.cos(gear.angle - gear.toothAngle + gear.toothCurveAngle) * rOut) +
        ", " + (gear.center.y + Math.sin(gear.angle - gear.toothAngle + gear.toothCurveAngle) * rOut) + " ";
      for (let a = gear.angle; a < gear.angle + 2 * Math.PI - 0.5 * gear.toothAngle; a += gear.toothAngle) {
        const pa = a - 0.5 * gear.toothAngle;
        pathD += "L" + (gear.center.x + Math.cos(pa - gear.toothCurveAngle) * rOut) + ", " + (gear.center.y + Math.sin(pa - gear.toothCurveAngle) * rOut) + " ";
        pathD += "L" + (gear.center.x + Math.cos(pa) * rIn) + ", " + (gear.center.y + Math.sin(pa) * rIn) + " ";
        pathD += "L" + (gear.center.x + Math.cos(a) * rIn) + ", " + (gear.center.y + Math.sin(a) * rIn) + " ";
        pathD += "L" + (gear.center.x + Math.cos(a + gear.toothCurveAngle) * rOut) + ", " + (gear.center.y + Math.sin(a + gear.toothCurveAngle) * rOut) + " ";
      }

      if (gear.hasHole) {
        const holeRadius = 0.5 * rIn;
        pathD += "M" + (gear.center.x - holeRadius) + ", " + gear.center.y + " ";
        pathD += `A ${holeRadius} ${holeRadius} 1 1 0 ${gear.center.x + holeRadius} ${gear.center.y}`;
        pathD += `A ${holeRadius} ${holeRadius} 1 1 0 ${gear.center.x - holeRadius} ${gear.center.y}`;
      }

      if (dIdx === 0) {
        const circle = document.createElementNS(NS, "circle");
        setAttrs(circle, { cx: gear.center.x, cy: gear.center.y, r: 5, fill: "#000000" });
        gearsContainer.appendChild(circle);
        gsap.set(path, { attr: { fill: "#000000", "fill-opacity": 0.25 } });
      } else if (dIdx === data.length - 1) {
        gsap.set(path, { attr: { fill: "#000000", "fill-opacity": 0.25 } });
        const circle = document.createElementNS(NS, "circle");
        setAttrs(circle, { cx: gear.center.x + handleRadius, cy: gear.center.y, r: 5, fill: "#000000" });
        gear.group.appendChild(circle);
      }

      path.setAttribute("d", pathD);

      const tl = gsap
        .timeline({ repeat: -1, paused: true })
        .to(group, {
          duration: params.speed * gear.teethNumber,
          rotation: 360 * (gear.idx % 2 ? -1 : 1),
          svgOrigin: gear.center.x + " " + gear.center.y,
          ease: "none",
        });

      if (dIdx === data.length - 1) {
        tl.eventCallback("onUpdate", () => {
          const angle = tl.progress() * 2 * Math.PI;
          const deltaY = Math.sin(angle) * handleRadius;
          gsap.set(pushingHand, { y: deltaY });

          if (deltaY > 8) {
            const dd = Math.max(0, deltaY - 8);
            gsap.set(sprayerHead, { y: dd });

            let sprayProgress = Math.max(0, tl.progress() - 0.1);
            sprayProgress *= 1 / 0.2;

            let bubblesOpacity = sprayProgress > 1 ? 0 : sprayProgress;
            bubblesOpacity *= 1 - Math.pow(bubblesOpacity, 8);

            const textProgress = Math.pow(sprayProgress / 1.5, 6);

            if (!state.sumbitBtnOnPlace) {
              // a bit faster than the original (0.3 per spray) so the label shows after ~3 sprays
              state.sumbitBtnTextOpacity = (sprayRepeatCounter - 1) * 0.5 + 0.5 * textProgress;
              state.sumbitBtnTextOpacity = Math.min(1, Math.pow(state.sumbitBtnTextOpacity, 2));
            }

            gsap.set(submitBtn, { color: "rgba(0, 0, 0, " + state.sumbitBtnTextOpacity + ")" });
            gsap.set(sprayLines, {
              attr: { "stroke-dashoffset": 70 * sprayProgress },
              opacity: Math.pow(bubblesOpacity, 2),
            });
            sprayBubbles.forEach((b, bIdx) => {
              gsap.set(b, {
                x: 25 * (1 - sprayProgress) * (1 + 0.1 * bIdx),
                scale: 0.5 + 1.4 * Math.pow(sprayProgress, 2),
                transformOrigin: "center center",
                opacity: bubblesOpacity,
              });
            });
          }

          gsap.set(gearConnector, {
            attr: {
              x1: gear.center.x + handleRadius * Math.cos(angle),
              y1: gear.center.y + handleRadius * Math.sin(angle),
              x2: 700 + 18,
              y2: 646 - 100 + deltaY,
            },
          });
        });

        tl.eventCallback("onRepeat", () => {
          if (!state.sumbitBtnOnPlace) sprayRepeatCounter++;
        });
      }

      tl.progress(0.6);
      tls.push(tl);
      gears.push(gear);
    });

    return tls;
  }

  /* ----------------------- checkbox: pull the button ----------------------- */
  function createPullingTimeline(isFixed, btnPulled) {
    const tl = gsap.timeline({
      defaults: { ease: "power1.inOut", duration: 1 },
      onUpdate: animatePullingLine,
    });

    if (isFixed && btnPulled) {
      tl.to(state, { pullProgress: 1 }, 0)
        .to(submitBtn, { rotation: 0 }, 0)
        .to(state, { duration: 0.1, sumbitBtnOnPlace: 1 }, 0.9)
        .to(checkboxPullLine, { attr: { y2: 44 - 130 } }, 0)
        .to(checkboxPullCircle, { y: 44 - 130 }, 0);
    } else if (!isFixed && btnPulled) {
      // FIX: if the e-mail became invalid again, the button used to stay flat – hang it back up.
      tl.to(state, { pullProgress: 1 }, 0)
        .to(submitBtn, { rotation: -90 }, 0)
        .to(state, { duration: 0.1, sumbitBtnOnPlace: 0 }, 0)
        .to(checkboxPullLine, { attr: { y2: 44 - 130 } }, 0)
        .to(checkboxPullCircle, { y: 44 - 130 }, 0);
    } else if (isFixed && !btnPulled) {
      tl.to(state, { pullProgress: 0 }, 0)
        .to(submitBtn, { rotation: -90 }, 0)
        .to(state, { duration: 0.1, sumbitBtnOnPlace: 0 }, 0)
        .to(checkboxPullLine, { attr: { y2: 44 } }, 0)
        .to(checkboxPullCircle, { y: 44 }, 0);
    } else {
      tl.to(state, { pullProgress: 0 }, 0)
        .to(submitBtn, { rotation: -90 }, 0)
        .to(state, { duration: 0.1, sumbitBtnOnPlace: 0 }, 0)
        .to(checkboxPullLine, { attr: { y2: 44 } }, 0)
        .to(checkboxPullCircle, { y: 44 }, 0);
    }

    function animatePullingLine() {
      const buttonOriginPoint = [260, -76];
      const btnWidth = 270;
      const deg = ((gsap.getProperty(submitBtn, "rotation") - 4) * Math.PI) / 180;
      const btnEnd = [
        buttonOriginPoint[0] - (btnWidth - 20) * Math.cos(deg),
        buttonOriginPoint[1] - (btnWidth - 20) * Math.sin(deg),
      ];
      gsap.set(btnHandlerCircle, { attr: { cx: btnEnd[0], cy: btnEnd[1] } });

      const handle = 7;
      const r = 10;
      let p = "M" + (-r - handle) + "," + (250 - (isFixed ? 0 : state.pullProgress * 300));
      p += "h" + 2 * handle;
      p += "h" + -handle;
      p += " V" + (44 - state.pullProgress * 130);
      const slideAngle = 0.3 * Math.PI * (1 - (isFixed ? 1 : 0.5) * state.pullProgress);
      const dx = r * Math.cos(slideAngle);
      const dy = -r * Math.sin(slideAngle);
      p += "a" + r + ", " + r + " 0 0 1 " + (r + dx) + " " + dy;
      p += " L" + btnEnd[0] + "," + btnEnd[1];

      gsap.set(btnPullLine, { attr: { d: p }, strokeWidth: 3 });
    }

    return tl;
  }

  function rebuildPullTimeline() {
    if (pullTl) pullTl.kill();
    pullTl = createPullingTimeline(state.handClosed > 0.5, agreed);
  }

  /* ----------------------------- init ----------------------------- */
  run(() => {
    layoutPreparation();
    emailTl = createEmailTl();
    gearsTls = createGearsTimelines();
    rebuildPullTimeline();
  });

  /* ------------------------------ API ------------------------------ */
  return {
    /** scale the whole machine (used to fit small screens) */
    setScale(scale) {
      run(() => gsap.set(containerEl, { scale, transformOrigin: "50% 50%" }));
    },

    setEmailValid(valid) {
      run(() => {
        if (valid) emailTl.play();
        else emailTl.reverse();
      });
    },

    setPasswordValid(valid) {
      run(() => {
        if (valid) {
          gearsTls.forEach((tl) => {
            if (tl.paused()) {
              tl.play();
              gsap.fromTo(tl, { timeScale: 0 }, { timeScale: 1 });
            }
          });
        } else {
          gearsTls.forEach((tl) => {
            if (!tl.paused()) {
              gsap.to(tl, { timeScale: 0, onComplete: () => tl.pause() });
            }
          });
          sprayRepeatCounter = 0;
          state.sumbitBtnTextOpacity = 0;
          gsap.to(submitBtn, { duration: 0.3, color: "rgba(0, 0, 0, 0)" });
        }
      });
    },

    setAgreed(value) {
      agreed = !!value;
      run(() => rebuildPullTimeline());
    },

    /** true once the label has been sprayed on and the button pulled into place */
    isReady() {
      return !!state.sumbitBtnOnPlace && sprayRepeatCounter > 1;
    },

    /** everything vanishes piece by piece; resolves when finished */
    playExit() {
      return new Promise((resolve) => {
        run(() => {
          const tl = gsap.timeline({ onComplete: resolve });
          tl.to(qa(".am-svg > *"), {
            duration: 0.1,
            opacity: 0,
            stagger: { each: 0.03, from: "random", ease: "none" },
          }, 0).to(qa(".am-row"), { duration: 0.1, opacity: 0, stagger: 0.1 }, 0.4);
        });
      });
    },

    destroy() {
      ctx.revert();
      if (gearsContainer) gearsContainer.innerHTML = "";
    },
  };
}
