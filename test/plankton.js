var assert = require('assert');
var plankton = require('../');

describe('Plankton', function() {

    it('should parse the text of a article', function(done) {
        var post = plankton.parsePost('---\ntitle: Foo bar\nauthor: Kishore Nallan\n---\n\nPara 1\nPara 2\n');
        assert.equal(post.title, "Foo bar");
        assert.equal(post.author, "Kishore Nallan");
        assert.equal(post.body, "\n\nPara 1\nPara 2\n");
        done();
    });

    it('should publish posts', function(done) {
        plankton.publish('');
    });
});
