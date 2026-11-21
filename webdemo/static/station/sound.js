"use strict";
const stationCue=(()=>{
  const toggle=document.getElementById("sound");
  let context,master,last=0;
  // [start, duration, start Hz, end Hz, oscillator, gain]
  const sounds={
    tab:[[0,.07,420,550,"sine",.08]],
    switch:[[0,.035,610,260,"triangle",.10],[.045,.045,920,520,"triangle",.05]],
    feed:[[0,.055,164,82,"triangle",.16],[.045,.06,225,104,"triangle",.10],[.09,.035,300,145,"sine",.05]],
    lens:[[0,.17,150,510,"sine",.09],[.12,.04,880,570,"triangle",.06]],
    start:[[0,.09,190,300,"triangle",.10],[.095,.14,300,560,"sine",.10]],
    done:[[0,.13,523,523,"sine",.12],[.11,.13,659,659,"sine",.10],[.21,.28,784,784,"sine",.08]],
    error:[[0,.1,300,230,"triangle",.08],[.12,.13,230,160,"triangle",.07]]
  };
  function play(name){
    if(!toggle.checked||document.hidden||!sounds[name])return;
    try{
      context??=new AudioContext();
      if(!master){master=context.createGain();master.connect(context.destination);}
      master.gain.value=.6;
      if(context.state==="suspended")context.resume().catch(()=>{});
      if(performance.now()-last<45 && name!=="done" && name!=="error")return;
      last=performance.now();
      for(const [delay,duration,hz,endHz,type,level] of sounds[name]){
        const osc=context.createOscillator(),envelope=context.createGain(),t=context.currentTime+delay;
        osc.type=type;osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(endHz,t+duration);
        envelope.gain.setValueAtTime(.0001,t);envelope.gain.exponentialRampToValueAtTime(level,t+.008);envelope.gain.exponentialRampToValueAtTime(.0001,t+duration);
        osc.connect(envelope).connect(master);osc.onended=()=>{osc.disconnect();envelope.disconnect()};osc.start(t);osc.stop(t+duration+.008);
      }
    }catch{}
  }
  toggle.addEventListener("change",()=>{if(toggle.checked)play("switch");else if(master)master.gain.value=0});
  return play;
})();
document.addEventListener("click",event=>{
  const control=event.target.closest("button,input");
  if(control?.matches("#cutSkin,#core,#shots button,[data-pin]"))stationCue("lens");
  else if(control?.matches("[data-view],#play,#energyPlay,#applyEnergy,#back"))stationCue("switch");
});
