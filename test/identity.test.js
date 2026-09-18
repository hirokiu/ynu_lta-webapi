const assert=require('assert');const {resolveIdentity}=require('../dist/utils/identity');
const env={AUTH_MODE:'uid',AUTH_IDENTITY_MAP:JSON.stringify({owner:{userId:'hiroki_u',isAdmin:true},member:{userId:'tester',isAdmin:false}})};
assert.deepStrictEqual(resolveIdentity({uid:'owner',email:'any@example.com'},env),{userId:'hiroki_u',isAdmin:true});
assert.deepStrictEqual(resolveIdentity({uid:'member'},env),{userId:'tester',isAdmin:false});
assert.throws(()=>resolveIdentity({uid:'unknown',email:'hiroki_u@humlablu.com'},env));
assert.throws(()=>resolveIdentity({uid:'toString'},env));
assert.throws(()=>resolveIdentity({uid:'owner'},{AUTH_MODE:'typo'}));
assert.equal(resolveIdentity({email:'hiroki_u@humlablu.com'},{AUTH_MODE:'legacy'}).userId,'hiroki_u');
console.log('UID mapping, admin scope and legacy compatibility passed');
