/**
 * Функция для быстрого поиска индексов совпадающих строк в большом массиве
 * @param {string[]} lines Массив строк для обработки
 * @param {RegExp} regex Регулярное выражение для поиска
 * @param {string} lineStartCheck Быстрая проверка начала строки
 * @param {string} lineEndCheck Быстрая проверка конца строки
 * @param {number} batchSize Размер батча
 * @returns {Promise<number[]>} Массив индексов подходящих строк
 */
async function findMatchingIndices(lines, regex, lineStartCheck, lineEndCheck, onlyFirs = false, batchSize = 50000) {
  const totalLines = lines.length;
  const matchIndices = [];

  // Обработка массива батчами
  for (let batchStart = 0; batchStart < totalLines; batchStart += batchSize) {
    if (onlyFirs && matchIndices.length > 0) {
      break;
    }
    // Позволяем выполниться другим операциям между батчами
    await new Promise((resolve) => setTimeout(resolve, 0));

    const batchEnd = Math.min(batchStart + batchSize, totalLines);

    // Обработка текущего батча
    for (let i = batchStart; i < batchEnd; i++) {
      if (onlyFirs && matchIndices.length > 0) {
        break;
      }
      const line = lines[i];

      // Быстрая предварительная фильтрация
      if (lineStartCheck && !line.startsWith(lineStartCheck)) continue;
      if (lineEndCheck && !line.endsWith(lineEndCheck)) continue;

      // Применяем полное регулярное выражение только после предварительной фильтрации
      if (regex.test(line)) {
        matchIndices.push(i);
      }

      if (regex.global) {
        regex.lastIndex = 0;
      }
    }
  }
  return matchIndices;
}

/**
 * Функция поиска начала страницы
 * @param {string[]} lines Массив строк для обработки
 * @returns {Promise<number[]>} Массив индексов подходящих строк
 */
