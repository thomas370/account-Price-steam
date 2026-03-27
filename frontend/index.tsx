import { Millennium, IconsModule, definePlugin, callable } from '@steambrew/client';

const getSettings = callable<[], string>('get_settings');
const saveSettings = callable<[{ steam_api_key: string }], string>('save_settings');
const fetchAccountData = callable<[{ steam_id: string }], string>('fetch_account_data');

let observer: MutationObserver | null = null;
let calculating = false;
let lastProfileId: string | null = null;

const WID = 'pas-widget';

const openExt = (url: string) => window.open(`steam://openurl_external/${url}`);

function readColors() {
	const c = { bg: 'rgba(14,20,27,0.9)', text: '#fff', dim: 'rgba(255,255,255,0.6)', accent: '#1a9fff', border: 'rgba(255,255,255,0.1)' };
	try {
		const s = getComputedStyle(document.body);
		const bg = s.backgroundColor;
		if (bg && bg !== 'rgba(0, 0, 0, 0)') {
			const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
			if (m) c.bg = `rgba(${m[1]},${m[2]},${m[3]},0.92)`;
		}
		const fg = s.color;
		if (fg && fg !== 'rgba(0, 0, 0, 0)') {
			c.text = fg;
			const m = fg.match(/(\d+),\s*(\d+),\s*(\d+)/);
			if (m) { c.dim = `rgba(${m[1]},${m[2]},${m[3]},0.6)`; c.border = `rgba(${m[1]},${m[2]},${m[3]},0.12)`; }
		}
	} catch {}
	return c;
}

const CSS = `
#${WID} { margin:16px 0; border-radius:6px; overflow:hidden; }
.pas-card { background:var(--pas-bg); backdrop-filter:blur(12px); padding:16px 20px; }
.pas-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.pas-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--pas-dim); }
.pas-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.pas-stat { text-align:center; }
.pas-val { font-size:22px; font-weight:700; color:var(--pas-accent); }
.pas-lbl { font-size:10px; color:var(--pas-dim); text-transform:uppercase; letter-spacing:.5px; margin-top:2px; }
.pas-progress { font-size:11px; color:var(--pas-dim); margin-top:10px; text-align:center; }
.pas-msg { font-size:12px; color:var(--pas-dim); padding:4px 0; }
`;

function fmtPrice(cents: number): string {
	if (cents <= 0) return '$0.00';
	return '$' + (cents / 100).toFixed(2);
}

function fmtHours(mins: number): string {
	const h = Math.round(mins / 60);
	return h.toLocaleString() + 'h';
}

function isProfilePage(): boolean {
	try {
		const p = (window as any).MainWindowBrowserManager?.m_lastLocation?.pathname || '';
		if (p.includes('/friends/') || p.includes('/miniprofile/')) return true;

		const sels = [
			'.profile_header_bg_texture', '.ProfileHeader', '.profile_page',
			'.friendsProfileSectionHeader', '.ProfileActivityPage', '.ProfileStatus',
			'[class*="profilepage"]', '[class*="ProfilePage"]', '[class*="profile_"]',
			'[class*="FriendsProfile"]', '[class*="friendsprofile"]',
			'[class*="yourprofile"]', '[class*="YourProfile"]',
			'[class*="ownprofile"]', '[class*="myprofile"]',
		];
		for (const sel of sels) {
			if (document.querySelector(sel)) return true;
		}

		const all = document.querySelectorAll('[class]');
		for (let i = 0; i < all.length; i++) {
			const cl = all[i].className;
			if (typeof cl === 'string' && /profile/i.test(cl)) return true;
		}
	} catch {}
	return false;
}

function findContainer(): HTMLElement | null {
	const sels = [
		'.profile_header_bg_texture', '.ProfileHeader', '.profile_page',
		'.friendsProfileSectionHeader', '.ProfileActivityPage',
		'[class*="profilepage"]', '[class*="ProfilePage"]', '[class*="profile_"]',
		'[class*="FriendsProfile"]', '[class*="friendsprofile"]',
		'[class*="yourprofile"]', '[class*="YourProfile"]',
	];
	for (const s of sels) {
		const el = document.querySelector(s) as HTMLElement;
		if (el) return el;
	}
	const all = document.querySelectorAll('[class]');
	for (let i = 0; i < all.length; i++) {
		const cl = all[i].className;
		if (typeof cl === 'string' && /profile/i.test(cl)) return all[i] as HTMLElement;
	}
	return null;
}

function renderWidget(container: HTMLElement, data: { total: number; count: number; hours: number; avg: number; progress?: string }) {
	let w = document.getElementById(WID);
	if (!w) {
		w = document.createElement('div');
		w.id = WID;
		const colors = readColors();
		w.style.setProperty('--pas-bg', colors.bg);
		w.style.setProperty('--pas-text', colors.text);
		w.style.setProperty('--pas-dim', colors.dim);
		w.style.setProperty('--pas-accent', colors.accent);
		w.style.setProperty('--pas-border', colors.border);
		container.insertBefore(w, container.firstChild);
	}

	let html = `<div class="pas-card"><div class="pas-hdr"><span class="pas-title">Account Value</span></div>`;
	html += `<div class="pas-grid">`;
	html += `<div class="pas-stat"><div class="pas-val">${fmtPrice(data.total)}</div><div class="pas-lbl">Total Value</div></div>`;
	html += `<div class="pas-stat"><div class="pas-val">${data.count}</div><div class="pas-lbl">Games</div></div>`;
	html += `<div class="pas-stat"><div class="pas-val">${fmtHours(data.hours)}</div><div class="pas-lbl">Playtime</div></div>`;
	html += `<div class="pas-stat"><div class="pas-val">${fmtPrice(data.avg)}</div><div class="pas-lbl">Avg Price</div></div>`;
	html += `</div>`;
	if (data.progress) html += `<div class="pas-progress">${data.progress}</div>`;
	html += `</div>`;
	w.innerHTML = html;
}

