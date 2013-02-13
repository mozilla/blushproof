let main = require("main");
let bpUtil = require("bpUtil");

exports["test main"] = function(assert) {
  let filter = new ArrayBuffer(1024);
  assert.ok(!bpUtil.probeBloomFilter(filter, "asdf"), "'asdf' shouldn't be in yet");
  bpUtil.addToBloomFilter(filter, "asdf");
  assert.ok(bpUtil.probeBloomFilter(filter, "asdf"), "'asdf' should be in now");
  assert.ok(!bpUtil.probeBloomFilter(filter, "fsda"), "'fsda' shouldn't be in yet");
  bpUtil.addToBloomFilter(filter, "fsda");
  bpUtil.addToBloomFilter(filter, "anatidaeAnseriformes");
  bpUtil.addToBloomFilter(filter, "Donaudampfschiffahrtsgesellschaftskapitän");
  assert.ok(bpUtil.probeBloomFilter(filter, "asdf"), "'asdf' should still be in");
  assert.ok(bpUtil.probeBloomFilter(filter, "fsda"), "'fsda' should be in now");

  for (let i = 0; i < 778; i++) {
    assert.ok(!bpUtil.probeBloomFilter(filter, String(i)), i + " not yet in");
    bpUtil.addToBloomFilter(filter, String(i));
    assert.ok(bpUtil.probeBloomFilter(filter, String(i)), i + " now in");
  }
  assert.ok(bpUtil.probeBloomFilter(filter, "778"), "we get a false positive at 778");
};

require("test").run(exports);
