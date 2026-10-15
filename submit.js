/* Form delivery via FormSubmit (https://formsubmit.co). No account or API key.
   - No files attached: AJAX JSON endpoint -> inline success / error message.
   - Files attached: normal multipart POST (FormSubmit's AJAX endpoint does not deliver files), then redirect to thanks.html via _next. */
(function(){
var TO='ian.socialstudio@gmail.com',EP='https://formsubmit.co/'+TO,AJ='https://formsubmit.co/ajax/'+TO,MAX=10*1024*1024;
function fmt(n){return n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'}
// custom upload buttons
window.upgradeFiles=function(root){(root||document).querySelectorAll('input[type=file]:not([data-up])').forEach(function(inp){
 inp.dataset.up=1;if(!inp.id)inp.id='f_'+inp.name;var w=document.createElement('div');w.className='up';
 var b=document.createElement('label');b.className='upbtn';b.htmlFor=inp.id;b.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg><span>'+(inp.multiple?'Choose files':'Choose file')+'</span>';
 b.tabIndex=0;b.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}});
 var n=document.createElement('span');n.className='upname';n.textContent=inp.multiple?'No files selected':'No file selected';
 inp.parentNode.insertBefore(w,inp);w.appendChild(inp);w.appendChild(b);w.appendChild(n);inp.classList.add('upin');
 inp.addEventListener('change',function(){var fs=[].slice.call(inp.files);n.textContent=fs.length?fs.map(function(f){return f.name+' ('+fmt(f.size)+')'}).join(', '):(inp.multiple?'No files selected':'No file selected');n.classList.toggle('has',fs.length>0)})})};
window.totalFileBytes=function(f){var t=0;f.querySelectorAll('input[type=file]').forEach(function(i){[].forEach.call(i.files,function(x){t+=x.size})});return t};
window.FILE_LIMIT=MAX;
function hid(f,k,v){var i=f.querySelector('input[type=hidden][name="'+k+'"]');if(!i){i=document.createElement('input');i.type='hidden';i.name=k;f.appendChild(i)}i.value=v}
window.sendForm=function(f,o){ // o:{subject,out,done}
 var out=o.out,btn=f.querySelector('button[type=submit]');
 hid(f,'_subject',o.subject);hid(f,'_template','table');
 var em=f.elements['email'];if(em)hid(f,'_replyto',em.value.trim());
 hid(f,'_honey','');var h=f.querySelector('input[name=_honey]');h.type='text';h.className='hp';h.tabIndex=-1;h.autocomplete='off';
 var bytes=totalFileBytes(f);
 if(bytes>MAX){out.innerHTML='<div class="msg bad">Your attachments total '+fmt(bytes)+'. The limit is 10 MB per submission — please remove or compress some images.</div>';return}
 if(bytes>0){ // multipart POST with redirect
  var next=new URL('thanks.html?form='+encodeURIComponent(o.kind||'form'),location.href).href;hid(f,'_next',next);
  f.action=EP;f.method='POST';f.enctype='multipart/form-data';
  if(btn){btn.disabled=true;btn.textContent='Sending…'}
  out.innerHTML='<div class="msg">Uploading your files… please keep this page open.</div>';
  window.__lastRequest={mode:'multipart',action:f.action,bytes:bytes};
  HTMLFormElement.prototype.submit.call(f);return}
 var data={};new FormData(f).forEach(function(v,k){if(typeof v==='string'&&k!=='_next')data[k]=v});
 if(btn){btn.disabled=true;btn.textContent='Sending…'}
 window.__lastRequest={mode:'ajax',action:AJ,data:data};
 fetch(AJ,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
 .then(function(r){return r.json().then(function(j){if(!r.ok||String(j.success)!=='true')throw new Error(j.message||('HTTP '+r.status));return j})})
 .then(function(){o.done&&o.done()})
 .catch(function(e){out.innerHTML='<div class="msg bad"><strong>Sorry — your form could not be sent.</strong> Please check your connection and try again. If it keeps failing, email us at <a href="mailto:ian.socialstudio@gmail.com">ian.socialstudio@gmail.com</a>. <small>('+String(e.message).replace(/</g,'&lt;')+')</small></div>'})
 .finally(function(){if(btn){btn.disabled=false;btn.textContent='Submit'}})};
window.showSuccess=function(f,title,text){var d=document.createElement('div');d.className='success';d.setAttribute('role','status');
 d.innerHTML='<div class="tick"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg></div><h2>'+title+'</h2><p>'+text+'</p><a class="btn" href="index.html">Back to home</a>';
 f.replaceWith(d);window.scrollTo({top:0,behavior:'smooth'})};
upgradeFiles();
})();
/* collapsible form sections */
(function(){var f=document.getElementById('f');if(!f)return;var fs=[].slice.call(f.querySelectorAll('fieldset')).filter(function(x){return x.querySelector(':scope>legend')&&!x.classList.contains('approve')&&!x.classList.contains('rg')});
fs.forEach(function(x,i){var lg=x.querySelector(':scope>legend'),b=document.createElement('button');b.type='button';b.className='acch';b.innerHTML='<span>'+lg.innerHTML+'</span><i aria-hidden="true"></i>';lg.innerHTML='';lg.appendChild(b);x.classList.add('acc');
 function set(o){x.classList.toggle('closed',!o);b.setAttribute('aria-expanded',o)}set(i===0||!!x.querySelector('.addf'));b.addEventListener('click',function(){set(x.classList.contains('closed'))});x._set=set});
new MutationObserver(function(ms){var first=null;ms.forEach(function(m){[].forEach.call(m.addedNodes,function(n){if(n.nodeType===1&&n.classList.contains('err')){var x=n.closest('fieldset.acc');if(x){x._set(true);first=first||x}}})});if(first)first.scrollIntoView({behavior:'smooth',block:'start'})}).observe(f,{childList:true,subtree:true});})();
