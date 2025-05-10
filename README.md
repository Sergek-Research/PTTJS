<p align="center">
  <img src="https://raw.githubusercontent.com/Sergek-Research/PTTJS/main/assets/logo.png"
       width="200" alt="PTTJS logo">
</p>

# PTTJS – Plain Text Table JavaScript

[![npm version](https://img.shields.io/npm/v/@sergek-research/pttjs.svg?style=flat-square)](https://www.npmjs.com/package/@sergek-research/pttjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://github.com/Sergek-Research/PTTJS/blob/main/LICENSE)

**PTTJS** (Plain Text Table JavaScript) is a plain‑text table format and a JavaScript library for working with it.

The format was created to store complex tabular data structures in a human‑readable text form, outperforming traditional formats such as CSV or Markdown tables while remaining simple and convenient to edit.

## PTTJS Format Overview

**PTTJS** lets you describe tables with merged cells, multi‑level headers, multiple sheets, and even embedded scripts for data processing – all in a single text file.

📜 **You can find the detailed PTTJS specification, syntax, and capabilities in** [docs/PTTJS_FORMAT_SPECIFICATION.md](./docs/PTTJS_FORMAT_SPECIFICATION.md)

## Why PTTJS?

The idea behind PTTJS came from several needs:

1. **Training LLMs (Large Language Models):** Let an LLM understand and process complex‑structured tables without having to resort to multimodal models just to parse such tables.
2. **Deep LLM–table integration:** Teach an LLM to work with a table as a single entity – including all its data and formulas – without the convoluted “duct‑tape” solutions typical of Excel or Google Sheets integrations.
3. **Comfort in text editors:** Make it pleasant to handle complex tables in popular editors such as VS Code and Obsidian (via plugins).
4. **A lightweight alternative to heavyweight tools:** Provide a simple tool that covers 90 % of table‑related tasks and can replace overkill solutions like Microsoft Excel or Google Sheets.

## Key Features

- Support for merged cells (via explicit cell span).
- Multi‑sheet tables with named sheets.
- Explicit header‑cell markers.
- Optional indices and unique IDs for cells (for references and formulas).
- Built‑in escaping for special characters to preserve data integrity.
- A powerful script block (`>>>SCRIPT … <<<SCRIPT`) for running JavaScript code, defining formulas, and styling cells or ranges.

## Installing the `pttjs` library

Install `pttjs` with npm or yarn:

```bash
npm install @sergek-research/pttjs
# or
yarn add @sergek-research/pttjs
```

## Usage

The library provides functions for parsing PTTJS strings into JavaScript objects and serialising those objects back into PTTJS strings.

### Parsing a PTTJS string

```javascript
import { parse } from 'pttjs';

const pttjsString = `|PTTJS 1.0|encoding=UTF-8|
|H>Name|H>Age<|
|>Alice|>30<|
|>Bob|>24<|`;

async function exampleParse() {
  try {
    const pttjsData = await parse(pttjsString);
    console.log(JSON.stringify(pttjsData, null, 2));
    /*
    Sample structure of pttjsData:
    {
      "data": {
        "@page1": {               // default page ID
          "title": "Page 1",      // default page title
          "rows": [
            [
              { "isHeader": true,  "index": 0, "value": "Name", ... },
              { "isHeader": true,  "index": 1, "value": "Age",  ... }
            ],
            [
              { "isHeader": null,  "index": 0, "value": "Alice", ... },
              { "isHeader": null,  "index": 1, "value": "30",    ... }
            ],
            [
              { "isHeader": null,  "index": 0, "value": "Bob",   ... },
              { "isHeader": null,  "index": 1, "value": "24",    ... }
            ]
          ]
        }
      },
      "typings": [],     // formatting scripts
      "expressions": [], // calculation scripts (formulas)
      "styles": []       // styling scripts
    }
    */
  } catch (error) {
    console.error('PTTJS parse error:', error);
  }
}

exampleParse();
```

### Serialising an object to a PTTJS string

```javascript
import { serialize } from 'pttjs';

const dataToSerialize = {
  data: {
    '@customPageId': {
      // custom page ID
      title: 'Users',
      rows: [
        [
          { isHeader: true, value: 'Name' },
          { isHeader: true, value: 'Age' },
        ],
        [{ value: 'Alice' }, { value: '30' }],
        [{ value: 'Bob' }, { value: '24' }],
      ],
    },
  },
  // You can also add scripts:
  // expressions: [
  //   [{ page: '@customPageId', cellStart: { x: '0', y: '3' }, cellEnd: null },
  //    ['CONCAT', ['@customPageId|0|1'], ' - ', ['@customPageId|1|1']]]
  // ],
  typings: [],
  styles: [],
};

// Serialisation options
const showIndexes = false; // show cell indexes ([0|0])
const showPageHeaders = true; // show |(@P1|Title){ … }| if only one page

async function exampleSerialize() {
  try {
    const pttjsString = await serialize(dataToSerialize, showIndexes, showPageHeaders);
    console.log(pttjsString);
    /*
    Expected output:
    |(@customPageId|Users){
    |H>Name|H>Age<|
    |>Alice|>30<|
    |>Bob|>24<|
    }|
    */
  } catch (error) {
    console.error('PTTJS serialisation error:', error);
  }
}

exampleSerialize();
```

## API (core functions)

- `async parse(text: string): Promise<Store>` – Parses a PTTJS string and returns a `Store` object containing table data and scripts.
- `async serialize(store: Store, showIndex?: boolean, showPages?: boolean): Promise<string>` – Serialises a `Store` object back to a PTTJS string.

  - `showIndex` (optional) – Include positional cell indexes.
  - `showPages` (optional) – Include page markup (if there is more than one page, markup is always included automatically).

- `escapeValue(value: string): string` – Escapes special characters (`\n`, `|`, `>`, `<`, `{`, `}`) so they can be safely placed inside a PTTJS cell.
- `unescapeValue(value: string): string` – Reverses the escaping and restores the original characters.

(Data types such as `Store`, `PageItem`, `CellItem`, `ScriptArray`, and others are documented in the source code via JSDoc and exposed in the generated `.d.ts` files for TypeScript projects.)

## Roadmap

- [ ] VS Code plugin with syntax highlighting and preview.
- [ ] Obsidian plugin.
- [ ] Extended script‑language capabilities (new built‑in functions, improved range handling).
- [ ] Performance optimisations for very large tables.
- [ ] Web‑based interactive PTTJS editor.

## Contributing

We welcome any contributions to PTTJS!

Feel free to report bugs, propose new features, or suggest improvements in the [Issues](https://github.com/Sergek-Research/PTTJS/issues) section.

## License

PTTJS and this library are distributed under the MIT License. See the [`LICENSE`](https://github.com/Sergek-Research/PTTJS/blob/main/LICENSE) file for details.
