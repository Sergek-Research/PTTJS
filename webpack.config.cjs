const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.js', // Точка входа
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? 'pttjs.umd.min.js' : 'pttjs.umd.js',
      library: {
        name: 'pttjs', // Имя глобальной переменной, например window.pttjs
        type: 'umd', // Тип бандла (Universal Module Definition)
        umdNamedDefine: true,
      },
      // Позволяет UMD работать корректно в браузере и Node.js
      globalObject: '(typeof self !== "undefined" ? self : this)',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            // Используем babel-loader для транспиляции JS файлов
            // Он будет использовать babel.config.cjs
            loader: 'babel-loader',
          },
        },
      ],
    },
    // Генерируем sourcemaps для отладки
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    optimization: {
      minimize: isProduction, // Минимизировать только в production режиме
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true, // Удалить console.log в production сборке
            },
            format: {
              comments: false, // Удалить комментарии
            },
          },
          extractComments: false, // Не извлекать комментарии в отдельный файл
        }),
      ],
    },
  };
};
