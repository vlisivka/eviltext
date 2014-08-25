var fspath = require('path')

module.exports = function(klass, themeName, objectName, objectsName, themeDirectory){
  var proto = klass.prototype

  proto.copyAsset = function(srcPath, targetPath, ecb, cb){
    if(targetPath in this.buildEntries) cb()
    else {
      app.debug('[' + themeName + '] copying asset ' + srcPath)
      app.copyFile(srcPath, fspath.join(this.buildPath, targetPath), ecb, cb)
    }
  }

  proto.copyBaseThemeAssets = function(ecb, cb){
    var _this = this
    _({
      '/vendor/lazyload-2.0.5.js': '/vendor/lazyload-2.0.5.js',
      '/vendor/turbolinks-latest.js': '/vendor/turbolinks-latest.js',
      '/vendor/fastclick-0.6.7.js': '/vendor/fastclick-0.6.7.js',
      '/vendor/prettify/prettify.js': '/vendor/prettify/prettify.js',
      '/vendor/prettify/prettify.css': '/vendor/prettify/prettify.css',
    }).asyncEach(function(targetPath, srcPath, ecb, next){
      _this.copyAsset(app.pathUtil.join(__dirname, '/assets', srcPath)
      , _this.paths.asset(targetPath), ecb, next)
    }, ecb, cb)
  }

  var _imgStub = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
  var _formatDate = function(date, format){
    return date ? require('moment')(date).format(format) : ''
  }
  proto.addCommonAttributesAndHelpers = function(data, ecb, cb){
    var helpers = {
      imgStub            : _imgStub,
      formatDateForHuman : function(date){return _formatDate(date, 'MMMM DD, YYYY')},
      formatDateForWeb   : function(date){return _formatDate(date, 'YYYY-MM-DD')},
      paths              : this.paths,
      config             : this.config,
      navigation         : this.navigation,
      tagCloud           : this.tagCloud
    }
    data = _({}).extend(data, helpers)
    var _this = this
    var readHeadAndBottomCommons = function(cb){
      app.render(fspath.join(__dirname, 'templates', 'head-commons.html')
      , data, ecb, function(headCommons){
        app.render(fspath.join(__dirname, 'templates', 'bottom-commons.html')
        , data, ecb, function(bottomCommons){
          cb(headCommons, bottomCommons)
        })
      })
    }

    var _this = this
    readHeadAndBottomCommons(function(headCommons, bottomCommons){
      data.headCommons = headCommons
      data.bottomCommons = bottomCommons
      cb(data)
    })
  }

  proto.render = function(template, data, ecb, cb){
    app.debug('[' + themeName + '] rendering ' + template)
    this.addCommonAttributesAndHelpers(data, ecb, function(data){
      app.render(fspath.join(themeDirectory, 'templates', template), data, ecb, cb)
    })
  }

  proto.renderTo = function(template, data, path, ecb, cb){
    app.debug('[' + themeName + '] rendering ' + template + ' to ' + path)
    var _this = this
    this.addCommonAttributesAndHelpers(data, ecb, function(data){
      app.renderTo(fspath.join(themeDirectory, 'templates', template), data
      , fspath.join(_this.buildPath, path), ecb, cb)
    })
  }

}