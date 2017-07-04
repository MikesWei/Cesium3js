test([
  'var a = Buffer("Saluton! Mondo", "utf8")',
  'var b = Buffer("Привет, мир!", "utf8")',
  'var c = Buffer("こんにちは世界", "utf8")'
], [
  'a.length == 14',
  'a.toString("utf8") == "Saluton! Mondo"',
  'b.length == 21',
  'b.toString("utf8") == "Привет, мир!"',
  'c.length == 21',
  'c.toString("utf8") == "こんにちは世界"'
]);

test([
  'var a = Buffer("Saluton! Mondo", "ucs2")',
  'var b = Buffer("Привет, мир!", "ucs2")',
  'var c = Buffer("こんにちは世界", "ucs2")'
], [
  'a.length == 28',
  'a.toString("ucs2") == "Saluton! Mondo"',
  'b.length == 24',
  'b.toString("ucs2") == "Привет, мир!"',
  'c.length == 14',
  'c.toString("ucs2") == "こんにちは世界"'
]);

test([
  'var a = Buffer("0123456789abcdef", "hex")',
  'var b = Buffer("a1b2c3d4e5f6", "hex")',
  'var c = Buffer("000000", "hex")'
], [
  'a.length == 8',
  'a.toString("hex") == "0123456789abcdef"',
  'b.length == 6',
  'b.toString("hex") == "a1b2c3d4e5f6"',
  'c.length == 3',
  'c.toString("hex") == "000000"'
]);

test([
  'var a = Buffer("AAEC", "base64")',
  'var b = Buffer("AAECAwQ=", "base64")',
  'var c = Buffer("AAECAwQFBgcICQ==", "base64")'
], [
  'a.length == 3',
  'a.toString("base64") == "AAEC"',
  'b.length == 5',
  'b.toString("base64") == "AAECAwQ="',
  'c.length == 10',
  'c.toString("base64") == "AAECAwQFBgcICQ=="'
]);

test([
  'var a = Buffer("\\x00\\xab\\x3f\\x17", "binary")',
  'var b = Buffer("hello, world!", "ascii")'
], [
  'a.length == 4',
  'a.toString("binary") == "\\x00\\xab\\x3f\\x17"',
  'b.length == 13',
  'b.toString("ascii") == "hello, world!"'
]);
