test([
  'var a = Buffer(3)',

  'a.writeInt8(123, 0)',
  'a.writeInt8(-12, 1)',
  'a.writeUInt8(234, 2)'
], [
  'a.readInt8(0) == 123',
  'a.readInt8(1) == -12',
  'a.readUInt8(0) == 123',
  'a.readUInt8(2) == 234'
]);

test([
  'var a = Buffer(12)',

  'a.writeInt16BE(23000, 0)',
  'a.writeInt16BE(-32000, 2)',
  'a.writeUInt16BE(64000, 4)',

  'a.writeInt16LE(23000, 6)',
  'a.writeInt16LE(-32000, 8)',
  'a.writeUInt16LE(64000, 10)'
], [
  /* Big Endian */
  'a.readInt16BE(0) == 23000',
  'a.readInt16BE(2) == -32000',
  'a.readUInt16BE(0) == 23000',
  'a.readUInt16BE(4) == 64000',
  /* Little Endian */
  'a.readInt16LE(6) == 23000',
  'a.readInt16LE(8) == -32000',
  'a.readUInt16LE(6) == 23000',
  'a.readUInt16LE(10) == 64000',
  /* Cross */
  'a.readInt16LE(0) == -10151',
  'a.readUInt16LE(0) == 55385',
  'a.readInt16BE(8) == 131',
  'a.readUInt16BE(8) == 131'
]);

test([
  'var a = Buffer(24)',

  'a.writeInt32BE(37228163, 0)',
  'a.writeInt32BE(-2096220158, 4)',
  'a.writeUInt32BE(3882400018, 8)',

  'a.writeInt32LE(37228163, 12)',
  'a.writeInt32LE(-2096220158, 16)',
  'a.writeUInt32LE(3882400018, 20)'
], [
  /* Big Endian */
  'a.readInt32BE(0) == 37228163',
  'a.readInt32BE(4) == -2096220158',
  'a.readUInt32BE(0) == 37228163',
  'a.readUInt32BE(8) == 3882400018',
  /* Little Endian */
  'a.readInt32LE(12) == 37228163',
  'a.readInt32LE(16) == -2096220158',
  'a.readUInt32LE(12) == 37228163',
  'a.readUInt32LE(20) == 3882400018',
  /* Cross */
  'a.readInt32LE(0) == -2096220158',
  'a.readUInt32LE(0) == 2198747138',
  'a.readInt32BE(20) == 314140903',
  'a.readUInt32BE(20) == 314140903'
]);

test([
  'var a = Buffer(24)',

  'a.writeFloatBE(1e-30, 0)',
  'a.writeFloatLE(-3e+30, 4)',
  'a.writeDoubleBE(2e-300, 8)',
  'a.writeDoubleLE(-1e+300, 16)'
], [
  'a.readFloatBE(0) == 1.0000000031710769e-30',
  'a.readFloatLE(4) == -2.999999894026671e+30',
  'a.readDoubleBE(8) == 2e-300',
  'a.readDoubleLE(16) == -1e+300'
]);

test([
  'var a = Buffer(12)',

  'a.writeUInt32BE(0xffffffff, 0)',
  'a.writeInt32BE(0x7fffffff, 4)',
  'a.writeInt32BE(-0x80000000, 8)'
], [
  'a.readUInt32BE(0) == 0xffffffff',
  'a.readInt32BE(4) == 0x7fffffff',
  'a.readInt32BE(8) == -0x80000000'
]);