async function findPageStarts(lines) {
  const regex = /^\|(\((@\w+|[^|(){}\\]+|@\w+\|[^|(){}\\]+)?\))?\{$/;

  return findMatchingIndices(lines, regex, '|', '{');
}

/**
 * Функция получения данных страницы
 * @param {string} line Строка начала страницы
 * @returns {[string,string]} Массив [id,название]
 */
export function getPageMeta(line) {
  const regex = /\|\(?([^(){}]*)\)?\{/;
  const match = line.match(regex);

  if (match && match[1]) {
    const results = match[1].split('|');
    if (results.length > 1) {
      const id = results[0];
      const name = results[1];
      if (id.startsWith('@')) {
        return [id, name];
      } else {
        return ['', id];
      }
    } else {
      const meta = results[0];
      if (meta.startsWith('@')) {
        return [meta, ''];
      } else {
        return ['', meta];
      }
    }
  }
  return ['', ''];
}

/**
 * Функция поиска конца страницы
 * @param {string[]} lines Массив строк для обработки
 * @returns {Promise<number[]>} Массив индексов подходящих строк
 */
async function findPageEnds(lines) {
  const regex = /\}\|$/;

  return findMatchingIndices(lines, regex, '}', '|', true);
}

/**
 * Функция поиска валидных строк с ячейками
 * @param {string[]} lines Массив строк для обработки
 * @returns {Promise<number[]>} Массив индексов подходящих строк
 */
async function findCellLines(lines) {
  const regex = /^\|(H)?(\((\[(\d+)\|(\d+)\])?(\d+\|\d+)?(\|)?(@\w+)?\))?>(.*)>?<\|$/;

  return findMatchingIndices(lines, regex, '|', '<|');
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
 * Функция получения данных ячейки
 * @param {string} header Заголовок ячейки
 * @param {number} indexDefault Дефолтный индекс
 * @returns {CellItem} Объект ячейки без содержимого
 */
export function getCellMeta(header, indexDefault) {
  // Удаляем открывающий и закрывающие символы
  let isHeader = null;
  let index = indexDefault;
  let scale = null;
  let id = null;
  let value = '';
  let tempHeader = header.slice(1, -1);

  if (tempHeader.startsWith('H')) {
    isHeader = true;
    tempHeader = tempHeader.slice(1);
  }

  if (tempHeader.startsWith('(')) {
    // Очищаем от круглых скобок
    tempHeader = tempHeader.slice(1);
    tempHeader = tempHeader.split(')')[0];
    if (tempHeader.length) {
      if (tempHeader.startsWith('[')) {
        const squareBracketsArr = tempHeader.slice(1).split(']');
        const squareBracketsVal = squareBracketsArr[0];
        const indexArr = squareBracketsVal.split('|');
        if (indexArr.length > 1) {
          const tempIndex = Number(indexArr[0]);
          if (!isNaN(tempIndex)) {
            index = tempIndex;
          }
        }
        tempHeader = tempHeader.slice(2 + squareBracketsVal.length);
      }
      const splitIdArr = tempHeader.split('@');
      if (splitIdArr.length > 1) {
        id = `@${splitIdArr[1]}`;
        tempHeader = splitIdArr[0];
      }
      const splitScaleArr = tempHeader.split('|');
      if (splitScaleArr.length > 1) {
        const tempScale1 = Number(splitScaleArr[0]);
        const tempScale2 = Number(splitScaleArr[1]);
        if (!isNaN(tempScale1) && !isNaN(tempScale2)) {
          scale = [tempScale1, tempScale2];
        }
      }
    }
  }

  return { isHeader, index, scale, id, value };
}

/**
 * Функция поиска ячеек в строке
 * @param {string} line Валидная строка с ячейками
 * @returns {CellItem[]} Массив объектов ячеек
 */
export function findCellsInLine(line) {
  // Удаляем закрывающие символы
  const cleanLine = line.slice(0, -2);

  const regex = /\|(H)?(\((\[(\d+)\|(\d+)\])?(\d+\|\d+)?(\|)?(@\w+)?\))?>/g;

  const cells = cleanLine.match(regex);
  if (!cells.length) {
    return [];
  }

  if (cells.length === 1) {
    const tempOneValue = cleanLine.split(cells[0])[1];
    const cellOneItem = getCellMeta(cells[0], 0);
    cellOneItem.value = tempOneValue;
    return [cellOneItem];
  }

  const cellItems = [];
  const values = [];
  let tempString = cleanLine;

  cells.forEach((el, i) => {
    cellItems.push(getCellMeta(el, i));
    const tempArr = tempString.split(el);
    if (i > 0) {
      const tempValue = tempArr[0];
      values.push(tempValue);
      tempString = tempString.slice(el.length + tempValue.length);
      if (i + 1 === cells.length) {
        values.push(tempString);
      }
    } else {
      tempString = tempString.slice(el.length);
    }
  });

  cellItems.forEach((el, i) => {
    if (values.length > i) {
      el.value = unescapeValue(values[i]);
    }
  });

  return cellItems;
}

/**
 * Функция обработки строк с ячейками
 * @param {string[]} lines Массив строк для обработки
 * @returns {Promise<CellItem[][]>} Двумерный массив ячеек по строкам
 */
async function parseRows(lines, batchSize = 50000) {
  const totalLines = lines.length;
  const result = [];

  // Обработка массива батчами
  for (let batchStart = 0; batchStart < totalLines; batchStart += batchSize) {
    // Позволяем выполниться другим операциям между батчами
    await new Promise((resolve) => setTimeout(resolve, 0));

    const batchEnd = Math.min(batchStart + batchSize, totalLines);

    // Обработка текущего батча
    for (let i = batchStart; i < batchEnd; i++) {
      const line = lines[i];

      const rowArr = findCellsInLine(line);
      if (rowArr.length) {
        result.push(rowArr);
      }
    }
  }
  return result;
}

/**
 * Функция поиска строк скриптов
 * @param {string[]} lines Массив строк для обработки
 * @returns {[number, string[]]} [Индекс начала скриптов, Массив строк скриптов]
 */
export function findScriptLines(lines) {
  let startScriptsLine = null;
  let endScriptsLine = null;
  lines.forEach((el, i) => {
    if (startScriptsLine === null && el.startsWith('>>>SCRIPT')) {
      startScriptsLine = i;
    }
    if (startScriptsLine !== null && endScriptsLine === null && el.startsWith('<<<SCRIPT')) {
      endScriptsLine = i;
    }
  });
  if (typeof startScriptsLine !== 'number') {
    return [];
  }
  if (typeof endScriptsLine !== 'number') {
    return [startScriptsLine, lines.slice(startScriptsLine + 1)];
  }
  return [startScriptsLine, lines.slice(startScriptsLine + 1, endScriptsLine)];
}

/**
 * Функция для разбиения массива строк на сегменты, используя массив индексов
 * @param {string[]} strings Исходный массив строк
 * @param {number[]} indices Массив индексов, определяющих начало каждого сегмента
 * @returns {Array<{header: string, content: string[]}>} Массив объектов
 */
async function splitByIndices(strings, indices) {
  // Сортируем индексы
  const sortedIndices = [...indices].sort((a, b) => a - b);

  // Создаем массив промисов для параллельной обработки
  const processingPromises = sortedIndices.map(async (currentIndex, i) => {
    const nextIndex = sortedIndices[i + 1] || strings.length;
    const header = strings[currentIndex];

    let content = strings.slice(currentIndex + 1, nextIndex);
    const pageEndArr = await findPageEnds(content);
    if (pageEndArr.length > 0) {
      content = content.slice(0, pageEndArr[0]);
    }

    return { header, content };
  });

  // Ждем завершения всех промисов
  return Promise.all(processingPromises);
}

/**
 * @typedef {Object} PageItem
 * @property {string} title Заголовок
 * @property {CellItem[][]} rows Содержимое
 * Объект ячейки
 */

/**
 * @typedef {Object.<string, PageItem>} DataStore
 * Объект хранилище таблицы
 */

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
 * @typedef {Object} ScriptAddress
 * @property {string|null} page Id страницы
 * @property {CellAddress} cellStart Индекс по X
 * @property {CellAddress|null} cellEnd Индекс по Y
 * Объект адреса скрипта
 */

/**
 * Парсит строку ячейки в объект.
 * @param {string} cellStr Строка для парсинга.
 * @returns {CellAddress} Объект адреса ячейки.
 */
export function parseCellString(cellStr) {
  const parts = cellStr.split('|');
  let page = null;
  let x = null;
  let y = null;
  let xTE = null;
  let yTE = null;

  let xPart;
  let yPart;

  if (parts.length === 3) {
    // формат "page|x|y"
    page = parts[0];
    xPart = parts[1];
    yPart = parts[2];
  } else if (parts.length === 2) {
    // формат "x|y"
    xPart = parts[0];
    yPart = parts[1];
  } else if (parts.length === 1) {
    // Может быть "x", "x:x", или пустая строка ""
    if (cellStr === '') {
      return { page, x, y, xTE, yTE }; // Все null для пустой строки
    }
    xPart = parts[0];
  } else {
    return { page, x, y, xTE, yTE };
  }

  if (xPart !== undefined && xPart !== null) {
    const xSubParts = xPart.split(':');
    x = xSubParts[0] === '' ? null : xSubParts[0];
    if (xSubParts.length > 1) {
      xTE = true;
    }
  }

  if (yPart !== undefined && yPart !== null) {
    const ySubParts = yPart.split(':');
    y = ySubParts[0] === '' ? null : ySubParts[0];
    if (ySubParts.length > 1) {
      yTE = true;
    }
  }
  if (xPart === '' && yPart === '' && parts.length === 2) {
    x = null;
    y = null;
  }

  return { page, x, y, xTE, yTE };
}

/**
 * Функция парсинга строки адреса.
 * @param {string} addressRegexMatch Строка, совпавшая с одним из regex (например, "(1|1,1|6)=>").
 * @returns {ScriptAddress} Объект адреса скрипта.
 */
export function parseAddressString(addressRegexMatch) {
  let content;
  let suffixLength;

  if (addressRegexMatch.endsWith('=>') || addressRegexMatch.endsWith('<=')) {
    suffixLength = 2;
  } else if (addressRegexMatch.endsWith('=')) {
    suffixLength = 1;
  } else {
    throw new Error(`parseAddressString: Неизвестный суффикс для строки адреса "${addressRegexMatch}"`);
  }

  if (addressRegexMatch.startsWith('(') && addressRegexMatch.length >= 1 + suffixLength + 1) {
    content = addressRegexMatch.substring(1, addressRegexMatch.length - 1 - suffixLength);
  } else {
    throw new Error(
      `parseAddressString: Некорректный формат строки адреса "${addressRegexMatch}" (слишком короткая или не начинается/заканчивается скобками)`
    );
  }

  const rawAddressParts = content.split(',').map((s) => s.trim());
  let pageForAddressObject = null;
  let cellStart = null;
  let cellEnd = null;
  let startIndexForCells = 0;

  // Проверка на страницу: начинается с @, не содержит | или : (чтобы не спутать с ячейкой)
  if (
    rawAddressParts.length > 0 &&
    rawAddressParts[0].startsWith('@') &&
    !rawAddressParts[0].includes('|') &&
    !rawAddressParts[0].includes(':')
  ) {
    pageForAddressObject = rawAddressParts[0];
    startIndexForCells = 1;
  }

  const cellStrings = rawAddressParts.slice(startIndexForCells);

  if (cellStrings.length > 0 && cellStrings[0] !== '') {
    cellStart = parseCellString(cellStrings[0]);
  } else if (cellStrings.length === 0 && pageForAddressObject) {
    // Только страница, например "(@PageOnly)=>"
    // cellStart и cellEnd остаются null
  } else if (rawAddressParts.length === 1 && rawAddressParts[0] === '' && content === '') {
    // Случай "()=>" или "()=" или "()=<="
    cellStart = parseCellString(''); // Вернет все null
  }

  if (cellStrings.length > 1 && cellStrings[1] !== '') {
    cellEnd = parseCellString(cellStrings[1]);
  } else if (cellStrings.length > 1 && cellStrings[1] === '' && !cellEnd) {
    // Случай типа (1|1,) => вторая ячейка пустая
    cellEnd = parseCellString('');
  }

  return { page: pageForAddressObject, cellStart, cellEnd };
}

/**
 * @typedef {Array} FunctionCallArray
 * @property {string} Первый элемент всегда строка
 * @property {(FunctionCallArray)[]}
 */

/**
 * @typedef {Array} ScriptArray
 * @property {ScriptAddress} Первый элемент всегда адрес
 * @property {FunctionCallArray}
 */

/**
 * Парсит текстовое представление вызова функции и ее параметров.
 * @param {string} text Текст для парсинга.
 * @param {boolean} [parseArgumentsAsCells=false] Если true, строковые аргументы (не функции) парсятся через parseCellString.
 * @returns {FunctionCallArray} Массив [имя_функции, ...аргументы].
 */
export function parseFunctionCall(text, parseArgumentsAsCells = false) {
  const originalText = text;
  text = text.trim();

  const openParenIndex = text.indexOf('(');

  if (openParenIndex === -1 || !text.endsWith(')')) {
    throw new Error(
      `parseFunctionCall: Некорректный формат вызова функции. Ожидается "NAME(...)". Получено: "${originalText}"`
    );
  }

  const functionName = text.substring(0, openParenIndex);
  if (!functionName) {
    throw new Error(
      `parseFunctionCall: Некорректный формат вызова функции. Отсутствует имя функции. Получено: "${originalText}"`
    );
  }

  let topLevelBalance = 0;
  for (let i = openParenIndex; i < text.length; i++) {
    if (text[i] === '(') {
      topLevelBalance++;
    } else if (text[i] === ')') {
      topLevelBalance--;
    }
    if (topLevelBalance === 0 && i < text.length - 1) {
      throw new Error(
        `parseFunctionCall: Некорректный формат вызова функции. Преждевременная закрывающая скобка или лишние символы после вызова функции. Получено: "${originalText}"`
      );
    }
    if (topLevelBalance < 0) {
      throw new Error(
        `parseFunctionCall: Некорректный формат вызова функции. Непарные скобки (слишком много закрывающих). Получено: "${originalText}"`
      );
    }
  }
  if (topLevelBalance !== 0) {
    throw new Error(
      `parseFunctionCall: Некорректный формат вызова функции. Непарные скобки (не все закрыты). Получено: "${originalText}"`
    );
  }

  const argsString = text.substring(openParenIndex + 1, text.length - 1);
  const result = [functionName];

  if (argsString.length === 0) {
    return result;
  }

  const rawParams = [];
  let currentArgStartIndex = 0;
  let argParenBalance = 0;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    if (char === '(') {
      argParenBalance++;
    } else if (char === ')') {
      argParenBalance--;
      if (argParenBalance < 0) {
        throw new Error(
          `parseFunctionCall: Неправильно сформированные аргументы: Несбалансированные скобки в аргументах "${functionName}". Аргументы: "${argsString}" в тексте: "${originalText}"`
        );
      }
    } else if (char === ',' && argParenBalance === 0) {
      rawParams.push(argsString.substring(currentArgStartIndex, i));
      currentArgStartIndex = i + 1;
    }
  }
  rawParams.push(argsString.substring(currentArgStartIndex));

  if (argParenBalance !== 0) {
    throw new Error(
      `parseFunctionCall: Неправильно сформированные аргументы: Несбалансированные скобки в конце аргументов "${functionName}". Аргументы: "${argsString}" в тексте: "${originalText}"`
    );
  }

  for (const paramStr of rawParams) {
    const trimmedParamStr = paramStr.trim();

    if (trimmedParamStr === '') {
      if (parseArgumentsAsCells) {
        result.push(parseCellString(''));
      } else {
        result.push('');
      }
      continue;
    }

    try {
      const nestedCallResult = parseFunctionCall(trimmedParamStr, parseArgumentsAsCells);
      result.push(nestedCallResult);
    } catch (e) {
      if (parseArgumentsAsCells) {
        result.push(parseCellString(trimmedParamStr));
      } else {
        result.push(trimmedParamStr);
      }
    }
  }
  return result;
}

/**
 * Обрабатывает массив строк скрипта, классифицируя и парся их.
 * @param {string[]} scriptLines Массив строк для обработки.
 * @returns {{typings: ScriptArray[], expressions: ScriptArray[], styles: ScriptArray[]}} Объект с тремя массивами.
 */
export function processAndCategorizeScriptLines(scriptLines) {
  const regexTypings = /^\((@[\w\d\s]+,)?(\d+(?::\d+)?\|\d+(?::\d+)?)(,\d+(?::\d+)?\|\d+(?::\d+)?)?\)=>/;
  const regexStyles = /^\((@[\w\d\s]+,)?(\d+(?::\d+)?\|\d+(?::\d+)?)(,\d+(?::\d+)?\|\d+(?::\d+)?)?\)<=/;
  const regexExpressions = /^\((@[\w\d]+\|)?\d+\|\d+\)=/;

  const typings = [];
  const expressions = [];
  const styles = [];

  for (const line of scriptLines) {
    let match;
    const trimmedLine = line.trim();

    // 1. Проверка на Typings
    match = trimmedLine.match(regexTypings);
    if (match) {
      const matchedPartString = match[0];
      const functionCallString = trimmedLine.substring(matchedPartString.length);
      try {
        const addressObject = parseAddressString(matchedPartString);
        const parsedFunction = parseFunctionCall(functionCallString.trim(), false);
        typings.push([addressObject, parsedFunction]);
      } catch (e) {
        console.error(
          `Ошибка обработки строки типизации (исходная: "${line}"): ${e.message}. Совпавшая часть: "${matchedPartString}", Строка функции: "${functionCallString.trim()}"`
        );
      }
      continue;
    }

    // 2. Проверка на Expressions
    match = trimmedLine.match(regexExpressions);
    if (match) {
      const matchedPartString = match[0];
      const functionCallString = trimmedLine.substring(matchedPartString.length);
      try {
        const addressObject = parseAddressString(matchedPartString);
        const parsedFunction = parseFunctionCall(functionCallString.trim(), true);
        expressions.push([addressObject, parsedFunction]);
      } catch (e) {
        console.error(
          `Ошибка обработки строки выражения (исходная: "${line}"): ${e.message}. Совпавшая часть: "${matchedPartString}", Строка функции: "${functionCallString.trim()}"`
        );
      }
      continue;
    }

    // 3. Проверка на Styles
    match = trimmedLine.match(regexStyles);
    if (match) {
      const matchedPartString = match[0];
      const functionCallString = trimmedLine.substring(matchedPartString.length);
      try {
        const addressObject = parseAddressString(matchedPartString);
        const parsedFunction = parseFunctionCall(functionCallString.trim(), false);
        styles.push([addressObject, parsedFunction]);
      } catch (e) {
        console.error(
          `Ошибка обработки строки стилизации (исходная: "${line}"): ${e.message}. Совпавшая часть: "${matchedPartString}", Строка функции: "${functionCallString.trim()}"`
        );
      }
    }
  }

  return {
    typings,
    expressions,
    styles,
  };
}

/**
 * Декодирует специальные URL-закодированные символы в их исходные значения.
 * Заменяет %5Cn, %7C, %3E, %3C, %7B, %7D на \n, |, >, <, {, } соответственно.
 * @param {string} value Исходная строка с URL-закодированными символами.
 * @returns {string} Строка с декодированными символами.
 */
export function unescapeValue(value) {
  let unescaped = value;

  // 1. Проверка типа входного значения
  if (typeof value !== 'string') {
    // Попытка преобразовать в строку или вернуть как есть/выбросить ошибку,
    // в зависимости от требований.
    unescaped = String(value);
  }

  // 2. Карта URL-закодированных последовательностей и их символьных замен
  const unescapeMap = {
    '%5Cn': '\n', // %5Cn -> Новая строка
    '%7C': '|', // %7C -> Вертикальная черта
    '%3E': '>', // %3E -> >
    '%3C': '<', // %3C -> <
    '%7B': '{', // %7B -> {
    '%7D': '}', // %7D -> }
  };

  // 3. Регулярное выражение для поиска всех URL-закодированных последовательностей,
  // которые нужно заменить. Используем не захватывающую группу (?:)
  // для группировки альтернатив. Символ '%' экранируется как '%%' в некоторых
  // контекстах, но в JS RegExp он не является специальным сам по себе.
  // Однако, чтобы быть точным, мы ищем буквальные строки.
  const regex = /%5Cn|%7C|%3E|%3C|%7B|%7D/g;

  // 4. Один вызов replace с функцией замены
  return unescaped.replace(regex, (match) => unescapeMap[match]);
}

/**
 * @typedef {Object} Store
 * @property {DataStore} data Хранилище данных
 * @property {ScriptArray[]} typings Хранилище типов
 * @property {ScriptArray[]} expressions Хранилище выражений
 * @property {ScriptArray[]} styles Хранилище стилей
 * Объект хранилище
 */

/**
 * Функция парсинга текста
 * @param {string} text Текст для обработки
 * @returns {Promise<Store>} Объект хранилище таблицы
 */
export async function parse(text) {
  const data = {};
  const lines = text.split('\n');

  if (lines[0].startsWith('|PTTJS')) {
    lines.shift();
  }

  // Вытаскиваем скрипты
  let scriptLines = [];
  const scriptsArr = findScriptLines(lines);
  if (scriptsArr.length === 2) {
    scriptLines = scriptsArr[1];
    lines.splice(scriptsArr[0]);
  }

  const { typings, expressions, styles } = processAndCategorizeScriptLines(scriptLines);

  const pageStarts = await findPageStarts(lines);

  // Обработка текста без страниц
  if (!pageStarts.length) {
    const cellLinesIndex = await findCellLines(lines);
    const cellLines = [];
    cellLinesIndex.forEach((el) => {
      cellLines.push(lines[el]);
    });

    const rows = await parseRows(cellLines);

    const page = { title: 'Page 1', rows };
    data['@page1'] = page;
  }

  const pagesRaw = await splitByIndices(lines, pageStarts);

  const processingPromises = pagesRaw.map(async ({ header, content }, i) => {
    let pageId = `@page${i + 1}`;
    let pageName = `Page ${i + 1}`;
    const [headerId, headerName] = getPageMeta(header);
    if (headerId) {
      pageId = headerId;
    }
    if (headerName) {
      pageName = headerName;
    }
    const cellLinesIndex = await findCellLines(content);
    const cellLines = [];
    cellLinesIndex.forEach((el) => {
      cellLines.push(content[el]);
    });

    const rows = await parseRows(cellLines);

    return { pageId, pageName, rows };
  });

  const results = await Promise.all(processingPromises);

  results.forEach((el) => {
    data[el.pageId] = {
      title: el.pageName,
      rows: el.rows,
    };
  });

  return { data, typings, expressions, styles };
}
