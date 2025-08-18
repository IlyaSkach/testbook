-- Превращаем абзацы, начинающиеся на "ГЛАВА" в заголовки H2

local utils = require 'pandoc.utils'

function Para(el)
  local text = utils.stringify(el):gsub("^%s+", "")
  if text:match("^[Гг][Лл][Аа][Вв][Аа][%s%p]") then
    return pandoc.Header(2, text)
  end
  return nil
end
