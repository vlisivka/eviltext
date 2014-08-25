var fspath = require('path')

var Blog = module.exports = function(){this.initialize.apply(this, arguments)}
require('../base-application')(Blog, 'blog', __dirname)
var proto = Blog.prototype

Blog.defaultConfig = {
  theme      : 'svbtle',
  sortBy     : {attribute : 'date', order: 'descending'},
  tagsSortBy : {attribute : 'count', order: 'descending'}
}

proto.buildPaths = function(){
  var _this = this
  return {
    home: function(params){return app.path(_this.mountPath, params)},

    post: function(post, params){
      // return app.path(post.path, params)
      return app.path(post.basePath, params)
    },

    postJson: function(post, params){return app.path(post.path + '.post', params)},

    asset: function(path, params){return app.path('/assets' + path, params)},

    themeAsset: function(theme, path, params){
      return app.path('/assets/' + theme + path, params)
    },

    posts: function(params){
      var tag = null, page = null
      if(params && (params.page || params.tag || params.pagesCount)){
        params = _(params).clone()
        if(params.tag){
          tag = params.tag
          delete params.tag
        }
        if(params.page){
          page = params.page
          delete params.page
        }
        delete params.pagesCount
      }
      var path = _this.mountPath + (tag ? '-tag-' + tag : '')
      + (page ? (page == 1 ? '' : '-page-' + page) : '')
      return app.path(path, params)
    },

    nextPosts: function(params){
      params = params || {}
      if(!params.page) throw new Error("page parameter required!")
      if(!params.pagesCount) throw new Error("pagesCount parameter required!")
      return params.page < params.pagesCount ?
      this.posts(_({}).extend(params, {page: params.page + 1})) : null
    },
    previousPosts: function(params){
      params = params || {}
      if(!params.page) throw new Error("page parameter required!")
      if(!params.pagesCount) throw new Error("pagesCount parameter required!")
      return params.page > 1 ? this.posts(_({}).extend(params, {page: params.page - 1})) : null
    }
  }
}

proto.prepare = function(ecb, cb){
  app.debug('[blog] preparing ' + this.mountPath)
  var _this = this
  this.loadObjects('post', 'posts', ecb, function(objects){
    _this.posts = objects
    _this.preparePosts(ecb, function(){
      _this.posts = _this.sortAndPaginateObjects(_this.posts, 'posts')
      _this.prepareTagCloud()
      _this.prepareNavigation()
      cb(_this)
    })
  })
}

proto.generate = function(ecb, cb){
  app.debug('[blog] generating ' + this.mountPath)
  var _this = this
  this.updateIfNeeded(ecb, function(){
    _this.prepare(ecb, function(){
      _this.generatePostCollection(ecb, function(){
        _this.generatePostCollectionsByTag(ecb, function(){
          app.debug('[blog] generating posts for ' + _this.mountPath)
          _(_this.posts).asyncEach(function(post, i, ecb, next){
            _this.generatePost(post, ecb, next)
          }, ecb, function(){
            _this.theme().generate(ecb, function(){
              _this.finalize(ecb, cb)
            })
          })
        })
      })
    })
  }, cb)
}

// proto.generateRedirectFromRoot = function(ecb, cb){
//   this.renderTo('redirect-page.html', {name: 'Posts', path: '/posts'}
//   , fspath.join(this.mountPath, 'index.html'), ecb, cb)
// }

proto.generatePostCollection = function(ecb, cb){
  app.debug('[blog] generating post collection for ' + this.mountPath)

  // Generating JSON.
  var _this = this
  var json = {
    tagCloud    : this.tagCloud,
    navigation  : this.navigation,
    config      : this.config,
    posts       : _(this.posts).map(function(post){
      return {
        title : post.title,
        path  : _this.paths.post(post),
        type  : post.type,
        date  : post.date,
        tags  : post.tags
      }
    })
  }

  app.writeJson(fspath.join(this.buildPath, this.paths.home({format: 'json'})), json, ecb, function(){

    // Generating HTML.
    var pages = _this.paginate(_this.posts)

    _(pages).asyncEach(function(page, i, ecb, next){
      _this.theme().generatePostCollection(null, i + 1, pages.length, page, ecb, next)
    }, ecb, cb)
  })
}

proto.generatePostCollectionsByTag = function(ecb, cb){
  app.debug('[blog] generating post collections by tags for ' + this.mountPath + ' in json')

  var tagCloud = this.tagCloud.slice(0, this.config.tagCount)
  var _this = this
  _(tagCloud).asyncEach(function(item, i, ecb, next){
    var postsByTag = _(_this.posts).filter(function(post){return post.tags.indexOf(item.name) >= 0})
    var pages = _this.paginate(postsByTag)
    _(pages).asyncEach(function(page, i, ecb, next){
      _this.theme().generatePostCollection(item.name, i + 1, pages.length, page, ecb, next)
    }, ecb, next)
  }, ecb, cb)
}

proto.generatePost = function(post, ecb, cb){
  app.debug('[blog] generating post ' + post.path)

  // Generating JSON.
  var _this = this
  app.writeJson(fspath.join(this.buildPath, _this.paths.postJson(post, {format: 'json'}))
  , post, ecb, function(){

    // Generating HTML.
    _this.theme().generatePost(post, ecb, cb)
  })
}

proto.preparePosts = function(ecb, cb){
  // Preparing posts.
  app.debug('[blog] preparing posts for ' + this.mountPath)
  var _this = this
  var preparedPosts = []
  _(this.posts).asyncEach(function(post, i, ecb, next){
    _this.preparePost(post, ecb, function(skip, post){
      if(!skip) preparedPosts.push(post)
      next()
    })
  }, ecb, function(){
    _this.posts = preparedPosts
    cb()
  })
}

proto.preparePost = function(post, ecb, cb){
  app.debug('[blog] preparing post ' + post.path)

  _(post).extendIfBlank({
    tags : [],
    date : null
  })

  if(_(post.html).isPresent()) post.type = 'text'
  else this.tryPrepareGallery(post)
  cb(_(post.type).isBlank(), post)
}