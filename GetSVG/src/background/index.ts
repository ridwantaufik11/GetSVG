import { verifyLicenseKey } from '../lib/gumroad'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'getsvg-copy',
      title: 'Copy SVG',
      contexts: ['all'],
      enabled: false,
    })
    chrome.contextMenus.create({
      id: 'getsvg-download',
      title: 'Download SVG',
      contexts: ['all'],
      enabled: false,
    })
    chrome.contextMenus.create({
      id: 'getsvg-highlight',
      title: 'Highlight all SVGs',
      contexts: ['all'],
    })
  })

  // Weekly re-verification alarm (revokes Pro if license was refunded)
  chrome.alarms.create('pro-reverify', { periodInMinutes: 60 * 24 * 7 })
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'pro-reverify') return
  const data = await chrome.storage.sync.get(['proKey', 'proVerified'])
  if (!data.proKey || !data.proVerified) return
  const result = await verifyLicenseKey(data.proKey as string)
  // Only revoke on definitive failures — keep cached status on network errors
  if (!result.valid && result.error !== 'network') {
    await chrome.storage.sync.remove(['proKey', 'proVerified', 'proEmail'])
  }
})

const highlightState = new Map<number, boolean>()

function setHighlightTitle(active: boolean): void {
  chrome.contextMenus.update('getsvg-highlight', {
    title: active ? 'Hide Highlights' : 'Highlight all SVGs',
  })
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  setHighlightTitle(highlightState.get(tabId) ?? false)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  highlightState.delete(tabId)
})

async function sendToTab(tabId: number, message: object): Promise<any> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (!chrome.runtime.lastError) { resolve(response); return }
      // Content script not yet injected (tab pre-dates extension load) — inject and retry.
      chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
        if (chrome.runtime.lastError) { resolve(null); return }
        chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
          resolve(chrome.runtime.lastError ? null : retryResponse)
        })
      })
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  if (info.menuItemId === 'getsvg-highlight') {
    const response = await sendToTab(tab.id, { action: 'toggle-highlight' })
    const active = response?.active ?? false
    highlightState.set(tab.id, active)
    setHighlightTitle(active)
    return
  }

  const action = info.menuItemId === 'getsvg-copy' ? 'copy-svg' : 'download-svg'
  const response = await sendToTab(tab.id, { action })
  if (!response?.success) {
    console.warn('GetSVG: could not extract SVG —', response?.error)
    return
  }
  if (action === 'download-svg' && response.svg) {
    saveSVG(response.svg, response.filename)
  }
})

// Handle download requests originating from the highlight action popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'save-svg' && message.svg) {
    saveSVG(message.svg, message.filename)
    sendResponse({ success: true })
  }

  if (message.action === 'set-context') {
    const enabled = !!message.hasSVG
    chrome.contextMenus.update('getsvg-copy', { enabled })
    chrome.contextMenus.update('getsvg-download', { enabled })
    sendResponse({ success: true })
  }

  return true
})

function saveSVG(svg: string, filename = 'image.svg'): void {
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  chrome.downloads.download({ url: dataUrl, filename, saveAs: false })
}
