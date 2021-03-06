var Clean = module.exports = function(){this.initialize.apply(this, arguments)}
var proto = Clean.prototype
var themeName = 'wiki-clean-theme'
require('../base-theme')(Clean, themeName, 'page', 'pages', __dirname)

Clean.defaultConfig = {
  charset        : 'utf-8',
  perPage        : 25,
  previewLengths : {
    default: 400
  },
  tagCount       : 7,
  imageFormats   : {
    default: '704'
  }
}

proto.generate = function(ecb, cb){
  var _this = this
  this.copyBaseAssets(ecb, function(){
    _this.copyAsset(__dirname, themeName, '/style.css', ecb, cb)
  })
}

proto.generatePage = function(page, ecb, cb){
  var _this = this
  var target = this.paths.page(page, {format: 'html'})
  app.debug('[wiki-clean-theme] generating page ' + target)
  _this.renderTo('/page.html', {
    title        : page.title,
    currentPath  : this.paths.page(page),
    page         : page,
    themeName    : themeName,
    layout       : '/layout.html',
    showComments : (('comments' in page) ? page.comments : _this.config.comments)
  }, target, ecb, cb)
}

proto.generatePageCollection = function(tag, page, pagesCount, pages, ecb, cb){
  var target = this.paths.pages({tag: tag, page: page, format: 'html'})
  app.debug('[wiki-clean-theme] generating page collection, page ' + page + ' to ' + target)
  this.renderTo('/pages.html', {
    title        : this.config.title,
    date         : _(pages).max(function(page){return page.date}).date,
    pages        : pages,
    nextPath     : this.paths.nextPages({tag: tag, page: page, pagesCount: pagesCount}),
    previousPath : this.paths.previousPages({tag: tag, page: page, pagesCount: pagesCount}),
    currentPath  : this.paths.pages({tag: tag, page: page}),
    themeName    : themeName,
    layout       : '/layout.html'
  }, target, ecb, cb)
}