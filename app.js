(function(){
  // Mascot & stickers
  const mascots = ["🦊","🐵","🐼","🦄","🐯","🐸","🐥","🐨","🐶","🐱","🐰","🐧","🐮","🐷","🦁","🐮","🐙","🐳","🦖","🐝"];
  const stickers = ["🌟","🏆","🎈","🍭","🍪","🍓","🧁","🎉","🧸","🪄","💎","🚀","🦄","🐣","🍩","🎯","👑","💫"];

  // Elements
  const el = id => document.getElementById(id);
  const numberEl = el('number');
  const coverEl = el('cover');
  const barEl = el('bar');
  const mascotEl = el('mascot');
  const roundEl = el('round');
  const scoreEl = el('score');
  const streakEl = el('streak');
  const accEl = el('acc');
  const shelfEl = el('shelf');
  const confettiEl = el('confetti');

  const minEl = el('min');
  const maxEl = el('max');
  const flashEl = el('flash');
  const autoNextEl = el('autoNext');

  const startBtn = el('start');
  const peekBtn = el('peek');
  const okBtn = el('correct');
  const badBtn = el('incorrect');
  const resetBtn = el('reset');

  // Game state
  let target = null;
  let showing = false;
  let round = 0, score = 0, streak = 0, attempts = 0;
  let flashTimer = null, barTimer = null;

  // Sounds (Web Audio)
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

  const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
  const pick = arr => arr[rand(0,arr.length-1)];

  function setMascot(text="Ready?"){
    mascotEl.innerHTML = `${pick(mascots)} <span class="hint">${text}</span>`;
  }

  function updateStats(){
    roundEl.textContent = round;
    scoreEl.textContent = score;
    streakEl.textContent = streak;
    const acc = attempts ? Math.round((score/attempts)*100) : 0;
    accEl.textContent = `${acc}%`;
  }

  function enableMarking(enable){
    okBtn.disabled = badBtn.disabled = !enable;
  }

  function flashNumber(ms){
    showing = true;
    numberEl.classList.add('show');
    coverEl.classList.remove('active');
    animateBar(ms);
    flashTimer = setTimeout(hideNumber, ms);
  }

  function hideNumber(){
    showing = false;
    numberEl.classList.remove('show');
    coverEl.classList.add('active');
    clearInterval(barTimer); barEl.style.width = '0%';
    enableMarking(true);
    setMascot("What did you see?");
  }

  function animateBar(ms){
    const start = performance.now();
    clearInterval(barTimer);
    barTimer = setInterval(()=>{
      const t = performance.now() - start;
      const p = Math.min(100, (t/ms)*100);
      barEl.style.width = p + '%';
      if(p>=100){ clearInterval(barTimer); }
    }, 30);
  }

  function startRound(){
    clearTimeout(flashTimer); clearInterval(barTimer);
    const min = parseInt(minEl.value||1,10);
    const max = Math.max(min, parseInt(maxEl.value||10,10));
    const ms  = Math.max(200, parseInt(flashEl.value||1000,10));
    target = rand(min, max);
    numberEl.textContent = target;
    round += 1;
    updateStats();
    enableMarking(false);
    setMascot('Eyes on the card!');
    numberEl.classList.remove('show');
    coverEl.classList.add('active');
    // delay 400ms then flash, for suspense
    setTimeout(()=>flashNumber(ms), 400);
    beep(880,0.08); // tick
  }

  function onCorrect(){
    attempts += 1;
    score += 1;
    streak += 1;
    updateStats();
    chord();
    confetti(90);
    addSticker();
    doneMark();
  }

  function onIncorrect(){
    attempts += 1;
    streak = 0;
    updateStats();
    buzz();
    shakeCard();
    doneMark();
  }

  function doneMark(){
    setMascot(streak>0 ? `Great! Streak ${streak} ⭐` : `Keep trying!`);
    enableMarking(false);
    if (autoNextEl.checked){
      setTimeout(startRound, 700);
    } else {
      startBtn.textContent = "Next Round ▶";
      startBtn.focus();
    }
  }

  function addSticker(){
    const s = document.createElement('div');
    s.className = 'sticker';
    s.textContent = pick(stickers);
    s.style.transform = `rotate(${rand(-12, 12)}deg)`;
    shelfEl.appendChild(s);
    // Limit
    const max = 12;
    while(shelfEl.children.length>max) shelfEl.removeChild(shelfEl.firstChild);
  }

  function confetti(count=60){
    const colors = ['#ff6b6b','#ffd93d','#6bcB77','#4d96ff','#f15bb5','#00bbf9','#fee440'];
    for(let i=0;i<count;i++){
      const p = document.createElement('i');
      p.style.left = rand(0,100)+'%';
      p.style.background = colors[rand(0,colors.length-1)];
      p.style.animationDuration = (Math.random()*1.2+0.8)+'s';
      p.style.transform = `translateY(0) rotate(${rand(0,360)}deg)`;
      p.style.opacity = (Math.random()*0.5 + 0.5).toFixed(2);
      confettiEl.appendChild(p);
      setTimeout(()=>p.remove(), 1700);
    }
  }

  function shakeCard(){
    const c = document.querySelector('.card');
    c.animate([
      { transform:'translateX(0)' },
      { transform:'translateX(-6px)' },
      { transform:'translateX(6px)' },
      { transform:'translateX(0)' }
    ], {duration:220, iterations:1, easing:'ease-in-out'});
  }

  function peek(){
    if(target===null) return;
    if(showing) return;
    numberEl.classList.add('show');
    coverEl.classList.remove('active');
    beep(760,0.06);
    setTimeout(hideNumber, Math.max(300, Math.min(1200, parseInt(flashEl.value||1000,10) * 0.6)));
  }

  function reset(){
    clearTimeout(flashTimer); clearInterval(barTimer);
    target=null; showing=false;
    round=0; score=0; streak=0; attempts=0;
    numberEl.textContent='?';
    numberEl.classList.remove('show');
    coverEl.classList.add('active');
    shelfEl.innerHTML='';
    updateStats();
    startBtn.textContent='Start Round ▶';
    setMascot('Ready?');
  }

  // Bindings
  startBtn.addEventListener('click', startRound);
  peekBtn.addEventListener('click', peek);
  okBtn.addEventListener('click', onCorrect);
  badBtn.addEventListener('click', onIncorrect);
  resetBtn.addEventListener('click', reset);

  // Enable marking only when hidden
  numberEl.addEventListener('transitionend', ()=>{
    if(!numberEl.classList.contains('show')){
      enableMarking(true);
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e)=>{
    if(e.code==='Space'){ e.preventDefault(); startRound(); }
    if(e.key==='ArrowUp' || e.key.toLowerCase()==='c'){ if(!okBtn.disabled) onCorrect(); }
    if(e.key==='ArrowDown' || e.key.toLowerCase()==='x'){ if(!badBtn.disabled) onIncorrect(); }
    if(e.key.toLowerCase()==='p'){ peek(); }
  });

  // Initial
  setMascot();
  updateStats();
})();