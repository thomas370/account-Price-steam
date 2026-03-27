import { callable } from '@steambrew/webkit';

const getSettings = callable<[], string>('get_settings');
const resolveVanity = callable<[{ vanity: string }], string>('resolve_vanity');

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
	if (!settings?.steam_api_key) return;

	const steamId = await extractSteamId();
	if (!steamId) return;

	console.log('[PAS] steam id:', steamId);
}
