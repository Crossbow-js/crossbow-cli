var write   = require('fs').writeFileSync;
var read    = require('fs').readFileSync;
var mkdirp  = require('mkdirp');
var resolve = require('path').resolve;
var exists  = require('fs').existsSync;
var dirname = require('path').dirname;
var objPath = require('object-path');
var vfs     = require('vinyl-fs');

module.exports = function (opts) {

    opts        = opts        || {};
    opts.cwd    = opts.cwd    || process.cwd();
    opts.config = opts.config || opts.crossbow.config || {};

    var options = Object.keys(opts.config).reduce(function (obj, key) {
        if (!obj[key]) {
            obj[key] = opts.config[key].options;
        }
        return obj;
    }, {});

    function getLookup () {

        var args = Array.prototype.slice.call(arguments);

        var lookup = args[0];

        if (!lookup.match(/\./) && !Array.isArray(lookup)) {
            lookup = args;
        }

        return lookup;
    }

    var optObj = objPath(options);

    var ctx = {
        exists: function(path) {
            return exists(resolve(opts.cwd, path));
        },
        resolve: function (path) {
            return resolve(opts.cwd, path);
        },
        get: function () {
            return objPath.get(opts.crossbow, getLookup.apply(null, arguments));
        },
        options: optObj,
        opts: opts,
        vfs: vfs,
        path: {
            /**
             * Look up paths such as sass.root
             * @returns {*}
             */
            make: function (path) {
                return resolve(opts.cwd, path);
            }
        },
        file: {
            /**
             * Write a file using path lookup
             * @param filepath
             * @param content
             */
            write: function (filepath, content) {
                var outpath = ctx.path.make(filepath);
                mkdirp.sync(dirname(outpath));
                write(outpath, content);
            },
            _write: function (filepath, content) {
                mkdirp.sync(dirname(filepath));
                write(filepath, content);
            },
            /**
             * Write a file using path lookup
             * @param filepath
             */
            read: function (filepath) {
                var inpath = ctx.path.make(filepath);
                return read(inpath, 'utf-8');
            }
        },
        config: opts.config,
        paths: opts.config,
        root: process.cwd(),
        crossbow: opts.crossbow,
        mkdirp: mkdirp,
        trigger: {}
    };

    return ctx;
};
