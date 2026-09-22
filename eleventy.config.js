const { HtmlBasePlugin } = require("@11ty/eleventy");

// PATH_PREFIX задаёт GitHub Actions: сайт лежит в подпапке /<repo>/
const pathPrefix = process.env.PATH_PREFIX || "/";

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  // Лендинги эфиров: готовый HTML копируется как есть, без шаблонизатора
  eleventyConfig.addPassthroughCopy("src/neiroseti");
  eleventyConfig.ignores.add("src/neiroseti/**");
  eleventyConfig.addPlugin(HtmlBasePlugin);

  return {
    pathPrefix,
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
