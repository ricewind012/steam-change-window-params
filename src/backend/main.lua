local logger = require("logger")
local millennium = require("millennium")

function test_frontend_message_callback(message, status, count)
	logger:info("test_frontend_message_callback called")
	logger:info("Received args: " .. table.concat({ message, tostring(status), tostring(count) }, ", "))

	return true
end

local function on_load()
	logger:info("Comparing millennium version: " .. millennium.version())

	-- We are running a Millennium version > 2.29.3
	local target_version = "2.29.3"
	if millennium.cmp_version(millennium.version(), target_version) == 1 then
		logger:info("Running Millennium > " .. target_version)
	end

	logger:info("Example plugin loaded with Millennium version " .. millennium.version())

	-- Set a default greeting if one doesn't exist yet
	local greeting = millennium.config.get("greeting")
	if greeting == nil then
		millennium.config.set("greeting", "Hello from Lua!")
		logger:info("Set default greeting")
	else
		logger:info("Current greeting: " .. tostring(greeting))
	end

	-- Listen for config changes (from frontend, MEP, or anywhere)
	millennium.config.on_change(function(key, value)
		logger:info("hello wtf")
		--logger:info("Config changed: " .. key .. " = " .. tostring(value))
	end)

	millennium.ready()
end

-- Called when your plugin is unloaded. This happens when the plugin is disabled or Steam is shutting down.
-- NOTE: If Steam crashes or is force closed by task manager, this function may not be called -- so don't rely on it for critical cleanup.
local function on_unload()
	logger:info("Plugin unloaded")
end

-- Called when the Steam UI has fully loaded.
local function on_frontend_loaded()
	logger:info("Frontend loaded")
end

return {
	on_frontend_loaded = on_frontend_loaded,
	on_load = on_load,
	on_unload = on_unload,
}
