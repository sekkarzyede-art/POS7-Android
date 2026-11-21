package com.sokkarzeyedeh.pos7;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
/** JVM fixture signs exactly the same bytes that AndroidKeystoreProofR300 signs. */
public final class ProofInteroperabilityTestR300 {
 public static void main(String[]args)throws Exception{
  KeyPairGenerator gen=KeyPairGenerator.getInstance("EC");gen.initialize(new ECGenParameterSpec("secp256r1"));KeyPair kp=gen.generateKeyPair();
  byte[] p=DeviceProofContractR300.payload("tab1","jdcolkgzwqpwbfvcrdje",
   "550e8400-e29b-41d4-a716-446655440000","650e8400-e29b-41d4-a716-446655440000",
   "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",42,2,
   "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",1800000000L,1800000120L);
  Signature sign=Signature.getInstance("SHA256withECDSA");sign.initSign(kp.getPrivate());sign.update(p);
  System.out.println(Base64.getEncoder().encodeToString(kp.getPublic().getEncoded()));
  System.out.println(Base64.getEncoder().encodeToString(sign.sign()));
 }
}