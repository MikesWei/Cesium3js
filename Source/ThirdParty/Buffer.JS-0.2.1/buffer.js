/**
 * Client-side NodeJS's Buffer implementation
 *
 * @author 2012, Phoenix Kayo <kayo@ilumium.org>
 * @license GNU LGPLv3 http://www.gnu.org/licenses/lgpl-3.0.html
 *
 * @see Original Buffer Documentation http://nodejs.org/api/buffer.html
 */
;(function(){
  var M = Math,
  pow = M.pow,
  ArraySlice = Array.prototype.slice,
  root = window,
  c2c = String.fromCharCode,
  non_enc = /[^0-9a-z]/g,
  pass = function(a){return a;},
  encodings = {
    ascii:[pass, pass],
    binary:[pass, pass],
    utf8:[u8e, u8d],
    ucs2:[u2e, u2d],
    hex:[hxe, hxd],
    base64:[atob, btoa]
  },
  non_hex = /[^0-9A-Fa-f]/g;

  function mix(dst, src){
    for(var i in src){
      dst[i] = src[i];
    }
    i = 'toString';
    if(dst[i] !== src[i]){ /* Fuck IE */
      dst[i] = src[i];
    }
    return dst;
  }

  /* string to utf8 encode */
  function u8e(str){
    return unescape(encodeURIComponent(str));
  }

  /* utf8 to string decode */
  function u8d(str){
    return decodeURIComponent(escape(str));
  }

  /* string to ucs2 encode */
  function u2e(str){
    var ret = '',
    i = 0,
    val;
    for(; i < str.length; ){
      val = str.charCodeAt(i++);
      ret += c2c(val % 256) + c2c(val >>> 8);
    }
    return ret;
  }

  /* ucs2 to string decode */
  function u2d(str){
    var ret = '',
    i = 0;
    for(; i < str.length; ){
      ret += c2c(str.charCodeAt(i++) + (str.charCodeAt(i++) << 8));
    }
    return ret;
  }

  /* hex to binary encode */
  function hxe(str){
    var ret = '',
    i = 0;
    for(; i < str.length; i++){
      ret += c2c(parseInt(str.substr(i++, 2), 16));
    }
    return ret;
  }

  /* binary to hex decode */
  function hxd(str){
    var ret = '',
    i = 0,
    c;
    for(; i < str.length; ){
      c = (str.charCodeAt(i++) & 0xff).toString(16);
      for(; c.length < 2; c = '0' + c);
      ret += c;
    }
    return ret;
  }

  /* Generalized Constructor */
  function Buffer(data, encoding){
    if(!(this instanceof Buffer)){
      return new Buffer(data, encoding);
    }
    var len = buffer_len(data, encoding),
    buf = wrap(this, 0, len);
    buffer_write(buf, data, encoding);
    return buf;
  }

  /* Feature Detecting/Configuring */
  mix(Buffer, {
    useArrayBuffer: root.ArrayBuffer && {}.__proto__,
    useTypedArrays: !!root.Int8Array,
    useDataView: !!root.DataView
  });

  if(typeof root.Buffer == 'object'){
    mix(Buffer, root.Buffer);
  }
  root.Buffer = Buffer;

  /* Assertion Helper */
  function ast(val, msg){
    if(!val){
      throw new Error(msg);
    }
  }

  /* Encoding Assertion Helper */
  function enc_ast(encoding){
    encoding = (encoding || 'utf8').toLowerCase().replace(non_enc, '');
    ast(encoding in encodings, 'Unknown encoding');
    return encoding;
  }

  /* Hex String Assertion Helper */
  function hex_ast(val){
    ast(!(val.length % 2) && val.search(non_hex) < 0, 'Invalid hex string');
  }

  /* Initial Buffer Length Helper */
  function buffer_len(data, encoding){
    encoding = enc_ast(encoding);
    if(typeof data == 'number'){
      return data > 0 ? data : 0;
    }else if(typeof data == 'string'){
      return Buffer.byteLength(data, encoding);
    }else if(data instanceof Array){
      return data.length;
    }
    return 0;
  }

  function buffer_write(self, data, encoding){
    if(typeof data == 'string'){
      self.write(data, 0, self.length, encoding);
    }else if(data instanceof Array){
      for(var i = 0; i < data.length; i++){
        //self['write' + (data[i] < 0 ? '' : 'U') + 'Int8'](data[i], i);
        self.writeUInt8(data[i], i, true);
      }
    }
  }

  function notnil(value){
    return value !== undefined && value !== null;
  }

  /* Get Assertion Helper */
  function get_ast(self, offset, noAssert, bytes){
    if (!noAssert) {
      ast(notnil(offset), 'missing offset');
      ast(offset >= 0, 'trying to read at negative offset');
      ast(offset + bytes <= self.length, 'Trying to read beyond buffer length');
    }
  }

  /* Set Assertion Helper */
  function set_ast(self, value, offset, noAssert, bytes, max, min, fract){
    if (!noAssert) {
      min = min || 0x0;
      ast(notnil(offset), 'missing offset');
      ast(notnil(value), 'missing value');
      ast(offset >= 0, 'trying to write at negative offset');
      ast(offset + bytes <= self.length, 'trying to write beyond buffer length');
      /* value */
      ast(typeof value == 'number', 'cannot write a non-number as a number');
      ast(value >= min, min == 0 ? 'specified a negative value for writing an unsigned value'
          : 'value smaller than minimum allowed value');
      ast(value <= max, 'value is larger than maximum' + min == 0 ? 'value for type' : 'allowed value');
      ast(fract || M.floor(value) === value, 'value has a fractional component');
    }
  }

  /* Cooking Assertion with specified arguments */
  function cook_ast(bytes, max, min, fract){
    return max ? function(self, value, offset, noAssert){ /* write_ast */
      set_ast(self, value, offset, noAssert, bytes, max, min, fract);
    } : function(self, offset, noAssert){ /* read_ast */
      get_ast(self, offset, noAssert, bytes);
    };
  }

  var /* Read Asserts */
  read8_ast = cook_ast(1),
  read16_ast = cook_ast(2),
  read32_ast = cook_ast(4),
  read64_ast = cook_ast(8),
  /* Write Asserts */
  write8u_ast = cook_ast(1, 0xff),
  write16u_ast = cook_ast(2, 0xffff),
  write32u_ast = cook_ast(4, 0xffffffff),
  write8s_ast = cook_ast(1, 0x7f, -0x80),
  write16s_ast = cook_ast(2, 0x7fff, -0x8000),
  write32s_ast = cook_ast(4, 0x7fffffff, -0x80000000),
  write32_ast = cook_ast(4, 3.4028234663852886e+38, -3.4028234663852886e+38, true),
  write64_ast = cook_ast(8, 1.7976931348623157E+308, -1.7976931348623157E+308, true);

  if(Buffer.useArrayBuffer &&
     (Buffer.useDataView || Buffer.useTypedArrays)){

    var ArrayBuf = ArrayBuffer,
    DataProxy,
    wrap = function(self, start, length){
      if(!length){
        return self;
      }

      var buffer = self.buffer || new ArrayBuf(length); // (sic!) potentially this may have problem
      if(self.offset){
        start += self.offset;
      }
      // Wrong but ideologically more correct:
      // DataView.call(this, buf)

      var proxy = new DataProxy(buffer, start, length);
      proxy.__proto__ = Buffer.prototype;
      // Firefox disallow to set __proto__ field of Typed Arrays
      if(proxy.__proto__ === Buffer.prototype){
        self = proxy;
      }else{
        self = Buffer();
      }

      self.buffer = buffer;
      self.offset = start;
      self.length = length;
      return self;
    };

    if(Buffer.useDataView){
      Buffer.backend = 'DataView';
      DataProxy = DataView;

      var cook_val = function(type, write){
        return DataProxy.prototype[(write ? 'set' : 'get') + type];
      };
    }else{
      Buffer.backend = 'TypedArrays';
      DataProxy = Uint8Array;

      var nativeLE = function(){ /* check is native Little Endian */
        var buffer = new ArrayBuf();
        new Uint16Array(buffer)[0] = 1;
        return !new DataProxy(buffer)[0];
      }(),
      fix_order = function(buffer, offset, count, isLE, cons, value){
        var write = arguments.length > 5,
        typed;
        if(count < 2 || nativeLE == isLE){
          typed = new cons(buffer, offset, 1);
          if(write){
            typed[0] = value;
          }else{
            return typed[0];
          }
        }else{
          var reversed = new ArrayBuf(count),
          bytes = new DataProxy(buffer, offset, count),
          rbytes = new DataProxy(reversed),
          up = count - 1,
          i = 0;
          typed = new cons(reversed);
          if(write){
            typed[0] = value;
            for(; i < count; bytes[up - i] = rbytes[i++]);
          }else{
            for(; i < count; rbytes[up - i] = bytes[i++]);
            return typed[0];
          }
        }
      },
      cook_val = function(type, write){
        var cons = root[type + 'Array'],
        count = parseInt(type.replace(/^\D+/, ''), 10) >>> 3;
        return write ? function(offset, value, isLE){
          fix_order(this.buffer, offset + this.offset, count, isLE, cons, value);
        } : function(offset, isLE){
          return fix_order(this.buffer, offset + this.offset, count, isLE, cons);
        };
      };
    }

    var
    readUInt8 = cook_val('Uint8'),
    readUInt16 = cook_val('Uint16'),
    readUInt32 = cook_val('Uint32'),

    readInt8 = cook_val('Int8'),
    readInt16 = cook_val('Int16'),
    readInt32 = cook_val('Int32'),

    readFloat = cook_val('Float32'),
    readDouble = cook_val('Float64'),

    writeUInt8 = cook_val('Uint8', 1),
    writeUInt16 = cook_val('Uint16', 1),
    writeUInt32 = cook_val('Uint32', 1),

    writeInt8 = cook_val('Int8', 1),
    writeInt16 = cook_val('Int16', 1),
    writeInt32 = cook_val('Int32', 1),

    writeFloat = cook_val('Float32', 1),
    writeDouble = cook_val('Float64', 1);

    // Already not necessary in this
    /* BufferProxy = function(){};
     BufferProxy.prototype = DataProxy.prototype;
     Buffer.prototype = new BufferProxy(); */

  }else{
    Buffer.backend = 'Array';

    /**
     * Function readIEEE754 and writeIEEE754 forked from
     * ysangkok's buffer-browserify
     *
     * git://github.com/toots/buffer-browserify.git
     */

    function readIEEE754(buffer, offset, isLE, mLen, nBytes) {
      var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

      i += d;

      e = s & ((1 << (-nBits)) - 1);
      s >>= (-nBits);
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

      m = e & ((1 << (-nBits)) - 1);
      e >>= (-nBits);
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : ((s ? -1 : 1) * Infinity);
      } else {
        m = m + pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * pow(2, e - mLen);
    }

    function writeIEEE754(buffer, offset, value, isLE, mLen, nBytes) {
      var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? pow(2, -24) - pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

      value = M.abs(value);

      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = M.floor(M.log(value) / M.LN2);
        if (value * (c = pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }

        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * pow(2, eBias - 1) * pow(2, mLen);
          e = 0;
        }
      }

      for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

      e = (e << mLen) | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

      buffer[offset + i - d] |= s * 128;
    }

    var wrap = function(self, start, length){
      var buffer = self.buffer || length > 0 && new Array(length),
      i = 0;
      if(self.offset){
        start += self.offset;
      }
      if(!self.buffer){ /* init */
        if(buffer){
          /* touch */
          for(; i < length; buffer[start + i++] = 0);
        }
      }else{
        self = Buffer();
      }
      self.buffer = buffer;
      self.offset = start;
      self.length = length;
      return self;
    },

    /* readOps */
    readUInt8 = function(offset){
      return this.buffer[this.offset + offset];
    },
    readUInt16 = function(offset, isLE){
      return readUInt8.call(this, offset + (isLE ? 1 : 0)) << 8
        | readUInt8.call(this, offset + (isLE ? 0 : 1));
    },
    readUInt32 = function(offset, isLE){
      //return (readUInt16.call(this, offset + (isLE ? 2 : 0), isLE) << 16) | // it's wrong!
      return (readUInt16.call(this, offset + (isLE ? 2 : 0), isLE) << 15) * 2 // we use this instead
        + readUInt16.call(this, offset + (isLE ? 0 : 2), isLE);
    },

    readInt8 = function(offset){
      offset = readUInt8.call(this, offset);
      return offset & 0x80 ? offset - 0x100 : offset;
    },
    readInt16 = function(offset, isLE){
      offset = readUInt16.call(this, offset, isLE);
      return offset & 0x8000 ? offset - 0x10000 : offset;
    },
    readInt32 = function(offset, isLE){
      offset = readUInt32.call(this, offset, isLE);
      return offset & 0x80000000 ? offset - 0x100000000 : offset;
    },

    readFloat = function(offset, isLE){
      return readIEEE754(this.buffer, this.offset + offset, isLE, 23, 4);
    },
    readDouble = function(offset, isLE){
      return readIEEE754(this.buffer, this.offset + offset, isLE, 52, 8);
    },

    /* writeOps */
    writeUInt8 = function(offset, value){
      this.buffer[this.offset + offset] = value;// & 0xff;
    },
    writeUInt16 = function(offset, value, isLE){
      //value &= 0xffff;
      writeUInt8.call(this, offset + (isLE ? 1 : 0), value >>> 8);
      writeUInt8.call(this, offset + (isLE ? 0 : 1), value & 0xff);
    },
    writeUInt32 = function(offset, value, isLE){
      //value &= 0xffffffff;
      writeUInt16.call(this, offset + (isLE ? 2 : 0), value >>> 16, isLE);
      writeUInt16.call(this, offset + (isLE ? 0 : 2), value & 0xffff, isLE);
    },

    writeInt8 = function(offset, value){
      writeUInt8.call(this, offset, value < 0 ? value + 0x100 : value);
    },
    writeInt16 = function(offset, value, isLE){
      writeUInt16.call(this, offset, value < 0 ? value + 0x10000 : value, isLE);
    },
    writeInt32 = function(offset, value, isLE){
      writeUInt32.call(this, offset, value < 0 ? value + 0x100000000 : value, isLE);
    },

    writeFloat = function(offset, value, isLE){
      return writeIEEE754(this.buffer, this.offset + offset, value, isLE, 23, 4);
    },
    writeDouble = function(offset, value, isLE){
      return writeIEEE754(this.buffer, this.offset + offset, value, isLE, 52, 8);
    };
  }

  mix(Buffer, {
    isBuffer: function(obj){
      return obj instanceof Buffer;
    },
    byteLength: function(string, encoding){
      encoding = enc_ast(encoding);
      ast(typeof string == 'string', 'Argument must be a string');
      switch(encoding){
      case 'ascii':
      case 'binary':
        return string.length;
      case 'hex':
        //hex_ast(string); /* NodeJS don't checks it here, so we also keep this feature */
        return string.length >>> 1;
        //return M.ceil(string.length / 2);
      case 'base64':
        var e = string.search(/=/);
        return (string.length * 3 >>> 2) - (e < 0 ? 0 : (string.length - e));
      case 'ucs2':
        return string.length * 2;
      case 'utf8':
      default:
        return u8e(string).length;
        // function u8l(string){
        /*var t,
        c = 0,
        i = 0;
        for(; i < string.length; ){
          t = string.charCodeAt(i++);
          for(c++; t >>>= 8; c++);
        }
        return c;*/
        // }
      }
    },
    concat: function(list/*, totalLength*/) {
      var args = ArraySlice.call(arguments),
      totalLength = typeof args[args.length-1] == 'number' ? args.pop() : -1,
      length = 0,
      i = 0,
      bufs = [],
      buf,
      ret,
      skip = 0;

      if (!(list instanceof Array)) {
        list = args;
      }

      for(; i < list.length; ){
        buf = list[i++];
        if(buf){
          if(!Buffer.isBuffer(buf)){
            buf = new Buffer(buf);
          }
          length += buf.length;
          bufs.push(buf);
        }
      }

      ret = new Buffer(length = totalLength < 0 ? length : totalLength);
      for(; bufs.length && skip < length; ){
        buf = bufs.shift();
        buf.copy(ret, skip, 0, M.min(buf.length, length - skip));
        skip += buf.length;
      }

      return ret;
    }
  });

  mix(Buffer.prototype, {
    /* Buffer value access */
    /* readUInts */
    readUInt8: function(offset, noAssert){
      read8_ast(this, offset, noAssert);
      return readUInt8.call(this, offset);
    },
    readUInt16LE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readUInt16.call(this, offset, true);
    },
    readUInt16BE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readUInt16.call(this, offset, false);
    },
    readUInt32LE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readUInt32.call(this, offset, true);
    },
    readUInt32BE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readUInt32.call(this, offset, false);
    },
    /* readInts */
    readInt8: function(offset, noAssert){
      read8_ast(this, offset, noAssert);
      return readInt8.call(this, offset);
    },
    readInt16LE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readInt16.call(this, offset, true);
    },
    readInt16BE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readInt16.call(this, offset, false);
    },
    readInt32LE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readInt32.call(this, offset, true);
    },
    readInt32BE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readInt32.call(this, offset, false);
    },
    /* readFloats */
    readFloatLE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readFloat.call(this, offset, true);
    },
    readFloatBE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readFloat.call(this, offset, false);
    },
    readDoubleLE: function(offset, noAssert){
      read64_ast(this, offset, noAssert);
      return readDouble.call(this, offset, true);
    },
    readDoubleBE: function(offset, noAssert){
      read64_ast(this, offset, noAssert);
      return readDouble.call(this, offset, false);
    },
    /* writeUInts */
    writeUInt8: function(value, offset, noAssert){
      write8u_ast(this, value, offset, noAssert);
      return writeUInt8.call(this, offset, value);
    },
    writeUInt16LE: function(value, offset, noAssert){
      write16u_ast(this, value, offset, noAssert);
      return writeUInt16.call(this, offset, value, true);
    },
    writeUInt16BE: function(value, offset, noAssert){
      write16u_ast(this, value, offset, noAssert);
      return writeUInt16.call(this, offset, value, false);
    },
    writeUInt32LE: function(value, offset, noAssert){
      write32u_ast(this, value, offset, noAssert);
      return writeUInt32.call(this, offset, value, true);
    },
    writeUInt32BE: function(value, offset, noAssert){
      write32u_ast(this, value, offset, noAssert);
      return writeUInt32.call(this, offset, value, false);
    },
    /* writeInts */
    writeInt8: function(value, offset, noAssert){
      write8s_ast(this, value, offset, noAssert);
      return writeInt8.call(this, offset, value);
    },
    writeInt16LE: function(value, offset, noAssert){
      write16s_ast(this, value, offset, noAssert);
      return writeInt16.call(this, offset, value, true);
    },
    writeInt16BE: function(value, offset, noAssert){
      write16s_ast(this, value, offset, noAssert);
      return writeInt16.call(this, offset, value, false);
    },
    writeInt32LE: function(value, offset, noAssert){
      write32s_ast(this, value, offset, noAssert);
      return writeInt32.call(this, offset, value, true);
    },
    writeInt32BE: function(value, offset, noAssert){
      write32s_ast(this, value, offset, noAssert);
      return writeInt32.call(this, offset, value, false);
    },
    /* writeFloats */
    writeFloatLE: function(value, offset, noAssert){
      write32_ast(this, value, offset, noAssert);
      return writeFloat.call(this, offset, value, true);
    },
    writeFloatBE: function(value, offset, noAssert){
      write32_ast(this, value, offset, noAssert);
      return writeFloat.call(this, offset, value, false);
    },
    writeDoubleLE: function(value, offset, noAssert){
      write64_ast(this, value, offset, noAssert);
      return writeDouble.call(this, offset, value, true);
    },
    writeDoubleBE: function(value, offset, noAssert){
      write64_ast(this, value, offset, noAssert);
      return writeDouble.call(this, offset, value, false);
    },
    /* Buffer operations */
    slice: function(start, end){
      var self = this;
      start = start || 0;
      end = end || self.length;
      /* Slice Assertion Helper */
      ast(start >= 0 && start < end && end <= self.length, 'oob');
      return wrap(self, start, end - start);
    },
    write: function(string, offset, length, encoding){
      var self = this,
      i = 0;
      offset = offset || 0;
      length = length || self.length - offset;
      /* Assertion */
      ast(typeof string == 'string', 'Argument must be a string');
      encoding = enc_ast(encoding);
      /* Decode source string with specified encoding to binary string */
      string = encodings[encoding][0].call(root, string);
      /* Write binary string to buffer */
      for(; i < length; self.writeUInt8(string.charCodeAt(i) & 0xff, offset + i++));
      return length;
    },
    copy: function(target, offset, start, end){
      offset = offset || 0;
      start = start || 0;
      var self = this,
      i = start;
      end = end || self.length;
      /* Assertion */
      ast(end >= start, 'sourceEnd < sourceStart');
      ast(offset >= 0 && offset < target.length, 'targetStart out of bounds');
      ast(start >= 0 && start < self.length, 'sourceStart out of bounds');
      ast(end >= 0 && end <= self.length, 'sourceEnd out of bounds');
      /* Copy */
      for(; i < end; target.writeUInt8(self.readUInt8(i), offset + i++ - start));
    },
    fill: function(value, offset, end){
      offset = offset || 0;
      var self = this,
      i = offset;
      end = end || self.length;
      if(typeof value == 'string'){
        value = value.charCodeAt(0); // (sic!) no ucs2 check
      }
      /* Assertion */
      ast(typeof value === 'number' && !isNaN(value), 'value is not a number');
      ast(end >= offset, 'end < start');
      ast(offset >= 0 && offset < self.length, 'start out of bounds');
      ast(end > 0 && end <= self.length, 'end out of bounds');
      /* Fill */
      value &= 0xff;
      for(; i < end; self.writeUInt8(value, i++));
    },
    INSPECT_MAX_BYTES: 50,
    inspect: function(length){
      var self = this,
      i = 0,
      bytes = '',
      h;
      length = M.min(self.INSPECT_MAX_BYTES, self.length, length || self.length);
      for(; i < length; ){
        h = self.readUInt8(i++).toString(16);
        bytes += ' ' + (h.length < 2 ? '0' : '') + h;
      }
      return '<Buffer' + bytes + (i < self.length ? ' ... ' : '') + '>';
    },
    toString: function(encoding, start, end){
      var self = this,
      i = start || 0,
      string = '';
      if(arguments.length < 1){
        return self.inspect();
      }
      start = i;
      end = end || self.length;
      /* Accertion */
      encoding = enc_ast(encoding);
      /* Produce binary string from buffer data */
      for(; i < end; string += c2c(self.readUInt8(i++)));
      /* Decode binary string to specified encoding */
      return encodings[encoding][1].call(root, string);
    }
  });
})();
 