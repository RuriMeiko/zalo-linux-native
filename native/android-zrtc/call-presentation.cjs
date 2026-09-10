'use strict';
// Display-only data. Never use a contact name for signaling identity, lookup,
// process arguments, markup, file paths or authentication.
function peerName(value) {
  if(typeof value!=='string' || value.length>512)return '';
  return Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ')
    .replace(/\s+/gu,' ').trim()).slice(0,80).join('');
}
module.exports={peerName};
