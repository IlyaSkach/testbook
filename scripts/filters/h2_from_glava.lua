-- Превращаем абзацы, начинающиеся на "ГЛАВА" в заголовки H2

local utils = require 'pandoc.utils'

function Para(el)
  local text = utils.stringify(el):gsub("^%s+", "")
  if text:match("^[Гг][Лл][Аа][Вв][Аа][%s%p]") then
    return pandoc.Header(2, text)
  end
  if text:match("^[Пп][Рр][Оо][Лл][Оо][Гг][%s%p]") then
    return pandoc.Header(2, text)
  end
  if text:match("^[Ээ][Пп][Ии][Лл][Оо][Гг][%s%p]") then
    return pandoc.Header(2, text)
  end
  -- Некоторые экспорты Pages помечают заголовки как "Рубрика 2"
  if text:match("[Рр][Уу][Бб][Рр][Ии][Кк][Аа]%s*2") then
    return pandoc.Header(2, text)
  end
  if text:match("^[Пп][Рр][Оо][Лл][Оо][Гг][%s%p]") then
    return pandoc.Header(2, text)
  end
  if text:match("^[Ээ][Пп][Ии][Лл][Оо][Гг][%s%p]") then
    return pandoc.Header(2, text)
  end
  return nil
end
