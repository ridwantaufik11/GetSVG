//#region src/lib/gumroad.ts
var e = "YOUR_GUMROAD_PRODUCT_ID";
async function t(t) {
	try {
		let n = new URLSearchParams({
			product_id: e,
			license_key: t.trim(),
			increment_uses_count: "false"
		}), r = await fetch("https://api.gumroad.com/v2/licenses/verify", {
			method: "POST",
			body: n
		});
		if (!r.ok) return {
			valid: !1,
			error: "network"
		};
		let i = await r.json();
		return i.success ? i.purchase?.refunded || i.purchase?.chargebacked ? {
			valid: !1,
			error: "refunded"
		} : {
			valid: !0,
			email: i.purchase?.email
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
chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({
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
			id: "getsvg-highlight",
			title: "Highlight all SVGs",
			contexts: ["all"]
		});
	}), chrome.alarms.create("pro-reverify", { periodInMinutes: 1440 * 7 });
}), chrome.alarms.onAlarm.addListener(async (e) => {
	if (e.name !== "pro-reverify") return;
	let n = await chrome.storage.sync.get(["proKey", "proVerified"]);
	if (!n.proKey || !n.proVerified) return;
	let r = await t(n.proKey);
	!r.valid && r.error !== "network" && await chrome.storage.sync.remove([
		"proKey",
		"proVerified",
		"proEmail"
	]);
});
var n = /* @__PURE__ */ new Map();
function r(e) {
	chrome.contextMenus.update("getsvg-highlight", { title: e ? "Hide Highlights" : "Highlight all SVGs" });
}
chrome.tabs.onActivated.addListener(({ tabId: e }) => {
	r(n.get(e) ?? !1);
}), chrome.tabs.onRemoved.addListener((e) => {
	n.delete(e);
});
async function i(e, t) {
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
		let e = (await i(t.id, { action: "toggle-highlight" }))?.active ?? !1;
		n.set(t.id, e), r(e);
		return;
	}
	let o = e.menuItemId === "getsvg-copy" ? "copy-svg" : "download-svg", s = await i(t.id, { action: o });
	if (!s?.success) {
		console.warn("GetSVG: could not extract SVG —", s?.error);
		return;
	}
	o === "download-svg" && s.svg && a(s.svg, s.filename);
}), chrome.runtime.onMessage.addListener((e, t, n) => {
	if (e.action === "save-svg" && e.svg && (a(e.svg, e.filename), n({ success: !0 })), e.action === "set-context") {
		let t = !!e.hasSVG;
		chrome.contextMenus.update("getsvg-copy", { enabled: t }), chrome.contextMenus.update("getsvg-download", { enabled: t }), n({ success: !0 });
	}
	return !0;
});
function a(e, t = "image.svg") {
	let n = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(e);
	chrome.downloads.download({
		url: n,
		filename: t,
		saveAs: !1
	});
}
//#endregion
