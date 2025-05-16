<p align="center">
  <img src="https://raw.githubusercontent.com/Sergek-Research/PTTJS/main/assets/logo.png"
       width="200" alt="PTTJS logo">
</p>

<p align="right">
  <a href="README.ru.md">🇷🇺 Русский</a> |
  <a href="README.md">🇬🇧 English</a>
</p>

# PTTJS - Plain Text Table JavaScript

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://github.com/Sergek-Research/PTTJS/blob/main/LICENSE)

**PTTJS** (Plain Text Table JavaScript) - это текстовый формат для представления таблиц и JavaScript библиотека для работы с ним.

Формат разработан с целью хранения сложных табличных структур данных в человекочитаемом текстовом виде, превосходя по возможностям традиционные форматы, такие как CSV или Markdown-таблицы, при этом сохраняя простоту и удобство редактирования.

## Описание формата PTTJS

**PTTJS** позволяет описывать таблицы с объединенными ячейками, многоуровневыми заголовками, несколькими листами и даже встроенными скриптами для обработки данных – и все это в простом текстовом файле.

📜 **Подробную спецификацию формата PTTJS, его синтаксис и возможности вы найдете в файле: [docs/PTTJS_FORMAT_SPECIFICATION.md](./docs/PTTJS_FORMAT_SPECIFICATION.md)**

## Зачем нужен PTTJS?

Идея создания PTTJS возникла из следующих потребностей:

1.  **Обучение LLM (Больших Языковых Моделей):** Предоставить LLM возможность понимать и обрабатывать таблицы со сложной структурой без необходимости привлечения мультимодальных моделей исключительно для анализа таких таблиц.
2.  **Глубокая интеграция LLM с таблицами:** Научить LLM работать с таблицей как с единым целым, включая все ее данные и формулы, избегая сложных и "костыльных" решений, характерных для интеграции с Excel или Google Sheets.
3.  **Удобство работы в текстовых редакторах:** Обеспечить комфортную работу со сложными таблицами в популярных текстовых редакторах, таких как VSCode и Obsidian (посредством плагинов).
4.  **Альтернатива тяжеловесным решениям:** Предложить легкий и простой инструмент для 90% задач, связанных с таблицами, который мог бы заменить избыточные Microsoft Excel или Google Sheets.

## Ключевые особенности формата

- Поддержка объединенных ячеек (через указание масштаба ячейки).
- Многостраничные таблицы с именованными листами.
- Явное обозначение заголовочных ячеек.
- Опциональное указание индексов и уникальных ID для ячеек (для ссылок и формул).
- Встроенный механизм экранирования специальных символов для сохранения целостности данных.
- Мощный скриптовый блок (`>>>SCRIPT ... <<<SCRIPT`) для выполнения JavaScript-кода, определения формул, применения стилей и форматов к ячейкам и диапазонам.

## Установка библиотеки `pttjs`

Вы можете установить библиотеку `pttjs` с помощью npm или yarn:

```bash
npm install @sergek-research/pttjs
# или
yarn add @sergek-research/pttjs
```

## Использование

Библиотека предоставляет функции для парсинга PTTJS строк в JavaScript объекты и для сериализации этих объектов обратно в PTTJS строки.

### Парсинг PTTJS строки

```javascript
import { parse } from 'pttjs';

const pttjsString = `|PTTJS 1.0|encoding=UTF-8|
|H>Имя|H>Возраст<|
|>Алиса|>30<|
|>Боб|>24<|`;

async function exampleParse() {
  try {
    const pttjsData = await parse(pttjsString);
    console.log(JSON.stringify(pttjsData, null, 2));
    /*
    Примерный вид объекта pttjsData:
    {
      "data": {
        "@page1": { // ID страницы по умолчанию
          "title": "Page 1", // Имя страницы по умолчанию
          "rows": [
            [
              { "isHeader": true, "index": 0, "value": "Имя", ... },
              { "isHeader": true, "index": 1, "value": "Возраст", ... }
            ],
            [
              { "isHeader": null, "index": 0, "value": "Алиса", ... },
              { "isHeader": null, "index": 1, "value": "30", ... }
            ],
            [
              { "isHeader": null, "index": 0, "value": "Боб", ... },
              { "isHeader": null, "index": 1, "value": "24", ... }
            ]
          ]
        }
      },
      "typings": [],    // Массив для скриптов форматирования
      "expressions": [], // Массив для скриптов вычислений (формул)
      "styles": []       // Массив для скриптов стилизации
    }
    */
  } catch (error) {
    console.error('Ошибка парсинга PTTJS:', error);
  }
}

exampleParse();
```

