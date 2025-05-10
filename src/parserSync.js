import { findCellsInLine, findScriptLines, getPageMeta, processAndCategorizeScriptLines } from './parser.js';

/**
 * Функция для быстрого поиска индексов совпадающих строк в большом массиве
 * @param {string[]} lines Массив строк для обработки
 * @param {RegExp} regex Регулярное выражение для поиска
 * @param {string} lineStartCheck Быстрая проверка начала строки
 * @param {string} lineEndCheck Быстрая проверка конца строки
 * @param {number} batchSize Размер батча
 * @returns {number[]} Массив индексов подходящих строк
 */
function findMatchingIndicesSync(lines, regex, lineStartCheck, lineEndCheck, onlyFirs = false, batchSize = 50000) {
  const totalLines = lines.length;
  const matchIndices = [];

  // Обработка массива батчами
  for (let batchStart = 0; batchStart < totalLines; batchStart += batchSize) {
    if (onlyFirs && matchIndices.length > 0) {
      break;
    }

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
 * @returns {number[]} Массив индексов подходящих строк
 */
function findPageStartsSync(lines) {
  const regex = /^\|(\((@\w+|[^|(){}\\]+|@\w+\|[^|(){}\\]+)?\))?\{$/;

  return findMatchingIndicesSync(lines, regex, '|', '{');
}

/**
 * Функция поиска конца страницы
 * @param {string[]} lines Массив строк для обработки
 * @returns {number[]} Массив индексов подходящих строк
 */
function findPageEndsSync(lines) {
  const regex = /\}\|$/;

  return findMatchingIndicesSync(lines, regex, '}', '|', true);
}

/**
 * Функция поиска валидных строк с ячейками
 * @param {string[]} lines Массив строк для обработки
 * @returns {number[]} Массив индексов подходящих строк
 */
function findCellLinesSync(lines) {
  const regex = /^\|(H)?(\((\[(\d+)\|(\d+)\])?(\d+\|\d+)?(\|)?(@\w+)?\))?>(.*)>?<\|$/;

  return findMatchingIndicesSync(lines, regex, '|', '<|');
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
 * Функция обработки строк с ячейками
 * @param {string[]} lines Массив строк для обработки
 * @returns {CellItem[][]} Двумерный массив ячеек по строкам
 */
function parseRowsSync(lines, batchSize = 50000) {
  const totalLines = lines.length;
  const result = [];

  // Обработка массива батчами
  for (let batchStart = 0; batchStart < totalLines; batchStart += batchSize) {
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
 * Функция для разбиения массива строк на сегменты, используя массив индексов
 * @param {string[]} strings Исходный массив строк
 * @param {number[]} indices Массив индексов, определяющих начало каждого сегмента
 * @returns {Array<{header: string, content: string[]}>} Массив объектов
 */
function splitByIndicesSync(strings, indices) {
  // Сортируем индексы
  const sortedIndices = [...indices].sort((a, b) => a - b);

  // Создаем массив промисов для параллельной обработки
  const processingPromises = sortedIndices.map((currentIndex, i) => {
    const nextIndex = sortedIndices[i + 1] || strings.length;
    const header = strings[currentIndex];

    let content = strings.slice(currentIndex + 1, nextIndex);
    const pageEndArr = findPageEndsSync(content);
    if (pageEndArr.length > 0) {
      content = content.slice(0, pageEndArr[0]);
    }

    return { header, content };
  });

  // Ждем завершения всех промисов
  return processingPromises;
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
export function parseSync(text) {
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

  const pageStarts = findPageStartsSync(lines);

  // Обработка текста без страниц
  if (!pageStarts.length) {
    const cellLinesIndex = findCellLinesSync(lines);
    const cellLines = [];
    cellLinesIndex.forEach((el) => {
      cellLines.push(lines[el]);
    });

    const rows = parseRowsSync(cellLines);

    const page = { title: 'Page 1', rows };
    data['@page1'] = page;
  }

  const pagesRaw = splitByIndicesSync(lines, pageStarts);

  const results = pagesRaw.map(({ header, content }, i) => {
    let pageId = `@page${i + 1}`;
    let pageName = `Page ${i + 1}`;
    const [headerId, headerName] = getPageMeta(header);
    if (headerId) {
      pageId = headerId;
    }
    if (headerName) {
      pageName = headerName;
    }
    const cellLinesIndex = findCellLinesSync(content);
    const cellLines = [];
    cellLinesIndex.forEach((el) => {
      cellLines.push(content[el]);
    });

    const rows = parseRowsSync(cellLines);

    return { pageId, pageName, rows };
  });

  results.forEach((el) => {
    data[el.pageId] = {
      title: el.pageName,
      rows: el.rows,
    };
  });

  return { data, typings, expressions, styles };
}
