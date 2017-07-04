// a [ 0 1 2 3 4 5 6 7 8 9 ]
// b       [ 0 1 2 3 ]
// c               [ 0 1 2 ]
// d         [ 0 1 ]

// a [ 0 0 0 0 0 0 0 0 0 0 ]
// a [ 2 2 2 2 2 ]           // a.fill
// b       [ 2 2 0 0 ]       // a.slice
// b       [ 2 1 1 1 ]       // b.fill
// c               [ 4 3 5 ]
// d         [ 1 1 ]         // b.slice
// d         [ 3 1 ]         // d.writeInt8
// a [ 2 2 2 2 3 1 1 4 3 5 ] // c.copy

test([
  'var a = Buffer(10)',
  'a.fill(2, 0, 5)',
  'var b = a.slice(3, 7)',
  'b.fill(1, 1, 3)',
  'var c = Buffer([3,4,5])',
  'c.copy(a, 7)',
  'var d = b.slice(1, 3)',
  'd.writeInt8(3, 0)'
], [
  'a.length == 10',
  'a.readInt8(0) == 2',
  'a.readInt8(1) == 2',
  'a.readInt8(2) == 2',
  'a.readInt8(3) == 2',
  'a.readInt8(4) == 3',
  'a.readInt8(5) == 1',
  'b.length == 4',
  'b.readInt8(0) == 2',
  'b.readInt8(1) == 3',
  'b.readInt8(2) == 1',
  'b.readInt8(3) == 0',
  'c.length == 3',
  'c.readUInt8(0) == 3',
  'c.readUInt8(1) == 4',
  'c.readUInt8(2) == 5',
  'a.readUInt8(7) == 3',
  'a.readUInt8(8) == 4',
  'a.readUInt8(9) == 5',
  'd.length == 2',
  'd.readInt8(0) == 3',
  'd.readInt8(1) == 1'
]);

test([
  'var a = Buffer(5)',
  'a.fill(1)',
  'var b = Buffer(3)',
  'b.fill(2)',
  'var c = Buffer.concat(a, b)',
  'var d = Buffer.concat([a, b])',
  'var e = Buffer.concat(b, a, 6)',
  'var f = Buffer.concat([b, a], 7)'
], [
  'c.length == 8',
  'c.toString("hex") == "0101010101020202"',
  'd.length == 8',
  'd.toString("hex") == "0101010101020202"',
  'e.length == 6',
  'e.toString("hex") == "020202010101"',
  'f.length == 7',
  'f.toString("hex") == "02020201010101"'
]);
