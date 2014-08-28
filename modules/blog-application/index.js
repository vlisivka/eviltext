var fspath = require('path')

var Blog = module.exports = function(){this.initialize.apply(this, arguments)}
require('../base-application')(Blog, 'blog', __dirname)
var proto = Blog.prototype

Blog.defaultConfig = {
  language   : 'en',
  theme      : 'svbtle',
  sortBy     : {attribute : 'date', order: 'descending'},
  tagsSortBy : {attribute : 'count', order: 'descending'}
}

proto.buildPaths = function(){
  var _this = this
  return _({}).extend(this.buildBasePaths(), {
    post: function(post, params){return app.path(post.basePath, params)},

    posts: function(params){
      return _this.pathWithTagsAndPage(app.pathUtil.join(_this.mountPath, '/posts'), params)
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
  })
}

proto.prepare = function(ecb, cb){
  app.debug('[blog] preparing ' + this.mountPath)
  var _this = this
  this.loadObjects('post', 'posts', ecb, function(objects){
    _this.posts = objects
    _this.preparePosts(ecb, function(){
      _this.posts = _this.sortAndPaginateObjects(_this.posts, 'posts')
      _this.publishedPosts = _this.publishedObjects(_this.posts)
      _this.prepareTagCloud(_this.posts)
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
      _this.generateRedirectToHomePage(_this.paths.posts(), ecb, function(){
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
    })
  }, cb)
}

proto.generatePostCollection = function(ecb, cb){
  app.debug('[blog] generating post collection for ' + this.mountPath)
  var pages = this.paginate(this.publishedPosts)
  var _this = this
  _(pages).asyncEach(function(page, i, ecb, next){
    _this.theme().generatePostCollection(null, i + 1, pages.length, page, ecb, next)
  }, ecb, cb)

  // // Generating JSON.
  // var json = {
  //   tagCloud    : this.tagCloud,
  //   navigation  : this.navigation,
  //   config      : this.config,
  //   posts       : _(this.posts).map(function(post){
  //     return {
  //       title : post.title,
  //       path  : _this.paths.post(post),
  //       type  : post.type,
  //       date  : post.date,
  //       tags  : post.tags
  //     }
  //   })
  // }
  //
  // app.writeJson(fspath.join(this.buildPath, this.paths.home({format: 'json'})), json, ecb, function(){
  //
  // })
}

proto.generatePostCollectionsByTag = function(ecb, cb){
  app.debug('[blog] generating post collections by tags for ' + this.mountPath)
  var tagCloud = this.tagCloud.slice(0, this.config.tagCount)
  var _this = this
  _(tagCloud).asyncEach(function(item, i, ecb, next){
    var postsByTag = _(_this.publishedPosts).filter(function(post){
      return post.tags.indexOf(item.name) >= 0
    })
    var pages = _this.paginate(postsByTag)
    _(pages).asyncEach(function(page, i, ecb, next){
      _this.theme().generatePostCollection(item.name, i + 1, pages.length, page, ecb, next)
    }, ecb, next)
  }, ecb, cb)
}

proto.generatePost = function(post, ecb, cb){
  app.debug('[blog] generating post ' + post.path)
  this.theme().generatePost(post, ecb, cb)

  // // Generating JSON.
  // var _this = this
  // app.writeJson(fspath.join(this.buildPath, _this.paths.postJson(post, {format: 'json'}))
  // , post, ecb, function(){
  //
  // })
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