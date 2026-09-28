function tick(){
  const now=new Date();
  const el=document.getElementById('clock');
  if(el) el.textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
tick();
setInterval(tick,1000);
