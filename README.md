# Plankton - a static blog generator for node

Plankton uses markdown files as source and EJS templates for layout.

## Getting started

Install using NPM:

    $ npm install -g plankton

Blog posts are markdown files which contain a YAML front-matter. For example:

    ---
    title: Ipsum
    author: Kishore Nallan
    date: January 26, 2013
    published: true
    layout: post
    ---

    This is *some* text. First para here.

    Second para is _right_ here!

The YAML front-matter allows you to define the following post-level properties:

* `title` - The title of the post. Note that this is NOT used to generate the URL slug. The URL slug is generated
using the original name of the markdown file.
* `author` - Author of the post.
* `date` - The date the blog post was written.
* `published` - Set this to `false` if you don't want to publish a post (e.g. if it's still in a draft form).

Place your markdown files in a `_posts` folder and your EJS template files in a `_layouts` folder. A EJS template
itself can contain a YAML font-matter that specifies a parent template. For example:

    ---
    layout: wrapper
    ---
    <h1>Post page</h1>
    <h2><%= post.title %></h2>
    <%- post.body %>

The EJS template has access to the following template variables:

* `posts` - An array of all posts parsed from the `_posts` directory.
* `post` - The actual post. `post.body` contains the post text and `post.title` contains the title of the post. You can
also access all other properties specified in the YAML front-matter as properties of the `post` object.
* `content` - If a template file specifies another template as a layout, the referred layout file get the contents
of the subview as the `content` variable.

## Publishing the site

To publish the site, call plankton from the command-line:

    $ plankton --src=./example --dest=./out

Check out the the `/example` folder to see a bare-bones example.

## Todo

* Pagination
* Tags