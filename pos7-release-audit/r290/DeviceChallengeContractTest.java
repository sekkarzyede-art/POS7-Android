package com.sokkarzeyedeh.pos7;
import java.nio.charset.StandardCharsets;
import java.security.*;
public final class DeviceChallengeContractTest {
 static int count=0;
 static final String DEVICE="990e8400-e29b-41d4-a716-446655440000", CHALLENGE="a50e8400-e29b-41d4-a716-446655440010";
 static final String NONCE="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
 static final long IAT=1800000000L,EXP=IAT+120;
 static byte[] p(String b,String project,String d,String c,String n,long i,long e){return DeviceChallengeContract.payload(b,project,d,c,n,i,e);}
 static void ok(boolean b){count++;if(!b)throw new AssertionError("check "+count);}
 static void bad(Runnable f){boolean failed=false;try{f.run();}catch(IllegalArgumentException x){failed=true;}ok(failed);}
 public static void main(String[]args)throws Exception{
  byte[] msg=p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,EXP);
  ok(new String(msg,StandardCharsets.US_ASCII).startsWith("POS7-DEVICE-ENROLL-R290\n"));
  ok(new String(msg,StandardCharsets.US_ASCII).contains("project="+NativeBranchPolicy.FIRST_PROJECT));
  ok(java.util.Arrays.equals(msg,p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,EXP)));
  bad(()->p("tab1",NativeBranchPolicy.SECOND_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,EXP));
  bad(()->p("tab2",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,EXP));
  bad(()->p("tab3",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,EXP));
  bad(()->p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE+"\nowner=true",CHALLENGE,NONCE,IAT,EXP));
  bad(()->p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,"bad",NONCE,IAT,EXP));
  bad(()->p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,"a",IAT,EXP));
  bad(()->p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE.toUpperCase(),IAT,EXP));
  bad(()->p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,IAT));
  bad(()->p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,IAT+301));
  bad(()->p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,CHALLENGE,NONCE,-1,EXP));
  KeyPairGenerator gen=KeyPairGenerator.getInstance("EC");gen.initialize(256);
  KeyPair a=gen.generateKeyPair(),b=gen.generateKeyPair();
  Signature s=Signature.getInstance("SHA256withECDSA");s.initSign(a.getPrivate());s.update(msg);byte[] sig=s.sign();
  Signature v=Signature.getInstance("SHA256withECDSA");
  v.initVerify(a.getPublic());v.update(msg);ok(v.verify(sig));
  v.initVerify(b.getPublic());v.update(msg);ok(!v.verify(sig));
  v.initVerify(a.getPublic());v.update(p("tab2",NativeBranchPolicy.SECOND_PROJECT,DEVICE,CHALLENGE,NONCE,IAT,EXP));ok(!v.verify(sig));
  v.initVerify(a.getPublic());v.update(p("tab1",NativeBranchPolicy.FIRST_PROJECT,DEVICE,"b50e8400-e29b-41d4-a716-446655440010",NONCE,IAT,EXP));ok(!v.verify(sig));
  v.initVerify(a.getPublic());v.update(msg);sig[0]^=1;boolean invalid=false;try{invalid=!v.verify(sig);}catch(SignatureException e){invalid=true;}ok(invalid);
  ok(!NativeBranchPolicy.mayStartBusiness("tab1","tab1",NativeBranchPolicy.FIRST_PROJECT,false,false,false));
  System.out.println("PASS "+count+" R290 verification assertions");
 }
}
