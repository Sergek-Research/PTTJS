/**
 * @typedef {Object} CellAddress
 * @property {string|null} page Id страницы
 * @property {string} x Индекс по X
 * @property {string} y Индекс по Y
 * @property {boolean|null} xTE X до конца строки
 * @property {boolean|null} yTE Y до конца столбца
 * Объект адреса ячейки
 */

/**
 * Сериализует адрес ячейки
 * @param {CellAddress} cellAddress Адрес ячейки
 * @returns {string} Результат - подстрока
 */
function serializeCellAddress({ page, x, y, xTE, yTE }) {
  return `${page ? `${page}|` : ''}${xTE ? `${x}:${x}|` : `${x}|`}${yTE ? `${y}:${y}` : `${y}`}`;
}

/**
 * @typedef {Object} ScriptAddress
 * @property {string|null} page Id страницы
 * @property {CellAddress} cellStart Индекс по X
 * @property {CellAddress|null} cellEnd Индекс по Y
 * Объект адреса скрипта
 */

/**
 * Сериализует адрес скрипта
 * @param {ScriptAddress} scriptAddress Адрес скрипта
 * @returns {string} Результат - подстрока
 */
function serializeScriptAddress({ page, cellStart, cellEnd }) {
  return `${page ? `${page},` : ''}${serializeCellAddress(cellStart)}${cellEnd ? `,${serializeCellAddress(cellEnd)}` : ''}`;
}

/**
 * @typedef {Array} FunctionCallArray
 * @property {string} Первый элемент всегда строка
 * @property {(FunctionCallArray)[]}
 */

/**
 * Сериализует массив вызова функций
 * @param {FunctionCallArray} functionCallArray Массив вызова функций
 * @returns {string} Результат - подстрока
 */
function serializeFunctionCallArray(functionCallArray) {
  let funcName = '';
  const result = functionCallArray.reduce((prev, el, i) => {
    if (i === 0) {
      funcName = el;
      return prev;
    }
    if (Array.isArray(el)) {
      prev.push(serializeFunctionCallArray(el));
      return prev;
    }
    if (typeof el === 'object' && el?.x && el?.y) {
      prev.push(serializeCellAddress(el));
    } else {
      prev.push(el);
    }
    return prev;
  }, []);

  return `${funcName}(${result.join(',')})`;
}

/**
 * @typedef {Array} ScriptArray
 * @property {ScriptAddress} Первый элемент всегда адрес
 * @property {FunctionCallArray}
 */

/**
 * Сериализует массив скриптов
 * @param {ScriptArray[]} scriptArray Массив вызова функций
 * @param {string} divider Разделитель адреса
 * @returns {string[]} Результат - массив строк
 */
function serializeScriptArray(scriptArray, divider = '=') {
  const result = [];
  scriptArray.forEach((el) => {
    if (el.length === 2) {
      result.push(`(${serializeScriptAddress(el[0])})${divider}${serializeFunctionCallArray(el[1])}`);
    }
  });
  return result;
}

/**
 * @typedef {Object} CellItem
 * @property {boolean} isHeader Является ли заголовком
 * @property {number} index Индекс ячейки по X
 * @property {[number, number]} scale Масштаб в формате [x, y]
 * @property {string} id Идентификатор элемента
 * @property {string} value Содержимое
 * Объект ячейки
 */

/**
 * Заменяет специальные символы в значении
 * @param {string} value Исходная строка
 * @returns {string} Строка с экранированными символами
 */
export function escapeValue(value) {
  let escaped = value;
  // 1. Проверка типа входного значения
  if (typeof value !== 'string') {
    // Попытка преобразовать в строку или вернуть как есть/выбросить ошибку,
    // в зависимости от требований.
    escaped = String(value);
  }

  // 2. Карта символов для экранирования и их замен
  const escapeMap = {
    '\n': '%5Cn', // Новая строка -> %5Cn (URL-кодирование)
    '|': '%7C', // Вертикальная черта -> %7C (URL-кодирование)
    '>': '%3E', // > -> %3E (URL-кодирование)
    '<': '%3C', // < -> %3C (URL-кодирование)
    '{': '%7B', // { -> %7B (URL-кодирование)
    '}': '%7D', // } -> %7D (URL-кодирование)
  };

  // 3. Регулярное выражение для поиска всех символов, требующих экранирования.
  // Внутри символьного класса [] большинство метасимволов (включая |, {, })
  // не требуют дополнительного экранирования.
  const regex = /[\n|><{}]/g;

  // 4. Один вызов replace с функцией замены
  return value.replace(regex, (match) => escapeMap[match]);
}

