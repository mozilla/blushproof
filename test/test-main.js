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
};

require("test").run(exports);
