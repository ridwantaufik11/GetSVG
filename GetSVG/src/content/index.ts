export {}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SVGItem {
  id: string
  method: 'inline' | 'img' | 'bg' | 'use' | 'object'
  width: number
  height: number
  fileSize?: number   // bytes, populated for inline/use only (remote types require a fetch)
  srcUrl?: string
  thumbnail?: string  // data URL (inline/use) or same as srcUrl (img/bg/object)
  name?: string       // display name derived at detection time
}

// ─── State ────────────────────────────────────────────────────────────────────

let lastRightClicked: Element | null = null
const elementMap = new Map<string, Element>()

let highlightHost: HTMLElement | null = null
let highlightShadow: ShadowRoot | null = null
const cleanupFns: Array<() => void> = []

function hasSVGAtElement(el: Element): boolean {
  if (el.closest('svg')) return true
  if (el instanceof HTMLImageElement && /\.svg(\?|$)/i.test(el.src)) return true
  const bg = window.getComputedStyle(el).backgroundImage
  if (/url\(["']?[^"')]+\.svg/i.test(bg)) return true
  if (el instanceof HTMLObjectElement && /\.svg(\?|$)/i.test(el.data)) return true
  if (el instanceof HTMLEmbedElement && /\.svg(\?|$)/i.test(el.src)) return true
  return false
}

document.addEventListener('contextmenu', (e) => {
  let target = e.target as Element
  // composedPath pierces shadow DOM — if the click landed on one of our highlight
  // overlays, find it by data-id and resolve back to the real page element.
  for (const node of e.composedPath()) {
    if (node instanceof HTMLElement && node.dataset.id && elementMap.has(node.dataset.id)) {
      target = elementMap.get(node.dataset.id)!
      break
    }
  }
  lastRightClicked = target
  chrome.runtime.sendMessage({ action: 'set-context', hasSVG: hasSVGAtElement(target) })
})

// ─── SVG Cleaning ─────────────────────────────────────────────────────────────

function cleanSVG(svg: SVGElement): string {
  const clone = svg.cloneNode(true) as SVGElement
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  clone.querySelectorAll('script').forEach((s) => s.remove())
  resolveUseRefs(clone, svg)
  return clone.outerHTML
}

function resolveUseRefs(clone: SVGElement, original: SVGElement): void {
  clone.querySelectorAll('use').forEach((use) => {
    const href = use.getAttribute('href') || use.getAttribute('xlink:href')
    if (!href?.startsWith('#')) return
    const symbolId = href.slice(1)
    const symbol =
      original.querySelector(`#${CSS.escape(symbolId)}`) ||
      document.getElementById(symbolId)
    if (!symbol) return
    let defs = clone.querySelector('defs')
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
      clone.insertBefore(defs, clone.firstChild)
    }
    if (!defs.querySelector(`#${CSS.escape(symbolId)}`)) {
      defs.appendChild(symbol.cloneNode(true))
    }
  })
}

function svgFilename(svg: SVGElement): string {
  return (svg.id || svg.getAttribute('data-name') || 'image') + '.svg'
}

function svgDisplayName(el: SVGElement): string {
  // 1. <title> inside SVG — the semantic SVG name
  const title = el.querySelector(':scope > title')?.textContent?.trim()
  if (title) return title

  // 2. aria-label on the SVG itself
  const ariaLabel = el.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  // 3. id or data-name on the SVG
  if (el.id) return el.id
  const dataName = el.getAttribute('data-name')?.trim()
  if (dataName) return dataName

  // 4. Walk up to nearest interactive/semantic parent for context
  let parent = el.parentElement
  while (parent && parent.tagName !== 'BODY') {
    const label =
      parent.getAttribute('aria-label')?.trim() ||
      parent.getAttribute('title')?.trim() ||
      parent.getAttribute('alt')?.trim()
    if (label) return label

    // Button or link text (short, meaningful)
    if (
      parent instanceof HTMLButtonElement ||
      parent instanceof HTMLAnchorElement ||
      parent.getAttribute('role') === 'button'
    ) {
      const text = parent.textContent?.trim().replace(/\s+/g, ' ')
      if (text && text.length > 0 && text.length <= 40) return text
    }

    // Meaningful id (not numeric/random — skip ids like "svgr-1" or all digits)
    if (parent.id && !/^[\d]/.test(parent.id) && !/^svgr-/.test(parent.id)) {
      return parent.id
    }

    parent = parent.parentElement
  }

  return 'image'
}

// ─── Detection ────────────────────────────────────────────────────────────────

export function detectAllSVGs(): SVGItem[] {
  const items: SVGItem[] = []
  let counter = 0
  const seen = new WeakSet<Element>()

  elementMap.clear()

  const makeId = () => `svgr-${++counter}`
  const bboxOf = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { width: Math.round(r.width), height: Math.round(r.height) }
  }
  const svgBytes = (svg: SVGElement): number =>
    new TextEncoder().encode(cleanSVG(svg)).length

  const svgToDataUrl = (svg: SVGElement): string =>
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cleanSVG(svg))

  const register = (item: SVGItem, el: Element) => {
    items.push(item)
    elementMap.set(item.id, el)
    seen.add(el)
  }

  const urlName = (url: string) =>
    url.split('/').pop()?.split('?')[0]?.replace(/\.svg$/i, '') || 'image'

  // 1. Inline <svg>
  document.querySelectorAll<SVGElement>('svg').forEach((el) => {
    if (el.closest('defs, symbol') || seen.has(el)) return
    const { width, height } = bboxOf(el)
    register({ id: makeId(), method: 'inline', width, height, fileSize: svgBytes(el), thumbnail: svgToDataUrl(el), name: svgDisplayName(el) }, el)
  })

  // 2. <img src="*.svg">
  document.querySelectorAll<HTMLImageElement>('img').forEach((el) => {
    if (!/\.svg(\?|$)/i.test(el.src) || seen.has(el)) return
    const { width, height } = bboxOf(el)
    register({ id: makeId(), method: 'img', width, height, srcUrl: el.src, thumbnail: el.src, name: urlName(el.src) }, el)
  })

  // 3. CSS background-image: url("*.svg")
  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (seen.has(el)) return
    const bg = window.getComputedStyle(el).backgroundImage
    const match = bg.match(/url\(["']?([^"')]+\.svg[^"')]*)/i)
    if (!match) return
    const { width, height } = bboxOf(el)
    register({ id: makeId(), method: 'bg', width, height, srcUrl: match[1], thumbnail: match[1], name: urlName(match[1]) }, el)
  })

  // 4. <use href="#..."> — deduplicated by parent <svg>
  document.querySelectorAll<SVGUseElement>('use').forEach((use) => {
    const parentSvg = use.closest('svg') as SVGElement | null
    if (!parentSvg || seen.has(parentSvg)) return
    const { width, height } = bboxOf(parentSvg)
    register({ id: makeId(), method: 'use', width, height, fileSize: svgBytes(parentSvg), thumbnail: svgToDataUrl(parentSvg), name: svgDisplayName(parentSvg) }, parentSvg)
  })

  // 5. <object> / <embed>
  document.querySelectorAll<HTMLElement>(
    'object[type="image/svg+xml"], embed[src$=".svg"]'
  ).forEach((el) => {
    if (seen.has(el)) return
    const src =
      (el as HTMLObjectElement).data || (el as HTMLEmbedElement).src || undefined
    const { width, height } = bboxOf(el)
    register({ id: makeId(), method: 'object', width, height, srcUrl: src, thumbnail: src, name: src ? urlName(src) : 'image' }, el)
  })

  return items
}

