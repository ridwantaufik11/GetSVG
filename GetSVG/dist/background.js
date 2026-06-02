//#region src/lib/gumroad.ts
var e = "punwlg", t = {
	"GETSVG-DEV-RIDWAN": "ridwan@getsvg",
	"GETSVG-DEV-ARMA": "arma@getsvg",
	"GETSVG-DEV-SYAFIQ": "syafiq@getsvg"
};
async function n(n) {
	let r = n.trim().toUpperCase();
	if (t[r]) return {
		valid: !0,
		email: t[r]
	};
	try {
		let t = new URLSearchParams({
			product_id: e,
			license_key: n.trim(),
			increment_uses_count: "false"
		}), r = await (await fetch("https://api.gumroad.com/v2/licenses/verify", {
			method: "POST",
			body: t
		})).json();
		return r.success ? r.purchase?.refunded || r.purchase?.chargebacked ? {
			valid: !1,
			error: "refunded"
		} : {
			valid: !0,
			email: r.purchase?.email
		} : {
			valid: !1,
			error: "invalid"
		};
	} catch {
		return {
			valid: !1,
			error: "network"
		};
	}
}
chrome.runtime.onInstalled.addListener((e) => {
	e.reason === "install" && chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding/index.html") }), chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({
			id: "getsvg-highlight",
			title: "Highlight all SVGs",
			contexts: ["all"]
		}), chrome.contextMenus.create({
			id: "getsvg-copy",
			title: "Copy SVG",
			contexts: ["all"],
			enabled: !1
		}), chrome.contextMenus.create({
			id: "getsvg-download",
			title: "Download SVG",
			contexts: ["all"],
			enabled: !1
		}), chrome.contextMenus.create({
			id: "getsvg-copy-uri",
			title: "Copy as data URI",
			contexts: ["all"],
			enabled: !1
		});
	}), chrome.alarms.create("pro-reverify", { periodInMinutes: 1440 * 7 });
}), chrome.alarms.onAlarm.addListener(async (e) => {
	if (e.name !== "pro-reverify") return;
	let t = await chrome.storage.sync.get(["proKey", "proVerified"]);
	if (!t.proKey || !t.proVerified) return;
	let r = await n(t.proKey);
	!r.valid && r.error !== "network" && await chrome.storage.sync.remove([
		"proKey",
		"proVerified",
		"proEmail"
	]);
});
var r = /* @__PURE__ */ new Map();
function i(e) {
	chrome.contextMenus.update("getsvg-highlight", { title: e ? "Hide Highlights" : "Highlight all SVGs" });
}
chrome.tabs.onActivated.addListener(({ tabId: e }) => {
	i(r.get(e) ?? !1);
}), chrome.tabs.onRemoved.addListener((e) => {
	r.delete(e);
});
async function a(e, t) {
	return new Promise((n) => {
		chrome.tabs.sendMessage(e, t, (r) => {
			if (!chrome.runtime.lastError) {
				n(r);
				return;
			}
			chrome.scripting.executeScript({
				target: { tabId: e },
				files: ["content.js"]
			}, () => {
				if (chrome.runtime.lastError) {
					n(null);
					return;
				}
				chrome.tabs.sendMessage(e, t, (e) => {
					n(chrome.runtime.lastError ? null : e);
				});
			});
		});
	});
}
chrome.contextMenus.onClicked.addListener(async (e, t) => {
	if (!t?.id) return;
	if (e.menuItemId === "getsvg-highlight") {
		let e = (await a(t.id, { action: "toggle-highlight" }))?.active ?? !1;
		r.set(t.id, e), i(e);
		return;
	}
	if (e.menuItemId === "getsvg-copy-uri") {
		let e = await chrome.storage.sync.get(["proKey", "proVerified"]);
		if (!(e.proKey && e.proVerified)) {
			await a(t.id, { action: "show-pro-toast" }), await chrome.storage.local.set({ pendingProView: !0 }), chrome.action.openPopup?.();
			return;
		}
		let n = await a(t.id, { action: "copy-svg-uri" });
		n?.success || console.warn("GetSVG: could not copy data URI —", n?.error);
		return;
	}
	let n = e.menuItemId === "getsvg-copy" ? "copy-svg" : "download-svg", s = await a(t.id, { action: n });
	if (!s?.success) {
		console.warn("GetSVG: could not extract SVG —", s?.error);
		return;
	}
	n === "download-svg" && s.svg && o(s.svg, s.filename);
}), chrome.runtime.onMessage.addListener((e, t, n) => {
	if (e.action === "save-svg" && e.svg && (o(e.svg, e.filename), n({ success: !0 })), e.action === "open-pro-popup") return chrome.storage.local.set({ pendingProView: !0 }).then(() => {
		chrome.action.openPopup?.(), n({ success: !0 });
	}), !0;
	if (e.action === "set-context") {
		let t = !!e.hasSVG;
		chrome.contextMenus.update("getsvg-copy", { enabled: t }), chrome.contextMenus.update("getsvg-download", { enabled: t }), chrome.contextMenus.update("getsvg-copy-uri", { enabled: t }), n({ success: !0 });
		return;
	}
	return !0;
});
function o(e, t = "image.svg") {
	let n = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(e);
	chrome.downloads.download({
		url: n,
		filename: t,
		saveAs: !1
	});
}
//#endregion
