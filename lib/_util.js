module.exports = (function(){
  try {
    return require("util");
  } catch (e) {
    return require("sys");
  }
})();