// ─── Extraction ───────────────────────────────────────────────────────────────

function extractSVG(el: Element): Promise<{ svg: string; filename: string } | null> {
  const svgEl = el.closest('svg') as SVGElement | null
  if (svgEl) {
    return Promise.resolve({ svg: cleanSVG(svgEl), filename: svgFilename(svgEl) })
  }
  if (el instanceof HTMLImageElement && /\.svg(\?|$)/i.test(el.src)) {
    const filename = el.src.split('/').pop()?.split('?')[0] ?? 'image.svg'
    return fetch(el.src).then((r) => r.text()).then((svg) => ({ svg, filename }))
  }
  const bg = window.getComputedStyle(el).backgroundImage
  const bgMatch = bg.match(/url\(["']?([^"')]+\.svg[^"')]*)/i)
  if (bgMatch) {
    const url = bgMatch[1]
    const filename = url.split('/').pop()?.split('?')[0] ?? 'image.svg'
    return fetch(url).then((r) => r.text()).then((svg) => ({ svg, filename }))
  }
  const src =
    el instanceof HTMLObjectElement
      ? el.data
      : el instanceof HTMLEmbedElement
        ? el.src
        : null
  if (src && /\.svg(\?|$)/i.test(src)) {
    const filename = src.split('/').pop()?.split('?')[0] ?? 'image.svg'
    return fetch(src).then((r) => r.text()).then((svg) => ({ svg, filename }))
  }
  return Promise.resolve(null)
}

// ─── Clipboard ───────────────────────────────────────────────────────────────

// navigator.clipboard is undefined on HTTP pages (non-secure context); use
// textarea + execCommand as a reliable fallback for content script context.
function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise<void>((resolve, reject) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:-1000px;left:-1000px'
    document.documentElement.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    ok ? resolve() : reject(new Error('execCommand copy failed'))
  })
}

// ─── Highlight Styles (Neobrutalism) ─────────────────────────────────────────

