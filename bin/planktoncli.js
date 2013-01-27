#!/usr/bin/env node

var program = require('commander');
var mkdirp = require('mkdirp');
var plankton = require('../');

program
    .version('0.0.0')
    .option('-src, --src [type]', 'Path to directory where posts are found')
    .option('-dest, --dest [type]', 'Path to directory where plankton will write files to')
    .parse(process.argv);

if(!program.hasOwnProperty('src') || !program.hasOwnProperty('dest')) {
    program.outputHelp();
    return;
}

// first create destination directory if it does not exist
mkdirp(program.dest, function (err) {
    if (err) return console.error(err);

    console.log('Reading from ' + program.src + ' and publishing to ' + program.dest + " ...");

    plankton.publish(program.src, program.dest, function(err) {
        // callback(null) is called once after all the posts are published or
        // callback(err) is called once for each error that occurs
        if(err) return console.log(err);
        else {
            console.log('Done.');
        }
    });
});


