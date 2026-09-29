local millennium = require("millennium")

---@ffi
---@param lang string
---@return table
function read_locale(lang)
	return millennium.assets.read("locales/" .. lang .. ".json")
end

local function on_load()
	millennium.ready()
end

return {
	on_load = on_load,
}
