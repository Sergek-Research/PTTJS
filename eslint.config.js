import globals from 'globals';
import js from '@eslint/js';
import pluginImport from 'eslint-plugin-import';
import pluginJest from 'eslint-plugin-jest';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

// Вспомогательная функция для удаления лишних пробелов из ключей объекта
function trimGlobalKeys(globalSet) {
  if (!globalSet || typeof globalSet !== 'object') {
    return globalSet; // Возвращаем как есть, если это не объект
  }
  const cleaned = {};
  for (const key in globalSet) {
    if (Object.prototype.hasOwnProperty.call(globalSet, key)) {
      cleaned[key.trim()] = globalSet[key]; // key.trim() удаляет пробелы в начале и конце
    }
  }
  return cleaned;
}

// Очищаем браузерные глобальные переменные
const cleanedBrowserGlobals = trimGlobalKeys(globals.browser);

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },

  js.configs.recommended,

  // Конфигурация для исходных файлов вашего проекта (src)
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...cleanedBrowserGlobals,
        ...globals.es2021,
      },
    },
    plugins: {
      import: pluginImport,
    },
    rules: {
      'import/no-unresolved': 'error',
      'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-param-reassign': 'off',
      'no-continue': 'off',
      'no-shadow': 'off',
      'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js'],
        },
      },
    },
  },

  // Конфигурация для тестовых файлов
  {
    files: ['tests/**/*.test.js', 'tests/**/*.spec.js', '**/*.test.js', '**/*.spec.js'],
    plugins: {
      jest: pluginJest,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.jest,
        ...globals.es2021,
      },
    },
    rules: {
      ...pluginJest.configs.recommended.rules,
    },
  },

  // Конфигурация для файлов конфигурации проекта
  {
    files: ['eslint.config.js', 'webpack.config.cjs', 'babel.config.cjs', 'jest.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        process: 'readonly',
      },
    },
    plugins: {
      import: pluginImport,
    },
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },

  eslintPluginPrettierRecommended,
];
