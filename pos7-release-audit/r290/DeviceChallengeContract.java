package com.sokkarzeyedeh.pos7;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Pattern;
/** R290 staging challenge canonicalization; never constitutes publishing authorization. */
public final class DeviceChallengeContract {
 private static final Pattern NONCE=Pattern.compile("[a-f0-9]{64}");
 private DeviceChallengeContract(){}
 private static String uuid(String field,String value){
   if(value==null)throw new IllegalArgumentException(field+" missing");
   try { UUID parsed=UUID.fromString(value); if(!parsed.toString().equals(value))throw new IllegalArgumentException(field+" noncanonical");return value; }
   catch(IllegalArgumentException ex){throw new IllegalArgumentException(field+" invalid",ex);}
 }
 public static byte[] payload(String branch,String project,String device,String challenge,String nonce,long iat,long exp){
   if(!NativeBranchPolicy.mayReadForPreflight(null,branch,project))throw new IllegalArgumentException("branch/project mismatch");
   uuid("device",device);uuid("challenge",challenge);
   if(nonce==null||!NONCE.matcher(nonce).matches())throw new IllegalArgumentException("nonce invalid");
   if(iat<=0||exp<=iat||exp-iat>300)throw new IllegalArgumentException("TTL invalid");
   return ("POS7-DEVICE-ENROLL-R290\nbranch="+branch+"\nproject="+project+"\ndevice="+device+"\nchallenge="+challenge+"\nnonce="+nonce+"\niat="+iat+"\nexp="+exp+"\n").getBytes(StandardCharsets.US_ASCII);
 }
}
