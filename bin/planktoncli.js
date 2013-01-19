#!/usr/bin/env node

var program = require('commander');
var mkdirp = require('mkdirp');
var plankton = require('../');

program
    .version('0.0.0')
    .option('-source, --source [type]', 'Path to directory where posts are found')
    .option('-dest, --dest [type]', 'Path to directory where plankton will write files to')
    .parse(process.argv);


// first create destination directory if it does not exist
mkdirp(program.dest, function (err) {
    if (err) return console.error(err);

    console.log('Reading from ' + program.source + ' and publishing to ' + program.dest);
    console.log('Publishing the posts...');

    plankton.publish(program.source, program.dest, function(err) {
        if(err) return console.log(err);
        console.log('Done!');
    });
});

