module.exports = function (api) {
  api.cache(true);
  const path = require("path");
  const preset = require.resolve("babel-preset-expo", { paths: [__dirname, path.join(__dirname, "..", "..")] });
  return {
    presets: [preset]
  };
};
