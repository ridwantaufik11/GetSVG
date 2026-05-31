var __svgr=(function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t=null,n=new Map,r=null,i=[];function a(e){if(e.closest(`svg`)||e instanceof HTMLImageElement&&/\.svg(\?|$)/i.test(e.src))return!0;let t=window.getComputedStyle(e).backgroundImage;return!!(/url\(["']?[^"')]+\.svg/i.test(t)||e instanceof HTMLObjectElement&&/\.svg(\?|$)/i.test(e.data)||e instanceof HTMLEmbedElement&&/\.svg(\?|$)/i.test(e.src))}document.addEventListener(`contextmenu`,e=>{let r=e.target;for(let t of e.composedPath())if(t instanceof HTMLElement&&t.dataset.id&&n.has(t.dataset.id)){r=n.get(t.dataset.id);break}t=r,chrome.runtime.sendMessage({action:`set-context`,hasSVG:a(r)})});function o(e){let t=e.cloneNode(!0);return t.getAttribute(`xmlns`)||t.setAttribute(`xmlns`,`http://www.w3.org/2000/svg`),t.querySelectorAll(`script`).forEach(e=>e.remove()),s(t,e),t.outerHTML}function s(e,t){e.querySelectorAll(`use`).forEach(n=>{let r=n.getAttribute(`href`)||n.getAttribute(`xlink:href`);if(!r?.startsWith(`#`))return;let i=r.slice(1),a=t.querySelector(`#${CSS.escape(i)}`)||document.getElementById(i);if(!a)return;let o=e.querySelector(`defs`);o||(o=document.createElementNS(`http://www.w3.org/2000/svg`,`defs`),e.insertBefore(o,e.firstChild)),o.querySelector(`#${CSS.escape(i)}`)||o.appendChild(a.cloneNode(!0))})}function c(e){return(e.id||e.getAttribute(`data-name`)||`image`)+`.svg`}function l(e){let t=e.querySelector(`:scope > title`)?.textContent?.trim();if(t)return t;let n=e.getAttribute(`aria-label`)?.trim();if(n)return n;if(e.id)return e.id;let r=e.getAttribute(`data-name`)?.trim();if(r)return r;let i=e.parentElement;for(;i&&i.tagName!==`BODY`;){let e=i.getAttribute(`aria-label`)?.trim()||i.getAttribute(`title`)?.trim()||i.getAttribute(`alt`)?.trim();if(e)return e;if(i instanceof HTMLButtonElement||i instanceof HTMLAnchorElement||i.getAttribute(`role`)===`button`){let e=i.textContent?.trim().replace(/\s+/g,` `);if(e&&e.length>0&&e.length<=40)return e}if(i.id&&!/^[\d]/.test(i.id)&&!/^svgr-/.test(i.id))return i.id;i=i.parentElement}return`image`}function u(){let e=[],t=0,r=new WeakSet;n.clear();let i=()=>`svgr-${++t}`,a=e=>{let t=e.getBoundingClientRect();return{width:Math.round(t.width),height:Math.round(t.height)}},s=e=>new TextEncoder().encode(o(e)).length,c=e=>`data:image/svg+xml;charset=utf-8,`+encodeURIComponent(o(e)),u=(t,i)=>{e.push(t),n.set(t.id,i),r.add(i)},d=e=>e.split(`/`).pop()?.split(`?`)[0]?.replace(/\.svg$/i,``)||`image`;return document.querySelectorAll(`svg`).forEach(e=>{if(e.closest(`defs, symbol`)||r.has(e))return;let{width:t,height:n}=a(e);u({id:i(),method:`inline`,width:t,height:n,fileSize:s(e),thumbnail:c(e),name:l(e)},e)}),document.querySelectorAll(`img`).forEach(e=>{if(!/\.svg(\?|$)/i.test(e.src)||r.has(e))return;let{width:t,height:n}=a(e);u({id:i(),method:`img`,width:t,height:n,srcUrl:e.src,thumbnail:e.src,name:d(e.src)},e)}),document.querySelectorAll(`*`).forEach(e=>{if(r.has(e))return;let t=window.getComputedStyle(e).backgroundImage.match(/url\(["']?([^"')]+\.svg[^"')]*)/i);if(!t)return;let{width:n,height:o}=a(e);u({id:i(),method:`bg`,width:n,height:o,srcUrl:t[1],thumbnail:t[1],name:d(t[1])},e)}),document.querySelectorAll(`use`).forEach(e=>{let t=e.closest(`svg`);if(!t||r.has(t))return;let{width:n,height:o}=a(t);u({id:i(),method:`use`,width:n,height:o,fileSize:s(t),thumbnail:c(t),name:l(t)},t)}),document.querySelectorAll(`object[type="image/svg+xml"], embed[src$=".svg"]`).forEach(e=>{if(r.has(e))return;let t=e.data||e.src||void 0,{width:n,height:o}=a(e);u({id:i(),method:`object`,width:n,height:o,srcUrl:t,thumbnail:t,name:t?d(t):`image`},e)}),e}function d(e){let t=e.closest(`svg`);if(t)return Promise.resolve({svg:o(t),filename:c(t)});if(e instanceof HTMLImageElement&&/\.svg(\?|$)/i.test(e.src)){let t=e.src.split(`/`).pop()?.split(`?`)[0]??`image.svg`;return fetch(e.src).then(e=>e.text()).then(e=>({svg:e,filename:t}))}let n=window.getComputedStyle(e).backgroundImage.match(/url\(["']?([^"')]+\.svg[^"')]*)/i);if(n){let e=n[1],t=e.split(`/`).pop()?.split(`?`)[0]??`image.svg`;return fetch(e).then(e=>e.text()).then(e=>({svg:e,filename:t}))}let r=e instanceof HTMLObjectElement?e.data:e instanceof HTMLEmbedElement?e.src:null;if(r&&/\.svg(\?|$)/i.test(r)){let e=r.split(`/`).pop()?.split(`?`)[0]??`image.svg`;return fetch(r).then(e=>e.text()).then(t=>({svg:t,filename:e}))}return Promise.resolve(null)}function f(e){return navigator.clipboard?.writeText?navigator.clipboard.writeText(e):new Promise((t,n)=>{let r=document.createElement(`textarea`);r.value=e,r.setAttribute(`readonly`,``),r.style.cssText=`position:fixed;opacity:0;pointer-events:none;top:-1000px;left:-1000px`,document.documentElement.appendChild(r),r.focus(),r.select();let i=document.execCommand(`copy`);r.remove(),i?t():n(Error(`execCommand copy failed`))})}var p=`
  .overlay {
    position: fixed;
    background: rgba(255, 214, 0, 0.2);
    border: 2px solid #000;
    box-sizing: border-box;
    pointer-events: auto;
    cursor: pointer;
  }
  .overlay:hover {
    background: rgba(255, 214, 0, 0.5);
    box-shadow: 3px 3px 0 #000;
  }
  .tooltip {
    position: fixed;
    background: #fff;
    border: 2px solid #000;
    box-shadow: 3px 3px 0 #000;
    padding: 4px 8px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
  }
  .badge {
    display: inline-block;
    background: #000;
    color: #FFD600;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    margin-right: 5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .popup {
    position: fixed;
    background: #fff;
    border: 2px solid #000;
    box-shadow: 4px 4px 0 #000;
    padding: 8px;
    display: flex;
    gap: 6px;
    z-index: 20;
  }
  .btn {
    background: #FFD600;
    border: 2px solid #000;
    box-shadow: 2px 2px 0 #000;
    padding: 5px 14px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
  }
  .btn:active {
    box-shadow: none;
    transform: translate(2px, 2px);
  }
  .btn.ghost {
    background: #fff;
  }
  .feedback {
    position: fixed;
    background: #000;
    color: #FFD600;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: 800;
    padding: 5px 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    pointer-events: none;
    z-index: 30;
    animation: fadein 0.1s ease;
  }
  @keyframes fadein { from { opacity: 0 } to { opacity: 1 } }
`;function m(e,t){let n=t.getBoundingClientRect();e.style.left=`${n.left}px`,e.style.top=`${n.top}px`,e.style.width=`${n.width}px`,e.style.height=`${n.height}px`}function h(e){let t=e.getBoundingClientRect();return{left:t.left,top:t.top>60?t.top-50:t.bottom+4}}function g(e,t,n){let r=document.createElement(`div`);r.className=`feedback`,r.textContent=n;let i=t.getBoundingClientRect();r.style.left=`${i.left}px`,r.style.top=`${i.top+i.height/2-13}px`,e.appendChild(r),setTimeout(()=>r.remove(),1200)}function _(e){let t=document.getElementById(`svgr-toast`);if(!t){t=document.createElement(`div`),t.id=`svgr-toast`,t.style.cssText=`position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none`,document.documentElement.appendChild(t);let e=t.attachShadow({mode:`open`}),n=document.createElement(`style`);n.textContent=`
      .t {
        background: #000;
        color: #FFD600;
        border: 2px solid #FFD600;
        box-shadow: 4px 4px 0 #FFD600;
        font-family: 'Courier New', monospace;
        font-size: 15px;
        font-weight: 800;
        padding: 12px 28px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        animation: tin .15s ease, tout .25s ease 2.75s forwards;
        display: block;
        white-space: nowrap;
      }
      @keyframes tin { from { opacity:0;transform:translateY(-10px) } to { opacity:1;transform:translateY(0) } }
      @keyframes tout { to { opacity:0 } }
    `,e.appendChild(n)}let n=t.shadowRoot,r=document.createElement(`div`);r.className=`t`,r.textContent=e,n.appendChild(r),setTimeout(()=>r.remove(),3e3)}function v(e){let t=(e.closest(`svg`)??e).getBoundingClientRect();if(t.width===0&&t.height===0)return;let n=document.createElement(`div`);n.style.cssText=`position:fixed;left:${t.left}px;top:${t.top}px;width:${t.width}px;height:${t.height}px;pointer-events:none;z-index:2147483647`,document.documentElement.appendChild(n);let r=n.attachShadow({mode:`open`}),i=document.createElement(`style`);i.textContent=`
    .p {
      position: absolute;
      inset: 0;
      background: rgba(255,214,0,0.35);
      border: 2px solid #000;
      box-shadow: 3px 3px 0 #000;
      box-sizing: border-box;
      animation: beat 1.5s ease-in-out 2 forwards;
    }
    @keyframes beat {
      0%   { opacity:0; transform:scale(1.06); }
      15%  { opacity:1; transform:scale(1); }
      70%  { opacity:1; transform:scale(1); }
      100% { opacity:0; transform:scale(1.06); }
    }
  `,r.appendChild(i);let a=document.createElement(`div`);a.className=`p`,r.appendChild(a),setTimeout(()=>n.remove(),3e3)}function y(e){e.querySelectorAll(`.popup`).forEach(e=>e.remove())}function b(e,t,n,r){y(e);let i=document.createElement(`div`);i.className=`popup`;let a=document.createElement(`button`);a.className=`btn`,a.textContent=`Copy`,a.addEventListener(`click`,async n=>{n.stopPropagation();try{let n=await d(r);if(!n)return;await f(n.svg),y(e),g(e,t,`Copied!`)}catch{y(e),g(e,t,`Copy failed`)}});let o=document.createElement(`button`);o.className=`btn ghost`,o.textContent=`Download`,o.addEventListener(`click`,n=>{n.stopPropagation(),d(r).then(n=>{n&&(chrome.runtime.sendMessage({action:`save-svg`,svg:n.svg,filename:n.filename}),y(e),g(e,t,`Saved!`))})}),i.appendChild(a),i.appendChild(o),e.appendChild(i);let{left:s,top:c}=h(t);i.style.left=`${s}px`,i.style.top=`${c}px`}async function x(){r&&S(),_(`Highlighting SVGs...`),await new Promise(e=>requestAnimationFrame(()=>requestAnimationFrame(e)));let e=u();if(e.length===0)return;let t=document.createElement(`div`);t.id=`svgr-root`,t.style.cssText=`position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:visible`,document.documentElement.appendChild(t);let a=t.attachShadow({mode:`open`}),o=document.createElement(`style`);o.textContent=p,a.appendChild(o);let s=document.createElement(`div`);s.className=`tooltip`,s.style.display=`none`,a.appendChild(s);for(let t of e){let e=n.get(t.id);if(!e)continue;let r=document.createElement(`div`);r.className=`overlay`,r.dataset.id=t.id,m(r,e),a.appendChild(r),r.addEventListener(`mouseenter`,()=>{s.innerHTML=`<span class="badge">${t.method}</span>${t.width}×${t.height}px`;let e=r.getBoundingClientRect();s.style.left=`${e.left}px`,s.style.top=`${e.top>36?e.top-34:e.bottom+4}px`,s.style.display=`block`}),r.addEventListener(`mouseleave`,()=>{s.style.display=`none`}),r.addEventListener(`click`,n=>{n.stopPropagation(),b(a,r,t,e)})}let c=()=>{a.querySelectorAll(`.overlay`).forEach(e=>{let t=n.get(e.dataset.id);t&&m(e,t)})};window.addEventListener(`scroll`,c,{capture:!0,passive:!0}),window.addEventListener(`resize`,c,{passive:!0});let l=e=>{e.composedPath().includes(t)||y(a)};document.addEventListener(`click`,l,{capture:!0}),i.push(()=>window.removeEventListener(`scroll`,c,{capture:!0}),()=>window.removeEventListener(`resize`,c),()=>document.removeEventListener(`click`,l,{capture:!0})),r=t}function S(){i.splice(0).forEach(e=>e()),r?.remove(),r=null}function C(e){let t=e.closest(`svg`)??e;t.scrollIntoView({behavior:`smooth`,block:`center`,inline:`center`});let n=null,r=0,i=performance.now()+2500,a=()=>{let o=t.getBoundingClientRect().top;if(o===n){if(r++,r>=4){v(e);return}}else r=0;n=o,performance.now()<i?requestAnimationFrame(a):v(e)};requestAnimationFrame(a)}return chrome.runtime.onMessage.addListener((e,i,a)=>{if(e.action===`copy-svg`||e.action===`download-svg`){let n=t;return n?(d(n).then(t=>{if(!t){a({success:!1,error:`No SVG found at right-clicked element`});return}e.action===`copy-svg`?navigator.clipboard.writeText(t.svg).then(()=>{_(`SVG Copied!`),v(n),a({success:!0})}).catch(e=>a({success:!1,error:String(e)})):a({success:!0,svg:t.svg,filename:t.filename})}),!0):(a({success:!1,error:`No element right-clicked`}),!0)}if(e.action===`detect-svgs`)return a({success:!0,items:u()}),!0;if(e.action===`get-svg-by-id`){let t=n.get(e.id);return t?(d(t).then(e=>{a(e?{success:!0,svg:e.svg,filename:e.filename}:{success:!1,error:`Could not extract SVG`})}).catch(e=>a({success:!1,error:String(e)})),!0):(a({success:!1,error:`Element not found`}),!0)}if(e.action===`get-highlight-state`)return a({active:!!r}),!0;if(e.action===`toggle-highlight`)return r?(S(),a({success:!0,active:!1})):x().then(()=>{a({success:!0,active:!!r})}),!0;if(e.action===`locate-svg`){let t=n.get(e.id);return t?(C(t),a({success:!0}),!0):(a({success:!1,error:`Element not found`}),!0)}return!0}),e.detectAllSVGs=u,e})({});