const { HtmlBasePlugin } = require("@11ty/eleventy");

// PATH_PREFIX задаёт GitHub Actions: сайт лежит в подпапке /<repo>/
const pathPrefix = process.env.PATH_PREFIX || "/";

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
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
