# Account Price

Shows your Steam account value directly on your profile page and your friends' profiles in the Steam client. Calculates the total value of all owned games based on current Steam Store prices.

## What it does

- Account value displayed on profile pages (yours and friends')
- Total games, total playtime, average price per game
- "Show Details" button for full breakdown: top 10 most expensive games, most played, cost per hour, paid vs free split
- Prices cached locally so it doesn't re-fetch every time
- Works with any Millennium theme

## Setup

1. Install [Millennium](https://steambrew.app/)
2. Drop this plugin in your plugins folder or install via the plugin browser
3. Get a free Steam Web API key from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
4. Open plugin settings, paste your API key and your 64-bit Steam ID
5. Go to any profile page

## How it works

The plugin uses the Steam Web API to fetch your owned games list, then looks up each game's current price on the Steam Store. Prices are fetched gradually (rate limited to ~40 games/minute) and cached locally. On your next visit, the cached total shows instantly.

## Project Structure

```
Price-Account-Steam/
  plugin.json             Millennium manifest
  package.json            Dependencies
  backend/
    main.lua              Steam API calls, settings, price cache
  frontend/
    index.tsx             Profile widget + settings panel
```

## Credits

- Idea by [Thomas Bortolato](https://github.com/thomas370)
- Developed by [Mathis Boulais](https://github.com/MathisBls/)
- Built on [Millennium](https://steambrew.app/)

## License

MIT
