import { Millennium, IconsModule, definePlugin, callable } from '@steambrew/client';

const getSettings = callable<[], string>('get_settings');
const saveSettings = callable<[{ steam_api_key: string }], string>('save_settings');

const openExt = (url: string) => window.open(`steam://openurl_external/${url}`);

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
			R.createElement('div', null, '4. Click "Show Details" for full breakdown'),
		),
	);
}

export default definePlugin(() => {
	return {
		title: 'Account Value',
		icon: window.SP_REACT.createElement(IconsModule.Settings, null),
		content: window.SP_REACT.createElement(Settings, null),
	};
});

declare global { interface Window { SP_REACT: any; MainWindowBrowserManager: any; } }
