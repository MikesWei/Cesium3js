/**
 * Pure EcmaScript implementation of Mozilla's btoa & atob
 *
 * @author 2012, Phoenix Kayo <kayo@ilumium.org>
 * @license GNU LGPLv3 http://www.gnu.org/licenses/lgpl-3.0.html
 *
 * @see Original Documentation https://developer.mozilla.org/en-US/docs/DOM/window.btoa
 */
;(function (window) {
  /* fabricate a suitable error object */
  var INVALID_CHARACTER_ERR = (function(){
    try {
      document.createElement('$');
    } catch (error) {
      return error;
    }
  })(),
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split(''),
  integers = [],
  i = 0;
  for(; i < characters.length; integers[characters[i]] = i++);

  /**
   * Binary string to base64 encoder
   *
   * @param {String} string Source binary string
   * @return {String} Base64 encoded string
   */
  window.btoa = window.btoa || function(string){
    var l = string.length,
    a = [],
    b = [],
    r = '',
    i = 0,
    j;

    for(; i < l; ){
      for(j = 0; j < 3; ){
        a[j] = string.charCodeAt(i++);
        if(a[j++] > 0xff){
          throw INVALID_CHARACTER_ERR;
        }
      }

      b[0] = (a[0] >> 2) & 0x3f;
      b[1] = (a[0] & 0x3) << 4 | ((a[1] >> 4) & 0xf);
      b[2] = i > l + 1 ? 64 : (a[1] & 0xf) << 2 | (i > l ? 0 : (a[2] >> 6) & 0x3);
      b[3] = i > l ? 64 : a[2] & 0x3f;

      for(j = 0; j < 4; r += characters[b[j++]]);
    }
    return r;
  };

  /**
   * Base64 to binary string decoding
   *
   * @param {String} string Source base64 encoded string
   * @return {String} Decoded binary string
   */
  window.atob = window.atob || function(string){
    var l = string.length,
    a = [],
    b = [],
    i = 0,
    j,
    r = '';

    if(l % 4 === 1) throw INVALID_CHARACTER_ERR;

    for(; i < l; ){
      for(j = 0; j < 4; b[j++] = integers[string.charAt(i++)]);

      a[0] = ((b[0] & 0x3f) << 2) | ((b[1] >> 4) & 0x3);
      a[1] = ((b[1] & 0xf) << 4) | ((b[2] >> 2) & 0xf);
      a[2] = ((b[2] & 0x3) << 6) | (b[3] & 0x3f);

      for(j = 0; j < 3; r += b[j+1] != 64 ? String.fromCharCode(a[j]) : '', j++);
    }
    return r;
  };
})(this);
