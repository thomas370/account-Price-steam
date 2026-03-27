local http = require("http")
local json = require("json")
local log = require("logger")
local mill = require("millennium")

local STEAM_API = "https://api.steampowered.com"
local STORE_API = "https://store.steampowered.com/api"

local function settings_path()
    return mill.get_install_path() .. "/settings.json"
end

local function cache_path()
    return mill.get_install_path() .. "/prices_cache.json"
end

local function read_file(path)
    local f = io.open(path, "r")
    if not f then return nil end
    local s = f:read("*a")
    f:close()
    return s
end

local function write_file(path, data)
    local f = io.open(path, "w")
    if not f then return false end
    f:write(data)
    f:close()
    return true
end

function get_settings()
    local s = read_file(settings_path())
    if not s then return json.encode({ steam_api_key = "", steam_id = "" }) end
    return s
end

function save_settings(steam_api_key)
    local data = { steam_api_key = steam_api_key or "" }
    write_file(settings_path(), json.encode(data))
    return json.encode({ success = true })
end

local function get_api_key()
    local s = read_file(settings_path())
    if not s then return nil end
    local cfg = json.decode(s)
    return cfg.steam_api_key
end

function fetch_account_data(steam_id)
    local key = get_api_key()
    if not key then return json.encode({ error = "no api key" }) end
    local url = STEAM_API .. "/IPlayerService/GetOwnedGames/v1/?key=" .. key
        .. "&steamid=" .. steam_id .. "&include_appinfo=true&include_played_free_games=false&format=json"
    local r = http.get(url, { timeout = 10 })
    if r.status ~= 200 then return json.encode({ error = r.status }) end
    return r.body
end

function fetch_game_price(app_id)
    local url = STORE_API .. "/appdetails?appids=" .. tostring(app_id) .. "&filters=price_overview"
    local r = http.get(url, { timeout = 10 })
    if r.status ~= 200 then return json.encode({ error = r.status }) end
    return r.body
end

function fetch_bulk_prices(ids_json)
    local ids = json.decode(ids_json)
    local parts = {}
    for _, id in ipairs(ids) do
        table.insert(parts, '{"appid":' .. tostring(id) .. '}')
    end
    local input = '{"ids":[' .. table.concat(parts, ",") .. '],"context":{"country_code":"US","language":"english"},"data_request":{"include_all_purchase_options":true}}'
    local url = STEAM_API .. "/IStoreBrowseService/GetItems/v1/?input_json=" .. input
    local r = http.get(url, { timeout = 15 })
    if r.status ~= 200 then return json.encode({ error = r.status }) end
    return r.body
end

function get_price_cache()
    local s = read_file(cache_path())
    if not s then return json.encode({}) end
    return s
end

function save_price_cache(cache_json)
    write_file(cache_path(), cache_json)
    return cache_json
end

function resolve_vanity(vanity)
    local key = get_api_key()
    if not key then return json.encode({ error = "no api key" }) end
    local url = STEAM_API .. "/ISteamUser/ResolveVanityURL/v1/?key=" .. key .. "&vanityurl=" .. vanity
    local r = http.get(url, { timeout = 10 })
    if r.status ~= 200 then return json.encode({ error = r.status }) end
    return r.body
end

function fetch_player_summary(steam_id)
    local key = get_api_key()
    if not key then return json.encode({ error = "no api key" }) end
    local url = STEAM_API .. "/ISteamUser/GetPlayerSummaries/v2/?key=" .. key .. "&steamids=" .. steam_id
    local r = http.get(url, { timeout = 10 })
    if r.status ~= 200 then return json.encode({ error = r.status }) end
    return r.body
end

local function on_load()
    log:info("Price-Account-Steam loaded")
    mill.ready()
end

local function on_unload()
    log:info("Price-Account-Steam unloaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
    get_settings = get_settings,
    save_settings = save_settings,
    fetch_account_data = fetch_account_data,
    fetch_game_price = fetch_game_price,
    fetch_bulk_prices = fetch_bulk_prices,
    get_price_cache = get_price_cache,
    save_price_cache = save_price_cache,
    resolve_vanity = resolve_vanity,
    fetch_player_summary = fetch_player_summary,
}
