// This is a sample unit test.
var assert = require('chai').assert;

describe('math module', function(){
    it('should add numbers', function () {
        assert.equal((1+1), '2');
        assert.strictEqual(127 + 319, 446);
    });

    it('should sub numbers', function () {
        assert.equal((22-1), '21');
        assert.strictEqual(127 - 7, 120);
    });
});