const HIGHLIGHT_STYLES = `
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
`

// ─── Highlight Logic ──────────────────────────────────────────────────────────

function setPosition(el: HTMLElement, target: Element): void {
  const r = target.getBoundingClientRect()
  el.style.left = `${r.left}px`
  el.style.top = `${r.top}px`
  el.style.width = `${r.width}px`
  el.style.height = `${r.height}px`
}

function popupPosition(anchor: HTMLElement): { left: number; top: number } {
  const r = anchor.getBoundingClientRect()
  return {
    left: r.left,
    top: r.top > 60 ? r.top - 50 : r.bottom + 4,
  }
}

function showFeedback(shadow: ShadowRoot, anchor: HTMLElement, text: string): void {
  const fb = document.createElement('div')
  fb.className = 'feedback'
  fb.textContent = text
  const r = anchor.getBoundingClientRect()
  fb.style.left = `${r.left}px`
  fb.style.top = `${r.top + r.height / 2 - 13}px`
  shadow.appendChild(fb)
  setTimeout(() => fb.remove(), 1200)
}

function showPageToast(text: string): void {
  let host = document.getElementById('svgr-toast') as HTMLElement | null
  if (!host) {
    host = document.createElement('div')
    host.id = 'svgr-toast'
    host.style.cssText =
      'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none'
    document.documentElement.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
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
    `
    shadow.appendChild(style)
  }
  const shadow = host.shadowRoot!
  const t = document.createElement('div')
  t.className = 't'
  t.textContent = text
  shadow.appendChild(t)
  setTimeout(() => t.remove(), 3000)
}

function pulseElement(el: Element): void {
  const target = el.closest('svg') ?? el
  const r = target.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;z-index:2147483647`
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
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
  `
  shadow.appendChild(style)
  const p = document.createElement('div')
  p.className = 'p'
  shadow.appendChild(p)

  setTimeout(() => host.remove(), 3000)
}

function removePopups(shadow: ShadowRoot): void {
  shadow.querySelectorAll('.popup').forEach((p) => p.remove())
}

function showActionPopup(
  shadow: ShadowRoot,
  overlay: HTMLElement,
  item: SVGItem,
  el: Element
): void {
  removePopups(shadow)

  const popup = document.createElement('div')
  popup.className = 'popup'

  const copyBtn = document.createElement('button')
  copyBtn.className = 'btn'
  copyBtn.textContent = 'Copy'
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      const r = await extractSVG(el)
      if (!r) return
      await writeClipboard(r.svg)
      removePopups(shadow)
      showFeedback(shadow, overlay, 'Copied!')
    } catch {
      removePopups(shadow)
      showFeedback(shadow, overlay, 'Copy failed')
    }
  })

  const dlBtn = document.createElement('button')
  dlBtn.className = 'btn ghost'
  dlBtn.textContent = 'Download'
  dlBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    extractSVG(el).then((r) => {
      if (!r) return
      chrome.runtime.sendMessage({ action: 'save-svg', svg: r.svg, filename: r.filename })
      removePopups(shadow)
      showFeedback(shadow, overlay, 'Saved!')
    })
  })

  popup.appendChild(copyBtn)
  popup.appendChild(dlBtn)
  shadow.appendChild(popup)

  const { left, top } = popupPosition(overlay)
  popup.style.left = `${left}px`
  popup.style.top = `${top}px`
}

async function activateHighlight(): Promise<void> {
  if (highlightHost) deactivateHighlight()

  showPageToast('Highlighting SVGs...')
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const items = detectAllSVGs()
  if (items.length === 0) return

  // Shadow DOM container — isolates our styles from the page
  const host = document.createElement('div')
  host.id = 'svgr-root'
  host.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:visible'
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const styleEl = document.createElement('style')
  styleEl.textContent = HIGHLIGHT_STYLES
  shadow.appendChild(styleEl)

  const tooltip = document.createElement('div')
  tooltip.className = 'tooltip'
  tooltip.style.display = 'none'
  shadow.appendChild(tooltip)

  for (const item of items) {
    const el = elementMap.get(item.id)
    if (!el) continue

    const overlay = document.createElement('div')
    overlay.className = 'overlay'
    overlay.dataset.id = item.id
    setPosition(overlay, el)
    shadow.appendChild(overlay)

    overlay.addEventListener('mouseenter', () => {
      tooltip.innerHTML = `<span class="badge">${item.method}</span>${item.width}×${item.height}px`
      const r = overlay.getBoundingClientRect()
      tooltip.style.left = `${r.left}px`
      tooltip.style.top = `${r.top > 36 ? r.top - 34 : r.bottom + 4}px`
      tooltip.style.display = 'block'
    })
    overlay.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none'
    })
    overlay.addEventListener('click', (e) => {
      e.stopPropagation()
      showActionPopup(shadow, overlay, item, el)
    })
  }

  // Update overlay positions on scroll / resize
  const updatePositions = () => {
    shadow.querySelectorAll<HTMLElement>('.overlay').forEach((overlay) => {
      const el = elementMap.get(overlay.dataset.id!)
      if (el) setPosition(overlay, el)
    })
  }
  window.addEventListener('scroll', updatePositions, { capture: true, passive: true })
  window.addEventListener('resize', updatePositions, { passive: true })

  // Close action popup when clicking outside shadow root
  const onDocClick = (e: MouseEvent) => {
    const path = e.composedPath()
    if (!path.includes(host)) removePopups(shadow)
  }
  document.addEventListener('click', onDocClick, { capture: true })

  cleanupFns.push(
    () => window.removeEventListener('scroll', updatePositions, { capture: true }),
    () => window.removeEventListener('resize', updatePositions),
    () => document.removeEventListener('click', onDocClick, { capture: true })
  )

  highlightHost = host
  highlightShadow = shadow
}

function deactivateHighlight(): void {
  cleanupFns.splice(0).forEach((fn) => fn())
  highlightHost?.remove()
  highlightHost = null
  highlightShadow = null
}

// ─── Locate ───────────────────────────────────────────────────────────────────

function locateElement(el: Element): void {
  const target = el.closest('svg') ?? el
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })

  // Poll until element stops moving in the viewport (scroll settled), then pulse.
  // Fixed timeout fails for img/bg elements far from current scroll position.
  let lastTop: number | null = null
  let stableFrames = 0
  const deadline = performance.now() + 2500

  const poll = () => {
    const top = target.getBoundingClientRect().top
    if (top === lastTop) {
      stableFrames++
      if (stableFrames >= 4) { pulseElement(el); return }
    } else {
      stableFrames = 0
    }
    lastTop = top
    if (performance.now() < deadline) requestAnimationFrame(poll)
    else pulseElement(el) // fallback if scroll never settles
  }
  requestAnimationFrame(poll)
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'copy-svg' || message.action === 'download-svg') {
    const el = lastRightClicked
    if (!el) {
      sendResponse({ success: false, error: 'No element right-clicked' })
      return true
    }
    extractSVG(el).then((result) => {
      if (!result) {
        sendResponse({ success: false, error: 'No SVG found at right-clicked element' })
        return
      }
      if (message.action === 'copy-svg') {
        writeClipboard(result.svg)
          .then(() => {
            showPageToast('SVG Copied!')
            pulseElement(el)
            sendResponse({ success: true })
          })
          .catch((err) => sendResponse({ success: false, error: String(err) }))
      } else {
        sendResponse({ success: true, svg: result.svg, filename: result.filename })
      }
    })
    return true
  }

  if (message.action === 'copy-svg-uri') {
    const el = lastRightClicked
    if (!el) {
      sendResponse({ success: false, error: 'No element right-clicked' })
      return true
    }
    extractSVG(el).then((result) => {
      if (!result) {
        sendResponse({ success: false, error: 'No SVG found at right-clicked element' })
        return
      }
      const base64 = btoa(unescape(encodeURIComponent(result.svg)))
      const dataUri = `data:image/svg+xml;base64,${base64}`
      writeClipboard(dataUri)
        .then(() => {
          showPageToast('Data URI Copied!')
          pulseElement(el)
          sendResponse({ success: true })
        })
        .catch((err) => sendResponse({ success: false, error: String(err) }))
    })
    return true
  }

  if (message.action === 'detect-svgs') {
    sendResponse({ success: true, items: detectAllSVGs() })
    return true
  }

  if (message.action === 'get-svg-by-id') {
    const el = elementMap.get(message.id)
    if (!el) {
      sendResponse({ success: false, error: 'Element not found' })
      return true
    }
    extractSVG(el)
      .then((result) => {
        if (!result) {
          sendResponse({ success: false, error: 'Could not extract SVG' })
        } else {
          sendResponse({ success: true, svg: result.svg, filename: result.filename })
        }
      })
      .catch((err) => sendResponse({ success: false, error: String(err) }))
    return true
  }

  if (message.action === 'get-highlight-state') {
    sendResponse({ active: !!highlightHost })
    return true
  }

  if (message.action === 'toggle-highlight') {
    if (highlightHost) {
      deactivateHighlight()
      sendResponse({ success: true, active: false })
    } else {
      activateHighlight().then(() => {
        sendResponse({ success: true, active: !!highlightHost })
      })
    }
    return true
  }

  if (message.action === 'locate-svg') {
    const el = elementMap.get(message.id)
    if (!el) {
      sendResponse({ success: false, error: 'Element not found' })
      return true
    }
    locateElement(el)
    sendResponse({ success: true })
    return true
  }

  return true
})
