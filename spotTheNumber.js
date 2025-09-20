(function(){
    // Mascot & stickers
  const mascots = ["🦊","🐵","🐼","🦄","🐯","🐸","🐥","🐨","🐶","🐱","🐰","🐧","🐮","🐷","🦁","🐮","🐙","🐳","🦖","🐝"];
  const stickers = ["🌟","🏆","🎈","🍭","🍪","🍓","🧁","🎉","🧸","🪄","💎","🚀","🦄","🐣","🍩","🎯","👑","💫"];

  /* Controls */
  const stnMinInput       = document.getElementById('stn-min');
  const stnMaxInput       = document.getElementById('stn-max');
  const stnFlashInput     = document.getElementById('stn-flash');
  const stnAutoNextInput  = document.getElementById('stn-autoNext');

  /* Buttons */
  const stnStartBtn       = document.getElementById('stn-start');
  const stnPeekBtn        = document.getElementById('stn-peek');
  const stnRevealBtn      = document.getElementById('stn-reveal');
  const stnCorrectBtn     = document.getElementById('stn-correct');
  const stnIncorrectBtn   = document.getElementById('stn-incorrect');
  const stnResetBtn       = document.getElementById('stn-reset');

  /* Stage / HUD */
  const stnMascot         = document.getElementById('stn-mascot');
  const stnRoundOut       = document.getElementById('stn-round');
  const stnScoreOut       = document.getElementById('stn-score');
  const stnStreakOut      = document.getElementById('stn-streak');
  const stnAccOut         = document.getElementById('stn-acc');
  const stnBar            = document.getElementById('stn-bar');

  /* Card & effects */
  const stnNumber         = document.getElementById('stn-number');
  const stnCover          = document.getElementById('stn-cover');
  const stnConfetti       = document.getElementById('stn-confetti');
  const stnShelf          = document.getElementById('stn-shelf');

  // Game state
  let target = null;
  let showing = false;
  let round = 0, score = 0, streak = 0, attempts = 0;
  let flashTimer = null, barTimer = null;

  const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;

  let audioCtx;
  const beep = (freq=660, duration=0.12, type='sine', vol=0.05) => {
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + duration);
    }catch(e){/* ignore */}
  };
  const chord = () => { [523,659,784].forEach((f,i)=>setTimeout(()=>beep(f,0.12,'triangle',0.06), i*60)); };
  const buzz = () => { [200,160,120].forEach((f,i)=>setTimeout(()=>beep(f,0.18,'square',0.06), i*80)); };

  // ----- DOM HOOKS -----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const elMin = $("#stn-min");
  const elMax = $("#stn-max");
  const elFlash = $("#stn-flash");
  const elAutoNext = $("#stn-autoNext");

  const btnStart = $("#stn-start");
  const btnPeek = $("#stn-peek");
  const btnReveal = $("#stn-reveal");
  const btnCorrect = $("#stn-correct");
  const btnIncorrect = $("#stn-incorrect");
  const btnReset = $("#stn-reset");

  const elMascot = $("#stn-mascot");
  const elRound = $("#stn-round");
  const elScore = $("#stn-score");
  const elStreak = $("#stn-streak");
  const elAcc = $("#stn-acc");
  const elBar = $("#stn-bar");
  const elCard = $("#stn-card");
  const elGrid = $(".grid-3x3", elCard);
  const elConfetti = $("#stn-confetti");
  const elShelf = $("#stn-shelf");

  // Children include .cell and .cell-none. Center of 3x3 is index 4.
  const gridChildren = Array.from(elGrid.children);
  const centerIndex = 4;
  const playableCells = gridChildren.filter(c => c.classList.contains("cell"));
  const centerCell = gridChildren[centerIndex];

  // Safety: ensure the middle is actually a .cell
  if (!centerCell || !centerCell.classList.contains("cell")) {
    console.warn("Center tile (index 4) is not a .cell. Check markup.");
  }

  // ----- STATE -----
  const state = {
    round: 0,
    score: 0,
    streak: 0,
    attempts: 0,
    target: null,
    matchIndex: null, // index (0..8) of the matching non-center tile
    revealTimer: null,
    barTimer: null,
    phase: "idle", // idle | revealing | waiting_mark
  };

  // ----- UTILITIES -----
  const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.floor(v)));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const COVER_URL = `url("rainbow.jpg")`;

  function setCover(cell, covered) {
    if (!(cell && cell.classList.contains("cell"))) return;
    if (covered) {
      cell.style.setProperty("--bug", COVER_URL);
      cell.style.color = "transparent"; // hide the numeral under the cover
      cell.style.textShadow = "none";
    } else {
      cell.style.setProperty("--bug", "none");
      cell.style.color = "";
      cell.style.textShadow = "";
    }
  }

  function coverAll(covered) {
    playableCells.forEach(c => setCover(c, covered));
  }

  function setNumbersHidden(hidden) {
    playableCells.forEach(c => {
      c.style.visibility = hidden ? "hidden" : "visible";
    });
  }

  function updateStatsUI() {
    const acc = state.attempts ? Math.round((state.score / state.attempts) * 100) : 0;
    elRound.textContent = state.round;
    elScore.textContent = state.score;
    elStreak.textContent = state.streak;
    elAcc.textContent = `${acc}%`;
  }

  function speak(msg) {
    elMascot.innerHTML = `🦄 <span class="hint">${msg}</span>`;
    elShelf.textContent = msg;
  }

  function enableMarking(enabled) {
    btnCorrect.disabled = !enabled;
    btnIncorrect.disabled = !enabled;
  }

  function clearTimers() {
    if (state.revealTimer) { clearTimeout(state.revealTimer); state.revealTimer = null; }
    if (state.barTimer) { clearTimeout(state.barTimer); state.barTimer = null; }
    // Also stop any CSS transition by resetting bar
    elBar.style.transition = "none";
    elBar.style.width = "0%";
    // Force reflow to allow future transitions
    // eslint-disable-next-line no-unused-expressions
    elBar.offsetHeight;
  }

  function animateBar(ms) {
    // Animate width from 0 to 100% over ms
    elBar.style.transition = "none";
    elBar.style.width = "0%";
    // reflow
    // eslint-disable-next-line no-unused-expressions
    elBar.offsetHeight;
    elBar.style.transition = `width ${ms}ms linear`;
    elBar.style.width = "100%";
  }

  function glowMatches(on) {
    // Add a subtle glow to the matching tiles (center + its twin)
    const matchCell = gridChildren[state.matchIndex];
    [centerCell, matchCell].forEach(cell => {
      if (!cell || !cell.classList.contains("cell")) return;
      cell.style.boxShadow = on ? "0 0 0 3px rgba(34,197,94,0.7), 0 0 18px rgba(34,197,94,0.5)" : "";
      cell.style.transform = on ? "scale(1.03)" : "";
    });
  }

  function burstConfetti(count=60){
    const colors = ['#ff6b6b','#ffd93d','#6bcB77','#4d96ff','#f15bb5','#00bbf9','#fee440'];
    for(let i=0;i<count;i++){
      const p = document.createElement('i');
      p.style.left = rand(0,100)+'%';
      p.style.background = colors[rand(0,colors.length-1)];
      p.style.animationDuration = (Math.random()*1.2+0.8)+'s';
      p.style.transform = `translateY(0) rotate(${rand(0,360)}deg)`;
      p.style.opacity = (Math.random()*0.5 + 0.5).toFixed(2);
      stnConfetti.appendChild(p);
      setTimeout(()=>p.remove(), 1700);
    }
  }

  // ----- ROUND LOGIC -----
  function readSettings() {
    let min = clampInt(parseInt(elMin.value, 10), -9999, 999999);
    let max = clampInt(parseInt(elMax.value, 10), -9999, 999999);
    const ms = clampInt(parseInt(elFlash.value, 10), 100, 120000);

    if (isNaN(min)) min = 0;
    if (isNaN(max)) max = 9;
    if (min > max) [min, max] = [max, min];

    return { min, max, ms, autoNext: !!elAutoNext.checked };
  }

  function generateRoundNumbers(min, max) {
    // Choose target in [min, max]
    const target = randInt(min, max);

    // Prepare positions for non-center playable cells
    const playableIndexes = gridChildren
      .map((el, idx) => (el.classList.contains("cell") ? idx : null))
      .filter(idx => idx !== null);

    // Pick exactly one other index (not center) to also be target
    const candidateIndexes = playableIndexes.filter(i => i !== centerIndex);
    const matchIndex = candidateIndexes[randInt(0, candidateIndexes.length - 1)];

    // Assign numbers:
    // - center = target
    // - matchIndex = target
    // - all other playable .cell = random != target
    gridChildren.forEach((cell, idx) => {
      if (!cell.classList.contains("cell")) return;
      let val;
      if (idx === centerIndex || idx === matchIndex) {
        val = target;
      } else {
        // random != target within [min, max]
        if (min === max) {
          // Edge case: if range is a single number, non-matching would be impossible.
          // We widen the pool virtually: use target±1 as fallbacks.
          const alt = Math.random() < 0.5 ? target - 1 : target + 1;
          val = alt;
        } else {
          do { val = randInt(min, max); } while (val === target);
        }
      }
      cell.textContent = String(val);
      cell.setAttribute("data-value", String(val));
    });

    return { target, matchIndex };
  }

  function setPhase(next) { state.phase = next; }

  function startRound() {
    clearTimers();
    enableMarking(false);
    glowMatches(false);

    const { min, max, ms } = readSettings();

    // Increment round
    state.round += 1;
    speak("Watch closely…");
    updateStatsUI();

    // Generate numbers
    const { target, matchIndex } = generateRoundNumbers(min, max);
    state.target = target;
    state.matchIndex = matchIndex;

    // Start covered, numbers hidden (so you can’t see outlines while covered)
    setNumbersHidden(false); // we keep layout stable
    coverAll(true);

    // Reveal for ms, animate bar, then re-cover and wait for marking
    setPhase("revealing");
    elCard.classList.add("is-revealing");
    animateBar(ms);

    // Reveal immediately so kids can see
    coverAll(false);

    state.revealTimer = setTimeout(() => {
      // Time’s up: cover again, wait for teacher to mark
      coverAll(true);
      elCard.classList.remove("is-revealing");
      setPhase("waiting_mark");
      enableMarking(true);
      speak(`Target was: ${state.target}. Mark ✓ or ✗`);
    }, ms);
  }

  function markResult(correct) {
    if (state.phase !== "waiting_mark") return;

    state.attempts += 1;
    if (correct) {
      state.score += 1;
      state.streak += 1;
      chord();
      speak("Nice! 🎉");
      burstConfetti();
    } else {
      buzz();  
      state.streak = 0;
      speak("Good try! Let’s go again.");
    }
    updateStatsUI();
    enableMarking(false);
    setPhase("idle");

    if (readSettings().autoNext) {
      setTimeout(() => startRound(), 700);
    }
  }

  function peek() {
    // Quick flash (~600ms) regardless of current phase, without affecting round timers
    const wasCovered = playableCells.some(c => getComputedStyle(c).getPropertyValue("--bug") !== "none");
    coverAll(false);
    setTimeout(() => { if (wasCovered) coverAll(true); }, 600);
  }

  function revealMatches() {
    glowMatches(true);
    setTimeout(() => glowMatches(false), 1000);
  }

  function resetGame() {
    clearTimers();
    Object.assign(state, {
      round: 0,
      score: 0,
      streak: 0,
      attempts: 0,
      target: null,
      matchIndex: null,
      revealTimer: null,
      barTimer: null,
      phase: "idle",
    });
    updateStatsUI();
    speak("Ready?");
    enableMarking(false);
    glowMatches(false);
    coverAll(true);
    // Clear numbers text if you want; we’ll keep last values visible under cover.
  }

  // ----- WIRE UP BUTTONS -----
  btnStart.addEventListener("click", startRound);
  btnCorrect.addEventListener("click", () => markResult(true));
  btnIncorrect.addEventListener("click", () => markResult(false));
  btnReset.addEventListener("click", resetGame);
  btnPeek.addEventListener("click", peek);
  btnReveal.addEventListener("click", revealMatches);

  // Prevent invalid ranges live
  elMin.addEventListener("change", () => {
    const { min, max } = readSettings();
    if (min > max) elMax.value = String(min);
  });
  elMax.addEventListener("change", () => {
    const { min, max } = readSettings();
    if (max < min) elMin.value = String(max);
  });

  // ----- INIT -----
  // Start with covered tiles and a friendly message
  coverAll(true);
  setNumbersHidden(false);
  updateStatsUI();
  speak("Ready?");
})();