/**
 * Сериализует ячейку
 * @param {CellItem} cellItem Ячейка
 * @param {boolean} showIndex Показывать индексы
 * @param {number} indexY Индекс ячейки по Y
 * @returns {string} Результат - подстрока
 */
function serializeCellItem({ isHeader, index: indexX, scale, id, value }, showIndex, indexY) {
  const hasScale = Array.isArray(scale) && scale.length === 2;
  const hasBrackets = showIndex || hasScale || id;
  const escapedValue = escapeValue(value);
  return `|${isHeader ? 'H' : ''}${hasBrackets ? '(' : ''}${showIndex ? `[${indexX}|${indexY}]` : ''}${hasScale ? scale.join('|') : ''}${id ? `${showIndex || hasScale ? '|' : ''}${id}` : ''}${hasBrackets ? ')' : ''}>${escapedValue}`;
}

/**
 * @typedef {Object} PageItem
 * @property {string} title Заголовок
 * @property {CellItem[][]} rows Содержимое
 * Объект ячейки
 */

/**
 * Сериализует страницу
 * @param {PageItem} pageItem Страница
 * @param {boolean} showIndex Показывать индекс ячеек
 * @param {boolean} showPage Сериализовать заголовки страницы
 * @param {string} pageId Id страницы
 * @param {number} batchSize Размер батча для обработки
 * @returns {string} Результат - блок текста
 */
async function serializePageItem({ title, rows }, showIndex, showPage, pageId, batchSize = 50000) {
  const pageStart = `${showPage ? `|(${pageId}|${title}){\n` : ''}`;

  const result = [];
  const totalLines = rows.length;

  for (let batchStart = 0; batchStart < totalLines; batchStart += batchSize) {
    // Позволяем выполниться другим операциям между батчами
    await new Promise((resolve) => setTimeout(resolve, 0));

    const batchEnd = Math.min(batchStart + batchSize, totalLines);

    // Обработка текущего батча
    for (let i = batchStart; i < batchEnd; i++) {
      const line = rows[i];
      const serializedLine = line.reduce((prev, el) => {
        const serializedCell = serializeCellItem(el, showIndex, i);
        prev.push(serializedCell);
        return prev;
      }, []);

      result.push(`${serializedLine.join('')}<|`);
    }
  }

  return `${pageStart}${result.join('\n')}\n${showPage ? `}|\n` : ''}`;
}

/**
 * @typedef {Object.<string, PageItem>} DataStore
 * Объект хранилище таблицы
 */

/**
 * @typedef {Object} Store
 * @property {DataStore} data Хранилище данных
 * @property {ScriptArray[]} typings Хранилище типов
 * @property {ScriptArray[]} expressions Хранилище выражений
 * @property {ScriptArray[]} styles Хранилище стилей
 * Объект хранилище
 */

/**
 * Сериализует страницу
 * @param {Store} store Хранилище
 * @param {boolean} showIndex Показывать индекс ячеек
 * @param {boolean} showPage Сериализовать заголовки страницы, если страница только одна
 * @returns {string} Результат - блок текста
 */
export async function serialize({ data, typings, expressions, styles }, showIndex, showPages) {
  const showPage = showPages || Object.keys(data).length > 1;

  const processingPromises = Object.keys(data).map(async (el) => {
    const serializedPage = await serializePageItem(data[el], showIndex, showPage, el);
    return serializedPage;
  });

  const results = await Promise.all(processingPromises);
  const serializedTypings = serializeScriptArray(typings, '=>').join('\n');
  const serializedExpressions = serializeScriptArray(expressions, '=').join('\n');
  const serializedStyles = serializeScriptArray(styles, '<=').join('\n');
  const isNeedScripts =
    serializedTypings.trim().length || serializedExpressions.trim().length || serializedStyles.trim().length;

  return `|PTTJS 1.0|\n${results.join('\n')}${
    isNeedScripts
      ? `\n\n>>>SCRIPT\n${serializedTypings.trim().length ? `${serializedTypings}\n` : ''}${
          serializedExpressions.trim().length ? `${serializedExpressions}\n` : ''
        }${serializedStyles.trim().length ? `${serializedStyles}\n` : ''}<<<SCRIPT\n`
      : ''
  }`;
}