async function calculate(steamId: string) {
	if (calculating) return;
	calculating = true;

	const container = findContainer();
	if (!container) { calculating = false; return; }

	renderWidget(container, { total: 0, count: 0, hours: 0, avg: 0, progress: 'Loading game list...' });

	try {
		const acctRaw = await fetchAccountData({ steam_id: steamId });
		const acct = JSON.parse(acctRaw);
		const games = acct?.response?.games || [];
		if (!games.length) {
			renderWidget(container, { total: 0, count: 0, hours: 0, avg: 0, progress: 'No games found' });
			calculating = false;
			return;
		}

		const totalHours = games.reduce((s: number, g: any) => s + (g.playtime_forever || 0), 0);
		renderWidget(container, { total: 0, count: games.length, hours: totalHours, avg: 0 });
	} catch {
		const el = document.getElementById(WID);
		if (el) el.innerHTML = `<div class="pas-card"><div class="pas-msg">Failed to load account data</div></div>`;
	}

	calculating = false;
}

async function handlePage() {
	if (!isProfilePage()) {
		document.getElementById(WID)?.remove();
		lastProfileId = null;
		return;
	}

	let settings: any;
	try { settings = JSON.parse(await getSettings()); } catch { return; }
	if (!settings?.steam_api_key || !settings?.steam_id) return;

	if (lastProfileId === settings.steam_id && document.getElementById(WID)) return;
	lastProfileId = settings.steam_id;
	calculate(settings.steam_id);
}

function setup(doc: Document) {
	if (observer) { observer.disconnect(); observer = null; }
	lastProfileId = null;

	if (!doc.getElementById('pas-styles')) {
		const s = doc.createElement('style');
		s.id = 'pas-styles';
		s.textContent = CSS;
		doc.head.appendChild(s);
	}

	handlePage();
	observer = new MutationObserver(() => handlePage());
	if (doc.body) observer.observe(doc.body, { childList: true, subtree: true });
}

function Settings() {
	const R = window.SP_REACT;
	const [apiKey, setApiKey] = R.useState('');
	const [status, setStatus] = R.useState('');
	const [loaded, setLoaded] = R.useState(false);

	R.useEffect(() => {
		getSettings().then((raw: string) => {
			try {
				const s = JSON.parse(raw);
				if (s.steam_api_key) setApiKey(s.steam_api_key);
			} catch {}
			setLoaded(true);
		}).catch(() => setLoaded(true));
	}, []);

	const save = async () => {
		setStatus('Saving...');
		try {
			const r = JSON.parse(await saveSettings({ steam_api_key: apiKey.trim() }));
			lastProfileId = null;
			setStatus(r.success ? 'Saved!' : 'Failed');
		} catch { setStatus('Error'); }
		setTimeout(() => setStatus(''), 3000);
	};

	const inputStyle = {
		width: '100%', padding: '8px 12px', fontSize: 13,
		background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
		borderRadius: 4, color: '#fff', outline: 'none', boxSizing: 'border-box' as const,
		marginBottom: 4,
	};

	if (!loaded) return R.createElement('div', { style: { padding: 16, color: '#c6d4df' } }, 'Loading...');

	return R.createElement('div', { style: { padding: 16, color: '#c6d4df' } },
		R.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 } }, 'Account Value'),
		R.createElement('div', { style: { marginBottom: 12 } },
			R.createElement('label', { style: { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 } }, 'Steam Web API Key'),
			R.createElement('input', { type: 'password', value: apiKey, onChange: (e: any) => setApiKey(e.target.value), placeholder: 'Your Steam API key', style: inputStyle }),
			R.createElement('div', { style: { fontSize: 10, color: '#8f98a0' } },
				'Free from ',
				R.createElement('span', {
					style: { color: '#1a9fff', cursor: 'pointer', textDecoration: 'underline' },
					onClick: () => openExt('https://steamcommunity.com/dev/apikey'),
				}, 'steamcommunity.com/dev/apikey'),
			),
		),
		R.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
			R.createElement('button', {
				onClick: save,
				style: { padding: '8px 20px', fontSize: 12, fontWeight: 600, background: '#1a9fff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
			}, 'Save'),
		),
		status && R.createElement('div', {
			style: {
				fontSize: 12, marginBottom: 12, padding: '6px 10px', borderRadius: 4,
				background: status === 'Saved!' ? 'rgba(36,166,90,0.15)' : 'rgba(240,74,74,0.15)',
				color: status === 'Saved!' ? '#24a65a' : '#f04a4a',
			},
		}, status),
		R.createElement('div', { style: { background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: 12, fontSize: 11, color: '#8f98a0', lineHeight: 1.5 } },
			R.createElement('div', { style: { fontWeight: 600, color: '#c6d4df', marginBottom: 4 } }, 'Setup:'),
			R.createElement('div', null, '1. Get a free API key from the link above'),
			R.createElement('div', null, '2. Save and go to any profile page'),
			R.createElement('div', null, '3. Steam ID is auto-detected from URL'),
		),
	);
}

export default definePlugin(() => {
	Millennium.AddWindowCreateHook?.((ctx: any) => {
		if (!ctx?.m_strName?.startsWith('SP ')) return;
		const doc = ctx.m_popup?.document;
		if (!doc?.body) return;
		setup(doc);
	});

	return {
		title: 'Account Value',
		icon: window.SP_REACT.createElement(IconsModule.Settings, null),
		content: window.SP_REACT.createElement(Settings, null),
	};
});

declare global { interface Window { SP_REACT: any; MainWindowBrowserManager: any; } }
