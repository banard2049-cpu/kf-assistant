(() => {
  "use strict";
  let active = null;
  // Progress is saved by the caller before playback; this owns no run data.
  function play({ from, to, onFinish }) {
    if (active) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) { onFinish?.(); document.querySelector("#mapStageSelect")?.focus({ preventScroll: true }); return; }
    const previousFocus = document.activeElement;
    const overlay = document.createElement("section");
    overlay.className = "graal-transition";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "graalTransitionTitle");
    overlay.innerHTML = `
      <canvas class="graal-atmosphere" aria-hidden="true"></canvas>
      <div class="graal-transition-heading">
        <p class="graal-transition-eyebrow">THE ROGUE’S PATH</p>
        <h2 id="graalTransitionTitle" class="graal-text-pair"><span class="graal-text-before">玫瑰的终焉</span><span class="graal-text-after" aria-hidden="true">枯萎圣杯</span></h2>
        <p class="graal-transition-copy graal-text-pair"><span class="graal-text-before">火焰吞没旧日的道路。</span><span class="graal-text-after" aria-hidden="true">灰烬之下，征途未尽。</span></p>
      </div>
      <div class="graal-transition-map"><img alt="枯萎圣杯进阶路径图"><canvas aria-hidden="true"></canvas></div>
      <p class="graal-transition-chapter graal-text-pair" aria-live="polite"><span class="graal-text-before">I — V</span><span class="graal-text-after" aria-hidden="true">VI — XII</span></p>
      <button class="graal-transition-skip" type="button">跳过过场 <span aria-hidden="true">Esc ↗</span></button>`;
    const board = overlay.querySelector(".graal-transition-map");
    const image = board.querySelector("img");
    const canvas = board.querySelector("canvas");
    const atmosphere = overlay.querySelector(".graal-atmosphere");
    const ash = atmosphere.getContext("2d");
    const skip = overlay.querySelector("button");
    let frame = 0, watchdog = 0, finished = false, started = 0, previousTime = 0;
    let lastPhase = "", renderer = null, boardRect;
    const particles = [];
    const oldImage = new Image();
    const oldOverflow = document.body.style.overflow;
    const background = [...document.body.children].filter(element => element instanceof HTMLElement && !element.inert);
    background.forEach(element => { element.inert = true; });
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    function finish() {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame); clearTimeout(watchdog);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      reducedMotion.removeEventListener("change", onMotionChange);
      renderer?.dispose();
      overlay.remove();
      document.body.style.overflow = oldOverflow;
      background.forEach(element => { element.inert = false; });
      active = null;
      onFinish?.();
      const target = document.querySelector("#mapStageSelect");
      if (target && !target.classList.contains("hidden")) target.focus({ preventScroll: true });
      else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
    function onKey(event) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(); }
      if (event.key === "Tab") { event.preventDefault(); skip.focus(); }
    }
    function onVisibility() { if (document.hidden) finish(); }
    function onMotionChange() { if (reducedMotion.matches) finish(); }
    function resize() {
      const rect = board.getBoundingClientRect();
      // Keep expensive smoke shading at a bounded resolution on mobile GPUs.
      const scale = Math.min(window.devicePixelRatio || 1, 1.25, 1200 / Math.max(1, rect.width));
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      atmosphere.width = window.innerWidth; atmosphere.height = window.innerHeight;
      boardRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      if (renderer) renderer.draw((performance.now() - started) / 1000, Math.max(0, Math.min(1, (performance.now() - started - 700) / 4700)));
    }
    active = { finish };
    skip.addEventListener("click", finish);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    reducedMotion.addEventListener("change", onMotionChange);
    canvas.addEventListener("webglcontextlost", finish);
    skip.focus({ preventScroll: true });
    watchdog = setTimeout(finish, 14000);
    oldImage.src = from; image.src = to;
    board.style.backgroundImage = `url("${from}")`;
    Promise.all([oldImage.decode(), image.decode()]).then(() => {
      if (finished) return;
      board.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      resize();
      renderer = window.KF_BURNING_PAPER?.create(canvas, oldImage, image);
      if (!renderer) { finish(); return; }
      started = performance.now();
      renderer.draw(0, 0);
      overlay.classList.add("is-ready");
      frame = requestAnimationFrame(tick);
    }).catch(finish);

    function drawAsh(now, progress, delta) {
      if (!ash) return;
      ash.clearRect(0, 0, atmosphere.width, atmosphere.height);
      const amount = Math.sin(progress * Math.PI);
      if (progress > .02 && progress < .96 && particles.length < 180) {
        for (let n = 0; n < 3; n++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = progress * .7;
          const x = boardRect.x + boardRect.width * (.49 + Math.cos(angle) * radius);
          const y = boardRect.y + boardRect.height * (.47 + Math.sin(angle) * radius);
          const ember = Math.random() < .65;
          particles.push({ x, y, vx: (Math.random() - .5) * 1.4, vy: -.6 - Math.random() * 2.8,
            size: ember ? .5 + Math.random() * 1.5 : 2 + Math.random() * 7,
            rotation: Math.random() * 6.28, spin: (Math.random() - .5) * .09,
            life: 1, age: 0, ember, seed: Math.random() * 10 });
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += delta; p.x += (p.vx + Math.sin(p.age * .03 + p.seed) * .6) * delta;
        p.y += p.vy * delta; p.rotation += p.spin * delta; p.life -= (p.ember ? .007 : .004) * delta;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ash.save(); ash.translate(p.x, p.y); ash.rotate(p.rotation);
        ash.globalAlpha = Math.min(1, p.age * .1) * p.life;
        if (p.ember) {
          ash.globalCompositeOperation = "lighter";
          ash.shadowColor = "#ff6a1c"; ash.shadowBlur = 9;
          ash.fillStyle = p.life > .45 ? "#ffc175" : "#b84b1b";
          ash.fillRect(0, 0, p.size, p.size * 1.8);
        } else {
          const tilt = Math.cos(p.age * .07 + p.seed);
          ash.scale(1, tilt);
          ash.fillStyle = "#2a231f";
          ash.beginPath(); ash.moveTo(-p.size, 0); ash.lineTo(-p.size * .35, -p.size * .7);
          ash.lineTo(p.size * .65, -p.size * .5); ash.lineTo(p.size, p.size * .4);
          ash.lineTo(0, p.size * .7); ash.closePath(); ash.fill();
          ash.strokeStyle = `rgba(229,94,30,${p.life * .6})`; ash.lineWidth = .6; ash.stroke();
        }
        ash.restore();
      }
      overlay.style.setProperty("--fire", (amount * .18).toFixed(3));
    }
    function tick(now) {
      if (finished) return;
      const elapsed = now - started;
      const progress = Math.max(0, Math.min(1, (elapsed - 700) / 4700));
      const delta = Math.min(45, now - (previousTime || now)) / 16.667;
      previousTime = now;
      renderer.draw(elapsed / 1000, progress);
      drawAsh(now, progress, delta);
      overlay.dataset.progress = progress.toFixed(3);
      const phase = elapsed > 5400 ? "revealed" : elapsed > 700 ? "burning" : "waiting";
      if (phase !== lastPhase) {
        overlay.dataset.phase = lastPhase = phase;
        if (phase === "revealed") {
          // Both text layers reserve their final space from the first frame.
          // Only opacity changes, so neither the words nor map jump on reveal.
          overlay.querySelectorAll(".graal-text-before").forEach(text => text.setAttribute("aria-hidden", "true"));
          overlay.querySelectorAll(".graal-text-after").forEach(text => text.setAttribute("aria-hidden", "false"));
        }
      }
      if (elapsed > 6500) overlay.classList.add("is-leaving");
      if (elapsed >= 7200) finish(); else frame = requestAnimationFrame(tick);
    }
  }
  window.KF_ROGUE_TRANSITION = { play };
})();
