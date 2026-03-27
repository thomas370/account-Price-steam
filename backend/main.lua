local http = require("http")
local json = require("json")
local log = require("logger")
local mill = require("millennium")

local STEAM_API = "https://api.steampowered.com"

local function settings_path()
    return mill.get_install_path() .. "/settings.json"
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
}
