const assert      = require('chai').assert;
const cli = require('../');

describe('using tasks given as flags as before', function () {
    it.skip('uses the before tasks given in cli.flags' , function () {
        const runner = cli.getWatcher(['default'], {
            watch: {
                before: ['js'],
                default: {
                    "*.css": ["sass", "js"],
                    "*.js":  ["js"]
                },
                dev: {
                    "*.html": "html-min"
                }
            },
            tasks: {
                js: "test/fixtures/tasks/observable.js"
            }
        });

        assert.equal(runner.before.tasks.valid.length, 1);
        assert.equal(runner.before.tasks.valid[0].taskName, 'js');
        assert.equal(runner.before.tasks.valid[0].tasks[0].taskName, 'test/fixtures/tasks/observable.js');
    });
});
