package com.sokkarzeyedeh.pos7;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import android.util.Base64;
/** Only a native authenticated coordinator may use this class.
 * Do not expose to JavascriptInterface, WebView or legacy client code. */
public final class AndroidKeystoreProofR300 {
 private static final String ALIAS="pos7_device_proof_r300";
 private AndroidKeystoreProofR300(){}
 public static PublicKey publicKey()throws Exception{
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(ks.containsAlias(ALIAS)){java.security.cert.Certificate c=ks.getCertificate(ALIAS);if(c==null)throw new IllegalStateException("missing_key_certificate");return c.getPublicKey();}
  KeyPairGenerator generator=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");
  generator.initialize(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY)
    .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
    .setDigests(KeyProperties.DIGEST_SHA256).setUserAuthenticationRequired(false).build());
  return generator.generateKeyPair().getPublic();
 }
 public static String publicKeySPKI(){try{return Base64.encodeToString(publicKey().getEncoded(),Base64.NO_WRAP);}catch(Exception e){throw new IllegalStateException("key_unavailable",e);}}
 public static String sign(String branch,String project,String device,String challenge,String nonce,
                          long revision,long epoch,String sectionsHash,long iat,long exp)throws Exception{
  byte[] message=DeviceProofContractR300.payload(branch,project,device,challenge,nonce,revision,epoch,sectionsHash,iat,exp);
  publicKey();KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  PrivateKey key=(PrivateKey)ks.getKey(ALIAS,null);if(key==null)throw new IllegalStateException("private_key_missing");
  Signature signer=Signature.getInstance("SHA256withECDSA");signer.initSign(key);signer.update(message);
  return Base64.encodeToString(signer.sign(),Base64.NO_WRAP);
 }
}