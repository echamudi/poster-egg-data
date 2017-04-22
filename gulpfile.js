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

    // List all folders to get packNames
    fs.readdir(mainDir, (err, packNames) => {

        // .pack extensions only
        packNames = packNames.filter((string) => /\.(pack)$/i.test(string) ? string : 0);

        // Read each pack name and push processed data to finalDesignList
        packNames.forEach((packName) => {

            // read _data.json file in the pack
            var packData = JSON.parse(fs.readFileSync(mainDir + packName + '/_data.json'));

            // add folder name as ID
            packData.packID = packName.slice(0, -5);

            // shift by -1 to fit array key
            var packOrder = packData.order - 1;

            // "order" property is not important now
            delete packData.order;

            // add current pack data to final design list
            finalDesignList[packOrder] = packData;

            // design list property
            finalDesignList[packOrder].designs = [];

            // look for the designs themselves, read all files inside the pack folder
            fs.readdir(mainDir + '/' + packName, (err, packContents) => {

                // .template.json extensions only
                packContents = packContents.filter((string) => /\.(template\.json)$/i.test(string) ? string : 0);

                packContents.forEach((fileName) => {

                    // read *.template.json
                    var designData = JSON.parse(fs.readFileSync(mainDir + packName + '/' + fileName));

                    // add json file name
                    designData.designID = fileName.replace(/.template.json/g, '');

                    // shift by -1 to fit array key
                    var designOrder = designData.order - 1;

                    // "order" property is not important now
                    delete designData.order;

                    writeFile("dist/data/design-packs/" + packName + '/' + fileName, JSON.stringify(designData));

                    // "designProperties" property is not required
                    delete designData.designProperties;

                    finalDesignList[packOrder].designs[designOrder] = designData;
                });

                // write it

                writeFile("dist/data/all-packs.json", JSON.stringify(finalDesignList));
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

