var path = require('path');
var fs = require('fs');
var ejs = require('ejs');
var yaml = require('js-yaml');
var mkdirp = require('mkdirp');
var marked = require('marked');
var moment = require('moment');
var ncp = require('ncp').ncp;

var constants = require('../constants');
var defaults = require('../defaults');

function Plankton() {
  
}

// add custom EJS filter since EJS has no helper for formatting date
ejs.filters.formatDate = function(ts, format) {
    return moment(ts).format(format);
};

function pad(numToPad, numDigits){
    return(1e15+numToPad+"").slice(-numDigits)
}

function sortPostsByTimestamp(posts) {
    posts.sort(function(post1, post2) {
       return -1 * (post1[constants.TIMESTAMP_GENERATED_PROPERTY] - post2[constants.TIMESTAMP_GENERATED_PROPERTY]);
    });
}

Plankton.prototype.parsePost = function(text) {
    var containsFrontMatter = (text.substring(0, 3) === defaults.FRONT_MATTER_DELIMETER);
    if(containsFrontMatter) {
        var parts = text.split(defaults.FRONT_MATTER_DELIMETER);
        var post = yaml.load(parts[1]);
        post[constants.BODY_PROPERTY] = parts[2];
    } else {
        var post = {};
        post[constants.BODY_PROPERTY] = text;
    }

    if(post.hasOwnProperty(constants.DATE_PROPERTY)) {
        post[constants.TIMESTAMP_GENERATED_PROPERTY] = moment(post[constants.DATE_PROPERTY]).valueOf();
    } else {
        post[constants.TIMESTAMP_GENERATED_PROPERTY] = constants.DEFAULT_TIMESTAMP;
    }

    return post;
}

function mergeProps(defaultProps, userProps) {
    for(var attrName in userProps) {
        defaultProps[attrName] = userProps[attrName];
    }
}

Plankton.prototype.writeStaticAssets = function(sourceDir, destDir) {
    ncp.limit = 16;

    function shouldCopyThis(filePath) {
        return filePath.indexOf(defaults.LAYOUTS_DIRECTORY) === -1 &&
               filePath.indexOf(defaults.POSTS_DIRECTORY) === -1 &&
               filePath.indexOf(defaults.USER_CONFIG_FILE) === -1;
    }

    ncp(sourceDir, destDir, {filter: shouldCopyThis}, function (err) {
        if (err) {
            return console.error(err);
        }
        console.log('Finished copying all static files.');
    });
}

Plankton.prototype.publish = function(sourceDir, destDir, callback) {
    this.sourceDir = sourceDir;
    this.destDir = destDir;

    var userConfig = JSON.parse(fs.readFileSync(path.join(sourceDir, defaults.USER_CONFIG_FILE), 'utf-8'));
    mergeProps(defaults, userConfig);

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
                    post[constants.BODY_PROPERTY] = marked(post[constants.BODY_PROPERTY]);
                    post.fileType = constants.MARKDOWN_EXTENSION;
                } else if(extName === constants.HTML_EXTENSION) {
                    // treated as html ejs template
                    post.fileType = constants.HTML_EXTENSION;
                } else {
                    // ignore any other file type present in the posts directory
                    return ;
                }

                if(!isADraft(post)) {
                    posts.push(post);
                }

                if(++count === files.length) {
                    sortPostsByTimestamp(posts);
                    self.publishPosts(posts, callback);
                    self.writeStaticAssets(sourceDir, destDir);
                }
            });
        });
    });
}

function getDestinationFilePath(destDir, post) {
    var urlSlug = "";
    var fileNameWithoutExt = post.fileName.replace(path.extname(post.fileName),'');

    if(post.hasOwnProperty(constants.DATE_PROPERTY)) {
        var date = moment(post[constants.TIMESTAMP_GENERATED_PROPERTY]);
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
    var postsCount = 0;
    posts.forEach(function(post) {
        this.publishPost(posts, post, function(err) {
            if(err) return callback(err);
            if(posts.length === ++postsCount) {
                callback(null);
            }
        });
    }, this);
}

// recursively look-up templates and render the post
Plankton.prototype.renderPost = function(posts, post, callback) {
    var templatePath = path.join(this.sourceDir, defaults.LAYOUTS_DIRECTORY, post[constants.LAYOUT_PROPERTY] +
                                 constants.HTML_EXTENSION);
    var templateText = fs.readFileSync(templatePath, 'utf-8');
    var template = this.parsePost(templateText);

    post[constants.BODY_PROPERTY] = ejs.render(template[constants.BODY_PROPERTY],
                                               {posts: posts, post: post, content: post[constants.BODY_PROPERTY]});

    if(template.hasOwnProperty('layout')) {
        post[constants.LAYOUT_PROPERTY] = template[constants.LAYOUT_PROPERTY];
        return this.renderPost(posts, post, callback);
    } else {
        return post;
    }
}

function isADraft(post) {
    return post.hasOwnProperty(constants.PUBLISHED_PROPERTY) && post[constants.PUBLISHED_PROPERTY] === false;
}

Plankton.prototype.publishPost = function(posts, post, callback) {

    // the post itself might be a ejs template
    if(post.fileType == constants.HTML_EXTENSION) {
        post[constants.BODY_PROPERTY] = ejs.render(post[constants.BODY_PROPERTY], {posts: posts, post: post});
    }

    if(post.hasOwnProperty('layout')) {
        post = this.renderPost(posts, post);
        var destPath = getDestinationFilePath(this.destDir, post);

        // first create directory if needed
        var destDirPath = path.dirname(destPath);
        mkdirp(destDirPath, function (mkdirErr) {
            if(mkdirErr) return callback(mkdirErr);
            fs.writeFile(destPath, post[constants.BODY_PROPERTY], function(err) {
                if(err) return callback(err);
                return callback(null);
            });
        });
    }
}

module.exports = new Plankton();