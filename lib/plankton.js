var path = require('path');
var fs = require('fs');
var ejs = require('ejs');
var yaml = require('js-yaml');
var mkdirp = require('mkdirp');
var marked = require('marked');
var moment = require('moment');

var constants = require('../constants');
var defaults = require('../defaults');

function Plankton() {
  
}

function pad(numToPad, numDigits){
    return(1e15+numToPad+"").slice(-numDigits)
}

Plankton.prototype.parsePost = function(text) {
    var containsFrontMatter = (text.substring(0, 3) === defaults.FRONT_MATTER_DELIMETER);
    if(containsFrontMatter) {
        var parts = text.split(defaults.FRONT_MATTER_DELIMETER);
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
    this.userConfig = JSON.parse(fs.readFileSync(path.join(sourceDir, defaults.USER_CONFIG_FILE), 'utf-8'));
    var posts = [];

    var pathToPosts = path.join(sourceDir, defaults.POSTS_DIRECTORY);
    var self = this;

    fs.readdir(pathToPosts, function(err, files) {
        if(err) return callback(err);

        var count = 0;
        files.forEach(function(fileName) {
            var pathToFile = path.join(sourceDir, defaults.POSTS_DIRECTORY, fileName);
            fs.readFile(pathToFile, 'utf-8', function(err, text) {
                if(err) return callback(err);

                var post = self.parsePost(text);
                var extName = path.extname(fileName);

                post.fileName = fileName;
                if(extName === constants.MARKDOWN_EXTENSION) {
                    post.body = marked(post.body);
                    post.fileType = constants.MARKDOWN_EXTENSION;
                } else {
                    // treated as html ejs template
                    post.fileType = constants.HTML_EXTENSION;
                }

                posts.push(post);

                if(++count === files.length) {
                    self.publishPosts(posts, callback);
                }
            });
        });
    });
}

function getDestinationFilePath(destDir, post) {
    var urlSlug = "";
    var fileNameWithoutExt = post.fileName.replace(path.extname(post.fileName),'');

    if(post.hasOwnProperty(constants.DATE_PROPERTY)) {
        var date = moment(post[constants.DATE_PROPERTY]);
        var month = pad(date.month()+1, 2);  // month is zero indexed
        var day = pad(date.date(), 2);
        var year = date.year();
        urlSlug = defaults.PERMALINK
                  .replace(constants.SLUG_MONTH, month)
                  .replace(constants.SLUG_DAY, day)
                  .replace(constants.SLUG_YEAR, year)
                  .replace(constants.SLUG_TITLE, fileNameWithoutExt);
    } else {
        urlSlug = fileNameWithoutExt + constants.HTML_EXTENSION;
    }

    return path.join(destDir, urlSlug);
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
    var templatePath = path.join(this.sourceDir, defaults.LAYOUTS_DIRECTORY, post.layout+constants.HTML_EXTENSION);
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
    if(post.fileType == constants.HTML_EXTENSION) {
        post.body = ejs.render(post.body, {posts: posts, post: post});
    }

    if(post.hasOwnProperty('layout')) {
        post = this.renderPost(posts, post);
        var destPath = getDestinationFilePath(this.destDir, post);

        // first create directory if needed
        var destDirPath = path.dirname(destPath);
        mkdirp(destDirPath, function (mkdirErr) {
            if(mkdirErr) return callback(mkdirErr);
            fs.writeFile(destPath, post.body, function(err) {
                if(err) return callback(err);
                return callback(null);
            });
        });
    }
}

module.exports = new Plankton();