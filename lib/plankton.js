var path = require('path');
var fs = require('fs');
var ejs = require('ejs');
var yaml = require('js-yaml');
var marked = require('marked');
var config = require('../config')

function Plankton() {
  
}

Plankton.prototype.parsePost = function(text) {
    var containsFrontMatter = (text.substring(0, 3) === config.FRONT_MATTER_DELIMETER);
    if(containsFrontMatter) {
        var parts = text.split(config.FRONT_MATTER_DELIMETER);
        var post = yaml.load(parts[1]);
        post.body = parts[2];
    } else {
        var post = {};
        post.body = text;
    }

    return post;
}

Plankton.prototype.publish = function(sourceDir, destDir, callback) {
    this.sourceDir = sourceDir;
    this.destDir = destDir;
    var posts = [];

    var pathToPosts = path.join(sourceDir, config.POSTS_DIRECTORY);
    var self = this;

    fs.readdir(pathToPosts, function(err, files) {
        if(err) return callback(err);

        var count = 0;
        files.forEach(function(fileName) {
            var pathToFile = path.join(sourceDir, config.POSTS_DIRECTORY, fileName);
            fs.readFile(pathToFile, 'utf-8', function(err, text) {
                if(err) return callback(err);

                var post = self.parsePost(text);
                var extName = path.extname(fileName);

                post.fileName = fileName;
                if(extName === config.MARKDOWN_EXTENSION) {
                    post.body = marked(post.body);
                    post.fileType = config.MARKDOWN_EXTENSION;
                } else {
                    // treated as html ejs template
                    post.fileType = config.HTML_EXTENSION;
                }

                posts.push(post);

                if(++count === files.length) {
                    self.publishPosts(posts, callback);
                }
            });
        });
    });
}

function getDestinationFilePath(destDir, fileName) {
    var pathToFile = path.join(destDir, fileName)
    // convert file extension to html
    var parts = pathToFile.split('.');
    parts[parts.length - 1] = 'html';
    return parts.join('.');
}

Plankton.prototype.publishPosts = function(posts, callback) {
    posts.forEach(function(post) {
        this.publishPost(posts, post, function(err) {
            if(err) return callback(err);
            callback(null);
        });
    }, this);
}

// recursively look-up templates and render the post
Plankton.prototype.renderPost = function(posts, post, callback) {
    var templatePath = path.join(this.sourceDir, config.LAYOUTS_DIRECTORY, post.layout+config.HTML_EXTENSION);
    var templateText = fs.readFileSync(templatePath, 'utf-8');
    var template = this.parsePost(templateText);
    post.body = ejs.render(template.body, {posts: posts, post: post, content: post.body});

    if(template.hasOwnProperty('layout')) {
        post.layout = template.layout;
        return this.renderPost(posts, post, callback);
    } else {
        return post;
    }
}

Plankton.prototype.publishPost = function(posts, post, callback) {
    // the post itself might be a ejs template
    if(post.fileType == config.HTML_EXTENSION) {
        post.body = ejs.render(post.body, {posts: posts, post: post});
    }

    if(post.hasOwnProperty('layout')) {
        post = this.renderPost(posts, post);
        var destPath = getDestinationFilePath(this.destDir, post.fileName);
        fs.writeFile(destPath, post.body, function(err) {
            if(err) return callback(err);
            return callback(null);
        });
    }
}

module.exports = new Plankton();