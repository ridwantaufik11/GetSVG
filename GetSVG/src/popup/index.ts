import JSZip from 'jszip'
import { verifyLicenseKey } from '../lib/gumroad'

interface SVGItem {
  id: string
  method: 'inline' | 'img' | 'bg' | 'use' | 'object'
  width: number
  height: number
  fileSize?: number
  srcUrl?: string
  thumbnail?: string
  name?: string
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const countEl = document.getElementById('count')!
const listEl = document.getElementById('list')!
const btnHighlight = document.getElementById('btn-highlight') as HTMLButtonElement
const toastEl = document.getElementById('toast') as HTMLElement
const btnAbout = document.getElementById('btn-about') as HTMLButtonElement
const aboutView = document.getElementById('about-view') as HTMLElement
const btnAboutBack = document.getElementById('btn-about-back') as HTMLButtonElement
const aboutVersion = document.getElementById('about-version') as HTMLElement
const btnPro = document.getElementById('btn-pro') as HTMLButtonElement
const proView = document.getElementById('pro-view') as HTMLElement
const btnProBack = document.getElementById('btn-pro-back') as HTMLButtonElement
const proActiveState = document.getElementById('pro-active-state') as HTMLElement
const proUpgradeState = document.getElementById('pro-upgrade-state') as HTMLElement
const btnDeactivate = document.getElementById('btn-deactivate') as HTMLButtonElement
const deactivateConfirm = document.getElementById('deactivate-confirm') as HTMLElement
const btnDeactivateConfirm = document.getElementById('btn-deactivate-confirm') as HTMLButtonElement
const btnDeactivateCancel = document.getElementById('btn-deactivate-cancel') as HTMLButtonElement
const proKeyInput = document.getElementById('pro-key-input') as HTMLInputElement
const btnActivate = document.getElementById('btn-activate') as HTMLButtonElement
const proKeyError = document.getElementById('pro-key-error') as HTMLElement
const proActiveEmail = document.getElementById('pro-active-email') as HTMLElement
const proBar = document.getElementById('pro-bar') as HTMLElement
const chkOptimize = document.getElementById('chk-optimize') as HTMLInputElement
// Action bars
const actionBarNormal = document.getElementById('action-bar-normal') as HTMLElement
const actionBarSelect = document.getElementById('action-bar-select') as HTMLElement
const btnDownloadBulk = document.getElementById('btn-download-bulk') as HTMLButtonElement
const btnDownloadSelected = document.getElementById('btn-download-selected') as HTMLButtonElement
const btnCancelSelect = document.getElementById('btn-cancel-select') as HTMLButtonElement
// Dropdown
const bulkDropdown = document.getElementById('bulk-dropdown') as HTMLElement
const bulkOptAll = document.getElementById('bulk-opt-all') as HTMLButtonElement
const bulkOptSelect = document.getElementById('bulk-opt-select') as HTMLButtonElement

// ─── Icon SVGs ────────────────────────────────────────────────────────────────

const _i = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
const ICONS = {
  copy:      `<svg class="icon" ${_i}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  lock:      `<svg class="icon" ${_i}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  download:  `<svg class="icon" ${_i}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
  check:     `<svg class="icon" ${_i}><polyline points="20 6 9 17 4 12"/></svg>`,
  crosshair: `<svg class="icon" ${_i}><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/></svg>`,
} as const

// ─── State ────────────────────────────────────────────────────────────────────

let activeTabId: number | null = null
let highlightActive = false
let isPro = false
let optimizeEnabled = false
let currentItems: SVGItem[] = []
let toastTimer: ReturnType<typeof setTimeout> | null = null
let svgoOptimize: ((svg: string, cfg: unknown) => { data: string }) | null = null
let selectionMode = false
const selectedIds = new Set<string>()

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg: string) {
  if (toastTimer) clearTimeout(toastTimer)
  toastEl.textContent = msg
  toastEl.classList.add('show')
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show')
    toastTimer = null
  }, 1500)
}

// ─── Pro status ───────────────────────────────────────────────────────────────

async function loadProStatus() {
  const data = await chrome.storage.sync.get(['proKey', 'proVerified', 'proEmail'])
  isPro = Boolean(data.proKey && data.proVerified)

  if (isPro && data.proEmail) {
    proActiveEmail.textContent = `Licensed to ${data.proEmail}`
  } else {
    proActiveEmail.textContent = ''
  }

  const localData = await chrome.storage.local.get(['optimizeEnabled'])
  optimizeEnabled = isPro && Boolean(localData.optimizeEnabled)
  chkOptimize.checked = optimizeEnabled

  applyProUI()
}

function applyProUI() {
  btnPro.classList.toggle('inactive', !isPro)
  btnPro.innerHTML = isPro ? `PRO ${ICONS.check}` : 'Get PRO'

  proBar.classList.add('visible')
  ;(document.getElementById('pro-bar-tag') as HTMLElement).style.display = isPro ? 'none' : ''

  if (isPro) {
    btnDownloadBulk.classList.remove('is-locked')
    btnDownloadBulk.innerHTML = 'Download Bulk'
  } else {
    btnDownloadBulk.classList.add('is-locked')
    btnDownloadBulk.innerHTML = `Download Bulk ${ICONS.lock}`
  }

  document.querySelectorAll<HTMLButtonElement>('.btn-copy-uri').forEach((btn) => {
    btn.classList.toggle('locked', !isPro)
  })
}

async function activatePro(key: string) {
  const trimmed = key.trim()
  if (trimmed.length < 10) {
    proKeyError.textContent = 'Key too short — enter your full Gumroad license key'
    proKeyError.classList.add('show')
    return
  }
  proKeyError.classList.remove('show')
  btnActivate.disabled = true
  btnActivate.textContent = 'Checking…'

  const result = await verifyLicenseKey(trimmed)

  btnActivate.disabled = false
  btnActivate.textContent = 'Unlock'

  if (!result.valid) {
    const msg = result.error === 'refunded'
      ? 'This license has been refunded'
      : result.error === 'network'
        ? 'Connection error — check your network and try again'
        : 'Invalid license key — check your Gumroad email'
    proKeyError.textContent = msg
    proKeyError.classList.add('show')
    return
  }

  await chrome.storage.sync.set({ proKey: trimmed, proVerified: true, proEmail: result.email ?? '' })
  isPro = true
  proActiveEmail.textContent = result.email ? `Licensed to ${result.email}` : ''
  applyProUI()
  showProActiveState()
}

async function deactivatePro() {
  await chrome.storage.sync.remove(['proKey', 'proVerified', 'proEmail'])
  isPro = false
  proActiveEmail.textContent = ''
  applyProUI()
  showProUpgradeState()
}

function showProActiveState() {
  proActiveState.style.display = 'flex'
  proUpgradeState.style.display = 'none'
}

function showProUpgradeState() {
  proActiveState.style.display = 'none'
  proUpgradeState.style.display = 'flex'
}

// ─── SVGO ─────────────────────────────────────────────────────────────────────

async function getOptimize() {
  if (!svgoOptimize) {
    const mod = await import('svgo/browser')
    svgoOptimize = mod.optimize as typeof svgoOptimize
  }
  return svgoOptimize!
}

async function maybeOptimize(svg: string): Promise<string> {
  if (!optimizeEnabled) return svg
  try {
    const optimize = await getOptimize()
    const result = optimize(svg, { plugins: ['preset-default'] })
    return result.data
  } catch {
    return svg
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadProStatus()

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    showState('No active tab found.')
    return
  }
  activeTabId = tab.id

  let res: any = null
  try {
    res = await chrome.tabs.sendMessage(tab.id, { action: 'detect-svgs' })
  } catch {
    // Content script not yet running on this tab — inject it and retry once.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      res = await chrome.tabs.sendMessage(tab.id, { action: 'detect-svgs' })
    } catch {
      showState('Cannot scan this page.', 'Browser internal pages are not supported.')
      return
    }
  }
  if (!res?.success || !res.items) {
    showState('Could not scan this page.', 'Try refreshing the tab and reopening GetSVG.')
    return
  }
  currentItems = res.items as SVGItem[]
  render(currentItems)

  // Sync highlight button with whatever state the content script is actually in
  try {
    const stateRes = await chrome.tabs.sendMessage(tab.id, { action: 'get-highlight-state' })
    highlightActive = stateRes?.active ?? false
    btnHighlight.classList.toggle('is-active', highlightActive)
    btnHighlight.textContent = highlightActive ? 'Hide Highlights' : 'Highlight All'
  } catch { /* ignore — button stays at default */ }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(items: SVGItem[]) {
  countEl.textContent = ` (${items.length} Found)`
  listEl.innerHTML = ''

  if (items.length === 0) {
    showState('No SVGs detected on this page.')
    return
  }

  for (const item of items) {
    listEl.appendChild(createItem(item))
  }
}

function createItem(item: SVGItem): HTMLElement {
  const row = document.createElement('div')
  row.className = 'item'

  // Checkbox (visible only in selection mode via CSS)
  const check = document.createElement('input')
  check.type = 'checkbox'
  check.className = 'item-check'
  check.addEventListener('change', (e) => {
    e.stopPropagation()
    toggleItemSelection(item.id, check, row)
  })

  // Clicking anywhere on the row toggles selection in selection mode
  row.addEventListener('click', (e) => {
    if (!selectionMode) return
    if (e.target === check) return
    check.checked = !check.checked
    toggleItemSelection(item.id, check, row)
  })

  const thumb = document.createElement('div')
  thumb.className = 'thumb'
  if (item.thumbnail) {
    const img = document.createElement('img')
    img.src = item.thumbnail
    img.alt = ''
    thumb.appendChild(img)
  } else {
    const ph = document.createElement('span')
    ph.className = 'thumb-placeholder'
    ph.textContent = item.method
    thumb.appendChild(ph)
  }

  const meta = document.createElement('div')
  meta.className = 'meta'

  const nameEl = document.createElement('div')
  nameEl.className = 'file-name'
  nameEl.textContent = item.name || 'image'

  const badge = document.createElement('span')
  badge.className = 'method-badge'
  badge.textContent = item.method

  const dimsSize = document.createElement('div')
  dimsSize.className = 'dims-size'
  const dimsStr = item.width && item.height ? `${item.width}×${item.height}` : '—'
  const sizeStr = item.fileSize ? formatSize(item.fileSize) : (item.srcUrl ? '—' : '')
  dimsSize.textContent = sizeStr ? `${dimsStr}  |  ${sizeStr}` : dimsStr

  meta.appendChild(nameEl)
  meta.appendChild(badge)
  meta.appendChild(dimsSize)

  const actions = document.createElement('div')
  actions.className = 'item-actions'

  const copyBtn = document.createElement('button')
  copyBtn.className = 'item-btn copy-btn'
  copyBtn.innerHTML = `${ICONS.copy} Copy`
  copyBtn.addEventListener('click', () => handleCopy(item, copyBtn))

  const dlBtn = document.createElement('button')
  dlBtn.className = 'item-btn ghost'
  dlBtn.innerHTML = `${ICONS.download} Save`
  dlBtn.addEventListener('click', () => handleDownload(item, dlBtn))

  const uriBtn = document.createElement('button')
  uriBtn.className = isPro ? 'item-btn ghost btn-copy-uri' : 'item-btn locked btn-copy-uri'
  uriBtn.textContent = 'URI'
  uriBtn.title = 'Copy as Data URI'
  uriBtn.addEventListener('click', () => {
    if (!isPro) { openProView(); return }
    handleCopyUri(item, uriBtn)
  })

  const locateBtn = document.createElement('button')
  locateBtn.className = 'item-btn ghost'
  locateBtn.innerHTML = `${ICONS.crosshair} Locate`
  locateBtn.title = 'Scroll to this SVG on the page'
  locateBtn.addEventListener('click', () => handleLocate(item))

  actions.appendChild(copyBtn)
  actions.appendChild(dlBtn)
  actions.appendChild(locateBtn)
  actions.appendChild(uriBtn)

  row.appendChild(check)
  row.appendChild(thumb)
  row.appendChild(meta)
  row.appendChild(actions)

  return row
}

function showState(title: string, sub = '') {
  listEl.innerHTML = ''
  const msg = document.createElement('div')
  msg.className = 'state-msg'
  msg.innerHTML = `<strong>${escText(title)}</strong>${sub ? `<span>${escText(sub)}</span>` : ''}`
  listEl.appendChild(msg)
}


// ─── Copy SVG ─────────────────────────────────────────────────────────────────

async function handleCopy(item: SVGItem, btn: HTMLButtonElement) {
  const tabId = activeTabId
  if (!tabId) return
  btn.textContent = '…'
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'get-svg-by-id', id: item.id })
    if (!res?.success) throw new Error(res?.error)
    const svg = await maybeOptimize(res.svg)
    await navigator.clipboard.writeText(withTitle(svg, item.name || 'image'))
    flashBtn(btn, 'Copied!', `${ICONS.copy} Copy`)
    showToast('SVG Copied!')
  } catch {
    flashBtn(btn, 'Error', `${ICONS.copy} Copy`)
  }
}

// ─── Download SVG ─────────────────────────────────────────────────────────────

async function handleDownload(item: SVGItem, btn: HTMLButtonElement) {
  const tabId = activeTabId
  if (!tabId) return
  btn.textContent = '…'
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'get-svg-by-id', id: item.id })
    if (!res?.success) throw new Error(res?.error)
    const svg = await maybeOptimize(res.svg)
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await chrome.downloads.download({ url: dataUrl, filename: res.filename ?? 'image.svg' })
    flashBtn(btn, 'Saved!', `${ICONS.download} Save`)
  } catch {
    flashBtn(btn, 'Error', `${ICONS.download} Save`)
  }
}

// ─── Locate SVG on page ───────────────────────────────────────────────────────

async function handleLocate(item: SVGItem) {
  const tabId = activeTabId
  if (!tabId) return
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'locate-svg', id: item.id })
  } catch { /* element may be gone — ignore */ }
  window.close()
}

// ─── Copy as Data URI (Pro) ───────────────────────────────────────────────────

async function handleCopyUri(item: SVGItem, btn: HTMLButtonElement) {
  const tabId = activeTabId
  if (!tabId) return
  btn.textContent = '…'
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'get-svg-by-id', id: item.id })
    if (!res?.success) throw new Error(res?.error)
    const svg = await maybeOptimize(res.svg)
    const base64 = btoa(unescape(encodeURIComponent(svg)))
    const dataUri = `data:image/svg+xml;base64,${base64}`
    await navigator.clipboard.writeText(dataUri)
    flashBtn(btn, 'Copied!', 'URI')
    showToast('Data URI Copied!')
  } catch {
    flashBtn(btn, 'Error', 'URI')
  }
}

// ─── Download All ZIP ─────────────────────────────────────────────────────────

async function handleDownloadAll() {
  const tabId = activeTabId
  if (!tabId || currentItems.length === 0) return
  await runZipDownload(currentItems, btnDownloadBulk)
}

// ─── Download Selected ZIP ────────────────────────────────────────────────────

async function handleDownloadSelected() {
  const tabId = activeTabId
  if (!tabId || selectedIds.size === 0) return
  const items = currentItems.filter((item) => selectedIds.has(item.id))
  await runZipDownload(items, btnDownloadSelected)
  exitSelectionMode()
}

// ─── ZIP helper ───────────────────────────────────────────────────────────────

function sendTabMsg(tabId: number, msg: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 10_000)
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      clearTimeout(timer)
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response)
      }
    })
  })
}

async function runZipDownload(items: SVGItem[], triggerBtn: HTMLButtonElement) {
  const tabId = activeTabId
  if (!tabId) return

  const originalHTML = triggerBtn.innerHTML
  triggerBtn.disabled = true
  triggerBtn.classList.add('is-loading')

  const zip = new JSZip()
  const usedNames = new Map<string, number>()
  let done = 0

  const updateBtn = () => { triggerBtn.textContent = `${done}/${items.length}…` }
  updateBtn()

  await Promise.allSettled(items.map(async (item) => {
    try {
      const res = await sendTabMsg(tabId, { action: 'get-svg-by-id', id: item.id })
      if (!res?.success) return
      const svg = await maybeOptimize(res.svg)
      const baseName = (res.filename as string | undefined)?.replace(/\.svg$/i, '') ?? 'image'
      const count = (usedNames.get(baseName) ?? 0) + 1
      usedNames.set(baseName, count)
      const filename = count > 1 ? `${baseName}-${count}.svg` : `${baseName}.svg`
      zip.file(filename, svg)
    } catch {
      // skip failed items
    } finally {
      done++
      updateBtn()
    }
  }))

  try {
    triggerBtn.textContent = 'Zipping…'
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    await chrome.downloads.download({ url, filename: `getsvg-${today}.zip` })
    URL.revokeObjectURL(url)
    showToast(`${items.length} SVGs downloaded!`)
  } catch {
    showToast('ZIP failed — try again')
  } finally {
    triggerBtn.disabled = false
    triggerBtn.classList.remove('is-loading')
    triggerBtn.innerHTML = originalHTML
  }
}

// ─── Selection mode ───────────────────────────────────────────────────────────

function enterSelectionMode() {
  selectionMode = true
  selectedIds.clear()
  listEl.classList.add('selection-mode')
  // Reset all checkboxes
  listEl.querySelectorAll<HTMLInputElement>('.item-check').forEach((c) => {
    c.checked = false
  })
  listEl.querySelectorAll('.item').forEach((r) => r.classList.remove('is-selected'))
  actionBarNormal.style.display = 'none'
  actionBarSelect.style.display = 'flex'
  updateDownloadSelectedBtn()
  // Collapse pro bar to save space
  proBar.style.display = 'none'
}

function exitSelectionMode() {
  selectionMode = false
  selectedIds.clear()
  listEl.classList.remove('selection-mode')
  listEl.querySelectorAll<HTMLInputElement>('.item-check').forEach((c) => {
    c.checked = false
  })
  listEl.querySelectorAll('.item').forEach((r) => r.classList.remove('is-selected'))
  actionBarNormal.style.display = 'flex'
  actionBarSelect.style.display = 'none'
  // Restore pro bar
  proBar.classList.add('visible')
}

function toggleItemSelection(id: string, check: HTMLInputElement, row: HTMLElement) {
  if (check.checked) {
    selectedIds.add(id)
    row.classList.add('is-selected')
  } else {
    selectedIds.delete(id)
    row.classList.remove('is-selected')
  }
  updateDownloadSelectedBtn()
}

function updateDownloadSelectedBtn() {
  const count = selectedIds.size
  btnDownloadSelected.textContent = count > 0 ? `Download (${count})` : 'Download (0)'
  btnDownloadSelected.disabled = count === 0
}

// ─── Bulk dropdown ────────────────────────────────────────────────────────────

function openBulkDropdown() {
  const rect = btnDownloadBulk.getBoundingClientRect()
  bulkDropdown.style.top = `${rect.bottom}px`
  bulkDropdown.style.left = `${rect.left}px`
  bulkDropdown.style.width = `${rect.width}px`
  bulkDropdown.classList.add('open')
}

function closeBulkDropdown() {
  bulkDropdown.classList.remove('open')
}

btnDownloadBulk.addEventListener('click', (e) => {
  if (!isPro) { openProView(); return }
  e.stopPropagation()
  if (bulkDropdown.classList.contains('open')) {
    closeBulkDropdown()
  } else {
    openBulkDropdown()
  }
})

document.addEventListener('click', (e) => {
  if (!bulkDropdown.contains(e.target as Node)) {
    closeBulkDropdown()
  }
})

bulkOptAll.addEventListener('click', () => {
  closeBulkDropdown()
  handleDownloadAll()
})

bulkOptSelect.addEventListener('click', () => {
  closeBulkDropdown()
  enterSelectionMode()
})

// ─── Selection mode actions ───────────────────────────────────────────────────

btnDownloadSelected.addEventListener('click', () => handleDownloadSelected())
btnCancelSelect.addEventListener('click', () => exitSelectionMode())

// ─── Highlight toggle ─────────────────────────────────────────────────────────

btnHighlight.addEventListener('click', async () => {
  const tabId = activeTabId
  if (!tabId) return
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'toggle-highlight' })
    highlightActive = res?.active ?? !highlightActive
    btnHighlight.classList.toggle('is-active', highlightActive)
    btnHighlight.textContent = highlightActive ? 'Hide Highlights' : 'Highlight All'
  } catch {
    // page may not have content script
  }
})

// ─── Optimize toggle ──────────────────────────────────────────────────────────

const optimizeLabel = proBar.querySelector('.optimize-label') as HTMLLabelElement
optimizeLabel.addEventListener('click', (e) => {
  if (!isPro) {
    e.preventDefault()
    openProView()
  }
})

proBar.querySelector('.pro-bar-tag')?.addEventListener('click', () => openProView())

chkOptimize.addEventListener('change', async () => {
  if (!isPro) { chkOptimize.checked = false; return }
  optimizeEnabled = chkOptimize.checked
  await chrome.storage.local.set({ optimizeEnabled })
})

// ─── Panel navigation ─────────────────────────────────────────────────────────

function openProView() {
  if (isPro) showProActiveState()
  else showProUpgradeState()
  proView.classList.add('open')
}

btnPro.addEventListener('click', () => openProView())
btnProBack.addEventListener('click', () => proView.classList.remove('open'))
btnAbout.addEventListener('click', () => aboutView.classList.add('open'))
btnAboutBack.addEventListener('click', () => aboutView.classList.remove('open'))

// ─── Pro activation ───────────────────────────────────────────────────────────

btnActivate.addEventListener('click', () => activatePro(proKeyInput.value))

proKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') activatePro(proKeyInput.value)
  proKeyError.classList.remove('show')
})

btnDeactivate.addEventListener('click', () => deactivateConfirm.classList.add('open'))
btnDeactivateCancel.addEventListener('click', () => deactivateConfirm.classList.remove('open'))
btnDeactivateConfirm.addEventListener('click', async () => {
  deactivateConfirm.classList.remove('open')
  await deactivatePro()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flashBtn(btn: HTMLButtonElement, msg: string, originalHTML: string) {
  btn.textContent = msg
  btn.classList.add('feedback')
  setTimeout(() => {
    btn.innerHTML = originalHTML
    btn.classList.remove('feedback')
  }, 1400)
}

function escText(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function withTitle(svgStr: string, name: string): string {
  const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const escContent = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const titleTag = `<title>${escContent(name)}</title>`

  // Set id on root <svg> — Figma uses this as the layer name
  let result: string
  const openTagEnd = svgStr.indexOf('>')
  const openTag = svgStr.slice(0, openTagEnd)
  if (/\bid="/.test(openTag)) {
    result = svgStr.replace(/(<svg[^>]*?)\bid="[^"]*"/, `$1id="${escAttr(name)}"`)
  } else {
    result = svgStr.replace(/^<svg/, `<svg id="${escAttr(name)}"`)
  }

  // Inject or replace <title>
  if (/<title[\s>]/i.test(result)) {
    return result.replace(/<title[^>]*>[\s\S]*?<\/title>/i, titleTag)
  }
  return result.replace(/(<svg(?:\s[^>]*)?>)/, `$1${titleTag}`)
}

// ─── Version ──────────────────────────────────────────────────────────────────

if (chrome.runtime.getManifest) {
  const manifest = chrome.runtime.getManifest()
  if (manifest.version) aboutVersion.textContent = `v${manifest.version}`
}

init()
