'use strict';

/*
 * ------------------------------------------------------------------------
 * Requires
 * ------------------------------------------------------------------------
 */

// Node JS

const fs = require('fs');
const mkdirp = require('mkdirp');
var path = require('path');

// Gulps
const connect = require("gulp-connect");
const copy = require('gulp-copy');
const debug = require('gulp-debug');
const del = require('del');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const gutil = require("gulp-util");
const pug = require('gulp-pug');
const run = require('gulp-run');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const yargs = require('yargs');
const cors = require('cors');

// For Post-CSS
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');

/**
 * ------------------------------------------------------------------------
 * Vars
 * ------------------------------------------------------------------------
 */

const argv = yargs.argv;
const hostPort = 60572;
let minify = false; // True : Enable minify on all files
let maps = true; // True : Create source maps

// Prevents task to stop being watched on error
function swallowError(error) {
    gutil.log(error)
    this.emit('end')
}

// writeFile

function writeFile(filepath, contents, cb) {
    mkdirp(path.dirname(filepath), function (err) {
        if (err) return cb(err);

        fs.writeFile(filepath, contents, function (err) {
            if (err) {
                return console.log(err);
            }
        });
    });
}

/**
 * ------------------------------------------------------------------------
 * Tasks
 * ------------------------------------------------------------------------
 */

gulp.task('pug', () => {
    const options = {
        pretty: !minify
    };

    return gulp.src('src/**/[^_]*.pug')
        .pipe(pug(options))
        .on('error', swallowError)
        .pipe(gulp.dest('dist'));
});

gulp.task('sass', () => {
    const options = {
        outputStyle: minify ? 'compressed' : 'nested'
    };

    const plugins = [
        autoprefixer({ browsers: ['chrome >= 36', 'firefox >= 45'] })
    ];

    return gulp.src('src/**/*.scss')

        // New sourcemaps, loading inline sourcemap from Sass' sourcemap.
        .pipe(gulpif(maps, sourcemaps.init()))

        // Compile SASS.
        .pipe(sass(options).on('error', sass.logError))

        // Run compiled CSS through autoprefixer.
        .pipe(postcss(plugins))

        // Write sourcemap to a separate file.        
        .pipe(gulpif(maps, sourcemaps.write('./maps')))

        // Write CSS file to desitination path.
        .pipe(gulp.dest('dist'));
});

gulp.task('design-assets', () => {
    return gulp
        .src(['src/data/design-assets/**/*'])
        .pipe(copy('dist/', { prefix: 1 }))
});

gulp.task('all-designs-json', () => {

    var mainDir = 'src/data/design-packs/';

    var finalDesignList = [];

    // List all folders to get groupNames
    fs.readdir(mainDir, (err, groupNames) => {

        // .pack extensions only
        groupNames = groupNames.filter((string) => /\.(pack)$/i.test(string) ? string : 0);

        // Read each group name and push processed data to finalDesignList
        groupNames.forEach((groupName) => {

            // read _data.json file in the group
            var groupData = JSON.parse(fs.readFileSync(mainDir + groupName + '/_data.json'));

            // add folder name as ID
            groupData.groupID = groupName.slice(0, -5);

            // shift by -1 to fit array key
            var groupOrder = groupData.order - 1;

            // "order" property is not important now
            delete groupData.order;

            // add current group data to final design list
            finalDesignList[groupOrder] = groupData;

            // design list property
            finalDesignList[groupOrder].designs = [];

            // look for the designs themselves, read all files inside the group folder
            fs.readdir(mainDir + '/' + groupName, (err, groupContents) => {

                // .template.json extensions only
                groupContents = groupContents.filter((string) => /\.(template\.json)$/i.test(string) ? string : 0);

                groupContents.forEach((fileName) => {

                    // read *.template.json
                    var designData = JSON.parse(fs.readFileSync(mainDir + groupName + '/' + fileName));

                    // add json file name
                    designData.designID = fileName.replace(/.template.json/g, '');

                    // shift by -1 to fit array key
                    var designOrder = designData.order - 1;

                    // "order" property is not important now
                    delete designData.order;

                    writeFile("dist/data/design-packs/" + groupName + '/' + fileName, JSON.stringify(designData));

                    // "designProperties" property is not required
                    delete designData.designProperties;

                    finalDesignList[groupOrder].designs[designOrder] = designData;
                });

                // write it

                writeFile("dist/data/all-designs.json", JSON.stringify(finalDesignList));
            });
        });
    });
});

/**
 * ------------------------------------------------------------------------
 * Other tasks
 * ------------------------------------------------------------------------
 */

gulp.task('connect', () => {
    connect.server({
        root: ['dist'],
        port: hostPort,
        https: false,
        middleware: function() {
            return [cors()];
        }
    })
});

gulp.task('clean', () => {
    return del([
        'dist'
    ]);
});

/**
 * ------------------------------------------------------------------------
 * Executor
 * ------------------------------------------------------------------------
 * $ gulp build : Build once
 * $ gulp       : Build and watch
 */


gulp.task('build', ['clean'], () => {
    gulp.start('pug');
    gulp.start('sass');
    gulp.start('design-assets');
    gulp.start('all-designs-json');
});

gulp.task('build-prod', ['clean'], () => {
    minify = true;
    maps = false;
    
    gulp.start('build');
});

gulp.task('default', ['clean'], () => {

    // Initial Executes
    gulp.start('pug');
    gulp.start('sass');
    gulp.start('design-assets');
    gulp.start('all-designs-json');

    // Enable Watches
    gulp.watch('src/**/*.pug', ['pug']);
    gulp.watch('src/**/*.scss', ['sass']);
    gulp.watch('src/data/design-assets/**/*', ['design-assets']);
    gulp.watch('src/data/design-packs/**/*.json', ['all-designs-json']);

    // Connect
    gulp.start('connect');
});