### Сериализация объекта в PTTJS строку

```javascript
import { serialize } from 'pttjs';

const dataToSerialize = {
  data: {
    '@customPageId': {
      // Можно задать свой ID страницы
      title: 'Пользователи',
      rows: [
        [
          { isHeader: true, value: 'Имя' },
          { isHeader: true, value: 'Возраст' },
        ],
        [{ value: 'Алиса' }, { value: '30' }],
        [{ value: 'Боб' }, { value: '24' }],
      ],
    },
  },
  // Можно также добавить скрипты:
  // expressions: [
  //   [{ page: '@customPageId', cellStart: { x: '0', y: '3'}, cellEnd: null }, ['CONCAT', ['@customPageId|0|1'], ' - ', ['@customPageId|1|1']]]
  // ],
  typings: [],
  styles: [],
};

// Опции сериализации
const showIndexes = false; // Показывать ли индексы ячеек ([0|0])
const showPageHeaders = true; // Показывать ли заголовки страниц |(@P1|Название){ ... }| , если только одна страница

async function exampleSerialize() {
  try {
    const pttjsString = await serialize(dataToSerialize, showIndexes, showPageHeaders);
    console.log(pttjsString);
    /*
    Примерный вывод:
    |(@customPageId|Пользователи){
    |H>Имя|H>Возраст<|
    |>Алиса|>30<|
    |>Боб|>24<|
    }|
    */
  } catch (error) {
    console.error('Ошибка сериализации PTTJS:', error);
  }
}

exampleSerialize();
```

## API (основные функции)

- `async parse(text: string): Promise<Store>`: Асинхронно парсит строку в формате PTTJS и возвращает объект `Store`, содержащий данные таблицы и скрипты.
- `async serialize(store: Store, showIndex?: boolean, showPages?: boolean): Promise<string>`: Асинхронно сериализует объект `Store` в строку формата PTTJS.
  - `showIndex` (опционально): Показывать ли позиционные индексы ячеек.
  - `showPages` (опционально): Показывать ли разметку страниц (если страниц больше одной, разметка показывается автоматически).
- `escapeValue(value: string): string`: Экранирует специальные символы (`\n`, `|`, `>`, `<`, `{`, `}`) в строке для безопасного использования внутри ячейки PTTJS.
- `unescapeValue(value: string): string`: Преобразует URL-закодированные последовательности обратно в их исходные символы.

(Типы данных, такие как `Store`, `PageItem`, `CellItem`, `ScriptArray` и другие, подробно описаны с помощью JSDoc в исходном коде библиотеки и доступны в сгенерированных `.d.ts` файлах для TypeScript проектов).

## Формальная грамматика

- **EBNF грамматика (Instaparse):** [`docs/grammar/pttjs-instaparse.ebnf`](docs/grammar/pttjs-instaparse.ebnf)

## Планы на будущее

- [ ] Разработка плагина для VSCode с подсветкой синтаксиса и предпросмотром.
- [x] [Создание плагина для Obsidian](https://github.com/Sergek-Research/pttjs-viewer).
- [ ] Расширение возможностей скриптового языка (новые встроенные функции, улучшенная работа с диапазонами).
- [ ] Оптимизация производительности для работы с очень большими таблицами.
- [ ] Интерактивный редактор PTTJS на веб-технологиях.

## Вклад

Мы будем рады любому вкладу в развитие PTTJS!

Вы можете сообщать об ошибках, предлагать новые функции или улучшения через раздел [Issues](https://github.com/Sergek-Research/PTTJS/issues) на GitHub.

## Лицензия

Проект PTTJS и данная библиотека распространяются под лицензией MIT. Подробности смотрите в файле [`LICENSE`](https://github.com/Sergek-Research/PTTJS/blob/main/LICENSE).
