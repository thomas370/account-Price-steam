import { callable } from '@steambrew/webkit';

const getSettings = callable<[], string>('get_settings');
const fetchAccountData = callable<[{ steam_id: string }], string>('fetch_account_data');
const fetchBulkPrices = callable<[{ ids_json: string }], string>('fetch_bulk_prices');
const getPriceCache = callable<[], string>('get_price_cache');
const savePriceCache = callable<[{ cache_json: string }], string>('save_price_cache');
const resolveVanity = callable<[{ vanity: string }], string>('resolve_vanity');

const WID = 'pas-store-widget';

function fmtPrice(cents: number): string {
	if (cents <= 0) return '$0.00';
	return '$' + (cents / 100).toFixed(2);
}
function fmtHours(mins: number): string {
	return Math.round(mins / 60).toLocaleString() + 'h';
}

const SVG_TAG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67c1f5" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';

let expanded = false;
let gameList: any[] = [];
let prices: Record<string, number> = {};

function injectStyles() {
	if (document.getElementById('pas-css')) return;
	const el = document.createElement('style');
	el.id = 'pas-css';
	el.textContent = `
#${WID} { background:rgba(0,0,0,.2); margin-bottom:12px; border-radius:2px; overflow:hidden; }
.pas-hdr { display:flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(102,192,244,.06); border-bottom:1px solid rgba(255,255,255,.06); }
.pas-htitle { color:#67c1f5; font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; }
.pas-badge { margin-left:auto; font-size:9px; color:#556772; }
.pas-body { padding:12px 14px; }
.pas-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.pas-stat { text-align:center; padding:6px; background:rgba(255,255,255,.03); border-radius:3px; }
.pas-val { font-size:18px; font-weight:700; color:#67c1f5; }
.pas-lbl { font-size:9px; color:#8f98a0; text-transform:uppercase; letter-spacing:.5px; margin-top:2px; }
.pas-progress { font-size:11px; color:#556772; text-align:center; padding:8px 14px; }
.pas-msg { font-size:12px; color:#556772; padding:8px 14px; }
.pas-msg a { color:#67c1f5; }
.pas-toggle { display:block; width:100%; background:none; border:none; border-top:1px solid rgba(255,255,255,.04); color:#67c1f5; font-size:11px; padding:8px; cursor:pointer; }
.pas-toggle:hover { color:#fff; background:rgba(255,255,255,.03); }
.pas-details { padding:0 14px 12px; }
.pas-sec { margin-bottom:10px; }
.pas-sec-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#556772; margin-bottom:6px; }
.pas-row { display:flex; align-items:center; justify-content:space-between; padding:3px 0; border-bottom:1px solid rgba(255,255,255,.03); font-size:11px; }
.pas-row-name { color:#c6d4df; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px; }
.pas-row-meta { color:#556772; margin-right:8px; }
.pas-row-price { color:#67c1f5; font-weight:600; min-width:50px; text-align:right; }
`;
	document.head.appendChild(el);
}

function buildDetails(): string {
	if (!gameList.length) return '';
	const byPrice = gameList.map(g => ({ name: g.name || `App ${g.appid}`, price: prices[String(g.appid)] || 0, hours: g.playtime_forever || 0 })).filter(g => g.price > 0).sort((a, b) => b.price - a.price);
	const byHours = [...gameList].filter(g => g.playtime_forever > 0).sort((a: any, b: any) => b.playtime_forever - a.playtime_forever).slice(0, 10);
	const free = gameList.filter(g => !prices[String(g.appid)]).length;
	const paid = gameList.length - free;
	const totalMins = gameList.reduce((s: number, g: any) => s + (g.playtime_forever || 0), 0);
	const totalVal = Object.values(prices).reduce((s, v) => s + v, 0);

	let html = '<div class="pas-details">';
	html += '<div class="pas-sec"><div class="pas-sec-title">Most Expensive</div>';
	byPrice.slice(0, 10).forEach(g => { html += `<div class="pas-row"><span class="pas-row-name">${g.name}</span><span class="pas-row-price">${fmtPrice(g.price)}</span></div>`; });
	html += '</div>';
	html += '<div class="pas-sec"><div class="pas-sec-title">Most Played</div>';
	byHours.forEach((g: any) => { html += `<div class="pas-row"><span class="pas-row-name">${g.name || g.appid}</span><span class="pas-row-meta">${fmtHours(g.playtime_forever)}</span><span class="pas-row-price">${prices[String(g.appid)] ? fmtPrice(prices[String(g.appid)]) : 'Free'}</span></div>`; });
	html += '</div>';
	html += '<div class="pas-sec"><div class="pas-sec-title">Breakdown</div>';
	html += `<div class="pas-row"><span class="pas-row-name">Paid</span><span class="pas-row-price">${paid}</span></div>`;
	html += `<div class="pas-row"><span class="pas-row-name">Free</span><span class="pas-row-price">${free}</span></div>`;
	if (totalMins > 0 && totalVal > 0) html += `<div class="pas-row"><span class="pas-row-name">Cost/hour</span><span class="pas-row-price">${fmtPrice(Math.round(totalVal / (totalMins / 60)))}</span></div>`;
	html += '</div></div>';
	return html;
}

