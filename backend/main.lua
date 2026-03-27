local logger = require("logger")
local millennium = require("millennium")

function test_frontend_message_callback(message, status, count)
    logger:info("test_frontend_message_callback called")
    logger:info("message: " .. message)
    return 1337
end

local function on_load()
    logger:info("Plugin loaded")
    millennium.ready()
end

local function on_unload()
    logger:info("Plugin unloaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
    test_frontend_message_callback = test_frontend_message_callback,
}
