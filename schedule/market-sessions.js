/* Indicative regional activity windows, not exchange opening hours or holiday calendars.
 * Tokyo/London/New York reuse site-header.js local-hour definitions. */
((root) => {
 'use strict';
 const DAY=86400000, zone='Australia/Brisbane';
 const sessions=[
  {id:'sydney',name:'SYDNEY',zone:'Australia/Sydney',start:8,end:17,countries:['AU']},
  {id:'tokyo',name:'TOKYO',zone:'Asia/Tokyo',start:9,end:17,countries:['JP']},
  {id:'london',name:'LONDON / EUROPE',zone:'Europe/London',start:8,end:17,countries:['GB','UK','EU']},
  {id:'new-york',name:'NEW YORK',zone:'America/New_York',start:8,end:17,countries:['US']}
 ];
 const clocks=new Map();
 function fields(at,tz=zone){
  if(!clocks.has(tz))clocks.set(tz,new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  return Object.fromEntries(clocks.get(tz).formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 }
 const date=(at,tz=zone)=>{const p=fields(at,tz);return `${p.year}-${p.month}-${p.day}`;};
 const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
 // Solve a named local wall clock using the IANA offset at the target date.
 // Activity windows use daytime hours, outside ambiguous DST transition hours.
 function instant(d,h,tz=zone){
  const desired=Date.parse(d+'T00:00:00Z')+h*3600000;let at=desired;
  for(let i=0;i<4;i++){const p=fields(at,tz);const local=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);const correction=desired-local;at+=correction;if(!correction)return at;}
  throw new Error('Unresolvable local time');
 }
 const monday=(at=Date.now())=>{const d=date(at);return shift(d,-((new Date(d+'T00:00:00Z').getUTCDay()+6)%7));};
 function intervals(start,end){
  const rows=[];
  for(let d=shift(date(start),-2);d<=shift(date(end),1);d=shift(d,1)){
   if([0,6].includes(new Date(d+'T00:00:00Z').getUTCDay()))continue;
   for(const s of sessions){const from=instant(d,s.start,s.zone),to=instant(d,s.end,s.zone);if(from<end&&to>start)rows.push({...s,from,to,sourceDate:d});}
  }
  return rows.sort((a,b)=>a.from-b.from||a.id.localeCompare(b.id));
 }
 function week(d){const start=instant(d,0),end=instant(shift(d,7),0),all=intervals(start,end);return Array.from({length:7},(_,i)=>{const day=shift(d,i),from=instant(day,0),to=from+DAY;return {date:day,from,to,sessions:all.filter(s=>s.from<to&&s.to>from).map(s=>({...s,clipFrom:Math.max(from,s.from),clipTo:Math.min(to,s.to)}))};});}
 const active=(at=Date.now())=>intervals(at,at+1).filter(s=>s.from<=at&&at<s.to);
 const api=Object.freeze({DAY,zone,sessions,fields,date,validDate,shift,instant,monday,week,active});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketSchedule=api;
})(typeof window==='object'?window:globalThis);