function render(target: Element, data: { total: number; count: number; hours: number; avg: number; progress?: string }) {
	let w = document.getElementById(WID);
	if (!w) { w = document.createElement('div'); w.id = WID; target.insertBefore(w, target.firstChild); }

	let html = `<div class="pas-hdr">${SVG_TAG}<span class="pas-htitle">Account Value</span><span class="pas-badge">Steam API</span></div>`;
	html += `<div class="pas-body"><div class="pas-grid">`;
	html += `<div class="pas-stat"><div class="pas-val">${fmtPrice(data.total)}</div><div class="pas-lbl">Total Value</div></div>`;
	html += `<div class="pas-stat"><div class="pas-val">${data.count}</div><div class="pas-lbl">Games</div></div>`;
	html += `<div class="pas-stat"><div class="pas-val">${fmtHours(data.hours)}</div><div class="pas-lbl">Playtime</div></div>`;
	html += `<div class="pas-stat"><div class="pas-val">${fmtPrice(data.avg)}</div><div class="pas-lbl">Avg Price</div></div>`;
	html += `</div></div>`;
	if (data.progress) html += `<div class="pas-progress">${data.progress}</div>`;
	if (!data.progress && gameList.length) {
		html += `<button class="pas-toggle" id="pas-det-btn">${expanded ? 'Hide Details' : 'Show Details'}</button>`;
		if (expanded) html += buildDetails();
	}
	w.innerHTML = html;

	const btn = document.getElementById('pas-det-btn');
	if (btn) btn.addEventListener('click', () => { expanded = !expanded; render(target, data); });
}

async function run(steamId: string, target: Element) {
	document.getElementById(WID)?.remove();
	expanded = false;

	const ph = document.createElement('div');
	ph.id = WID;
	ph.innerHTML = `<div class="pas-hdr">${SVG_TAG}<span class="pas-htitle">Account Value</span></div><div class="pas-progress">Loading...</div>`;
	target.insertBefore(ph, target.firstChild);

	try {
		const acct = JSON.parse(await fetchAccountData({ steam_id: steamId }));
		const games = acct?.response?.games || [];
		if (!games.length) {
			const el = document.getElementById(WID);
			if (el) el.innerHTML = `<div class="pas-hdr">${SVG_TAG}<span class="pas-htitle">Account Value</span></div><div class="pas-msg">No games found (profile may be private)</div>`;
			return;
		}

		gameList = games;
		const totalHours = games.reduce((s: number, g: any) => s + (g.playtime_forever || 0), 0);
		let cache: Record<string, number> = {};
		try { cache = JSON.parse(await getPriceCache()) || {}; } catch {}
		prices = cache;

		let total = 0;
		const uncached: number[] = [];
		for (const g of games) { const id = String(g.appid); if (id in cache) total += cache[id]; else uncached.push(g.appid); }

		render(target, { total, count: games.length, hours: totalHours, avg: games.length ? Math.round(total / games.length) : 0, progress: uncached.length ? `Fetching prices... 0/${uncached.length}` : undefined });

		const BATCH = 50;
		for (let i = 0; i < uncached.length; i += BATCH) {
			const batch = uncached.slice(i, i + BATCH);
			try {
				const raw = await fetchBulkPrices({ ids_json: JSON.stringify(batch) });
				const resp = JSON.parse(raw);
				const items = resp?.response?.store_items || [];
				for (const item of items) {
					const id = String(item.appid || item.id);
					let price = 0;
					if (!item.is_free) {
						const opts = item.best_purchase_option || (Array.isArray(item.purchase_options) ? item.purchase_options[0] : null);
						if (opts?.final_price_in_cents) price = parseInt(String(opts.final_price_in_cents), 10) || 0;
					}
					cache[id] = price; prices[id] = price; total += price;
				}
				for (const bid of batch) { if (!(String(bid) in cache)) { cache[String(bid)] = 0; prices[String(bid)] = 0; } }
			} catch {}

			render(target, { total, count: games.length, hours: totalHours, avg: Math.round(total / games.length), progress: `Fetching prices... ${Math.min(i + BATCH, uncached.length)}/${uncached.length}` });
		}

		try { await savePriceCache({ cache_json: JSON.stringify(cache) }); } catch {}
		render(target, { total, count: games.length, hours: totalHours, avg: Math.round(total / games.length) });
	} catch {
		const el = document.getElementById(WID);
		if (el) el.innerHTML = `<div class="pas-hdr">${SVG_TAG}<span class="pas-htitle">Account Value</span></div><div class="pas-msg">Failed to load</div>`;
	}
}

async function extractSteamId(): Promise<string | null> {
	const m = window.location.href.match(/steamcommunity\.com\/(id|profiles)\/([^\/\?]+)/);
	if (!m) return null;

	if (m[1] === 'profiles' && /^\d{17}$/.test(m[2])) return m[2];

	try {
		const raw = await resolveVanity({ vanity: m[2] });
		const r = JSON.parse(raw);
		if (r?.response?.success === 1 && r.response.steamid) return r.response.steamid;
	} catch {}
	return null;
}

export default async function WebkitMain() {
	if (!window.location.href.match(/steamcommunity\.com\/(id|profiles)\//)) return;

	let settings: any;
	try { settings = JSON.parse(await getSettings()); } catch { return; }

	const target = document.querySelector('.profile_rightcol') || document.querySelector('.profile_item_links')?.parentElement || document.querySelector('.responsive_page_template_content');
	if (!target) return;

	if (!settings?.steam_api_key) {
		injectStyles();
		const w = document.createElement('div'); w.id = WID;
		w.innerHTML = `<div class="pas-hdr">${SVG_TAG}<span class="pas-htitle">Account Value</span></div><div class="pas-msg">Set your API key in plugin settings</div>`;
		target.insertBefore(w, target.firstChild);
		return;
	}

	const steamId = await extractSteamId();
	if (!steamId) return;

	injectStyles();
	await run(steamId, target);
}
